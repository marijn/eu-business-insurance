import { storage } from '../storage';
import { Address, Claim, ErasureEntityType } from '../types';
import { notFound } from '../middleware/errorHandler';

export const ERASED = '[erased]';

const erasedAddress = (address: Address): Address => ({
  street: ERASED,
  city: ERASED,
  postal_code: ERASED,
  country: address.country,
});

export interface ErasureResult {
  claims: number;
  invoices: number;
  payment_methods: number;
  payouts: number;
  documents: number;
  notes: number;
}

async function eraseClaim(claim: Claim, result: ErasureResult): Promise<void> {
  await storage.updateClaim(claim.id, {
    claimant: {
      ...claim.claimant,
      employee_id: claim.claimant.employee_id ? ERASED : undefined,
      contact: {
        name: ERASED,
        email: ERASED,
        phone: claim.claimant.contact.phone ? ERASED : undefined,
        address: claim.claimant.contact.address ? erasedAddress(claim.claimant.contact.address) : undefined,
      },
    },
    incident: { ...claim.incident, location: claim.incident.location ? ERASED : undefined },
    notes: (claim.notes || []).map((note) => ({ ...note, content: ERASED })),
    documents: [],
  });
  result.claims++;

  for (const payout of (await storage.listPayouts()).filter((p) => p.claim_id === claim.id)) {
    await storage.updatePayout(payout.id, {
      recipient: {
        ...payout.recipient,
        name: ERASED,
        iban: `****${payout.recipient.iban.slice(-4)}`,
        address: erasedAddress(payout.recipient.address),
        tax_id: payout.recipient.tax_id ? ERASED : undefined,
      },
    });
    result.payouts++;
  }

  await eraseDocuments('CLAIM', claim.id, result);
}

async function erasePolicyData(policyId: string, result: ErasureResult): Promise<void> {
  for (const claim of (await storage.listClaims()).filter((c) => c.policy_id === policyId)) {
    await eraseClaim(claim, result);
  }
  for (const invoice of (await storage.listInvoices()).filter((i) => i.policy_id === policyId)) {
    await storage.updateInvoice(invoice.id, { billing_address: erasedAddress(invoice.billing_address) });
    result.invoices++;
  }
  await eraseDocuments('POLICY', policyId, result);
}

async function eraseDocuments(entityType: string, entityId: string, result: ErasureResult): Promise<void> {
  const documents = (await storage.listDocuments()).filter((d) => d.entity_type === entityType && d.entity_id === entityId);
  for (const doc of documents) {
    await storage.deleteDocument(doc.id);
    result.documents++;
  }
}

export async function eraseEntity(entityType: ErasureEntityType, entityId: string): Promise<ErasureResult> {
  const result: ErasureResult = { claims: 0, invoices: 0, payment_methods: 0, payouts: 0, documents: 0, notes: 0 };

  switch (entityType) {
    case 'CLAIM': {
      const claim = await storage.getClaim(entityId);
      if (!claim) throw notFound('Claim');
      await eraseClaim(claim, result);
      break;
    }
    case 'POLICY': {
      if (!await storage.getPolicy(entityId)) throw notFound('Policy');
      await erasePolicyData(entityId, result);
      break;
    }
    case 'BUSINESS': {
      const policies = (await storage.listPolicies()).filter((p) => p.business_id === entityId);
      const methods = (await storage.listPaymentMethods()).filter((pm) => pm.business_id === entityId);
      if (policies.length === 0 && methods.length === 0) throw notFound('Business');
      for (const policy of policies) {
        await erasePolicyData(policy.id, result);
      }
      for (const method of methods) {
        await storage.updatePaymentMethod(method.id, { details: { ...method.details, holder_name: ERASED } });
        result.payment_methods++;
      }
      await eraseDocuments('BUSINESS', entityId, result);
      break;
    }
    case 'USER': {
      for (const claim of await storage.listClaims()) {
        if (claim.claimant.employee_id === entityId) {
          await eraseClaim(claim, result);
          continue;
        }
        const authored = (claim.notes || []).filter((n) => n.author === entityId).length;
        if (authored) {
          await storage.updateClaim(claim.id, {
            notes: claim.notes!.map((n) => (n.author === entityId ? { ...n, author: ERASED } : n)),
          });
          result.notes += authored;
        }
      }
      break;
    }
  }

  return result;
}
