import { Request } from 'express';
import { storage } from '../storage';
import { Agreement } from '../types';
import { generateId } from '../utils/idGenerator';
import {Clock, clock} from '../utils/clock';
import { badRequest } from '../middleware/errorHandler';
import {actorId, auditV2} from './audit';
import {AgreementId, generateAgreementId} from "../utils/AgreementId";

const UNSIGNED = ['DRAFT', 'PENDING_SIGNATURE'];

export async function generateAgreementV2(
    agreementId: AgreementId,
    originatingIp: string | undefined,
    originatingUserAgent: string | undefined,
    originatingActor: string,
    clock: Clock,
    options: { policyId: string; templateId: string; endorsementId?: string; language?: string }
): Promise<Agreement> {
  const policy = (await storage.getPolicy(options.policyId))!;
  const endorsement = options.endorsementId
    ? policy.endorsements?.find((e) => e.id === options.endorsementId)
    : undefined;
  if (options.endorsementId && !endorsement) {
    throw badRequest(`Endorsement ${options.endorsementId} does not belong to policy ${policy.id}`, 'endorsement_id');
  }

  const previousId = endorsement ? endorsement.agreement_id : policy.agreement_id;
  const previous = previousId ? await storage.getAgreement(previousId) : undefined;
  if (previous?.status === 'SIGNED') {
    throw badRequest(
      endorsement
        ? 'The endorsement agreement is already signed'
        : 'The policy agreement is already signed; changes require an endorsement',
      'policy_id'
    );
  }

  const agreement: Agreement = await storage.createAgreement({
    id: agreementId,
    policy_id: policy.id,
    endorsement_id: endorsement?.id,
    status: 'DRAFT',
    document_url: `https://documents.insureeu.com/agreements/${agreementId}.pdf`,
    template_version: options.templateId,
    signatories: [],
    created_at: clock.now().toISOString(),
  });

  if (previous && UNSIGNED.includes(previous.status)) {
    await storage.updateAgreement(previous.id, { status: 'VOIDED' });

    await auditV2(
      originatingIp,
      originatingUserAgent,
      originatingActor,
      'AGREEMENT_VOIDED',
      'AGREEMENT',
      previous.id,
      clock.now(),
      {
        reason: 'SUPERSEDED',
        superseded_by: agreementId
      }
    );
  }

  if (endorsement) {
    endorsement.agreement_id = agreementId;
    await storage.updatePolicy(policy.id, { endorsements: policy.endorsements, updated_at: clock.now().toISOString() });
  } else {
    await storage.updatePolicy(policy.id, { agreement_id: agreementId, updated_at: clock.now().toISOString() });
  }

  await auditV2(
    originatingIp,
    originatingUserAgent,
    originatingActor,
    'AGREEMENT_GENERATED',
    'AGREEMENT',
    agreementId,
    clock.now(),
    {
      policy_id: policy.id,
      endorsement_id: endorsement?.id,
      template_id: options.templateId,
      language: options.language,
    }
  );
  return agreement;
}

export async function generateAgreement(
  req: Request | undefined,
  options: { policyId: string; templateId: string; endorsementId?: string; language?: string }
): Promise<Agreement> {
  const agreementId = generateAgreementId();
  const originatingIp = req?.ip;
  const originatingUserAgent = req?.get('user-agent');
  const originatingActor = actorId(req);

  return await generateAgreementV2(
      agreementId,
      originatingIp,
      originatingUserAgent,
      originatingActor,
      clock,
      options
  );
}
