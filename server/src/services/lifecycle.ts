import { storage } from '../storage';
import { Claim, Invoice, Payout, Policy, Quote } from '../types';
import { clock, today } from '../utils/clock';
import { audit } from './audit';

export async function refreshQuote(quote: Quote): Promise<Quote> {
  if (quote.status === 'PENDING' && new Date(quote.expiry_date) < clock.now()) {
    return (await storage.updateQuote(quote.id, { status: 'EXPIRED' }))!;
  }
  return quote;
}

export async function refreshPolicy(policy: Policy): Promise<Policy> {
  if (policy.status === 'ACTIVE' && policy.term.end_date < today()) {
    const expired = (await storage.updatePolicy(policy.id, { status: 'EXPIRED', updated_at: clock.now().toISOString() }))!;
    await audit(undefined, 'POLICY_EXPIRED', 'POLICY', policy.id, { end_date: policy.term.end_date });
    return expired;
  }
  return policy;
}

export async function refreshInvoice(invoice: Invoice): Promise<Invoice> {
  if (invoice.status === 'PENDING' && invoice.due_date < today()) {
    return (await storage.updateInvoice(invoice.id, { status: 'OVERDUE', updated_at: clock.now().toISOString() }))!;
  }
  return invoice;
}

export async function committedPayoutTotal(claimId: string, excludePayoutId?: string): Promise<number> {
  return (await storage.listPayouts())
    .filter((p) => p.claim_id === claimId && p.id !== excludePayoutId && p.status !== 'CANCELLED' && p.status !== 'FAILED')
    .reduce((sum, p) => sum + p.amount, 0);
}

export async function refreshPayout(payout: Payout): Promise<Payout> {
  if (payout.status !== 'PENDING' && payout.status !== 'PROCESSING') return payout;
  if (!payout.estimated_arrival || new Date(payout.estimated_arrival) > clock.now()) return payout;

  const completed = (await storage.updatePayout(payout.id, {
    status: 'COMPLETED',
    completed_at: payout.estimated_arrival,
    updated_at: clock.now().toISOString(),
  }))!;
  await audit(undefined, 'PAYOUT_COMPLETED', 'PAYOUT', payout.id, { claim_id: payout.claim_id, amount: payout.amount });

  const claim = await storage.getClaim(payout.claim_id);
  if (claim && (claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED')) {
    const paid = (await storage.listPayouts())
      .filter((p) => p.claim_id === claim.id && p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);
    if (paid >= (claim.adjudication?.payout_amount ?? 0)) {
      const now = clock.now().toISOString();
      await storage.updateClaim(claim.id, { status: 'PAID', closed_at: now, updated_at: now });
      await audit(undefined, 'CLAIM_PAID', 'CLAIM', claim.id, { amount_paid: paid });
    }
  }
  return completed;
}

export async function settleDuePayouts(): Promise<Payout[]> {
  const payouts: Payout[] = [];
  for (const payout of await storage.listPayouts()) {
    payouts.push(await refreshPayout(payout));
  }
  return payouts;
}

export async function refreshClaim(claim: Claim): Promise<Claim> {
  for (const payout of (await storage.listPayouts()).filter((p) => p.claim_id === claim.id)) {
    await refreshPayout(payout);
  }
  return (await storage.getClaim(claim.id))!;
}
