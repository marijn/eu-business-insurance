import { Router } from 'express';
import { randomUUID } from 'crypto';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import {
  validateSchema,
  agreementRequestSchema,
  signingRequestSchema,
  voidAgreementRequestSchema,
} from '../utils/validation';
import { Agreement, AgreementVersion, SignatureStatus, SigningRequest } from '../types';
import { clock } from '../utils/clock';
import { agreementRejected } from '../services/policies';
import { audit } from '../services/audit';
import { generateAgreement } from '../services/agreements';

const router = Router();

async function getAgreementOr404(agreementId: string): Promise<Agreement> {
  const agreement = await storage.getAgreement(agreementId);
  if (!agreement) throw notFound('Agreement');
  return agreement;
}

router.post('/generate', asyncHandler(async (req, res) => {
  const agreementRequest = validateSchema(agreementRequestSchema, req.body);

  const policy = await storage.getPolicy(agreementRequest.policy_id);
  if (!policy) throw notFound('Policy');
  if (policy.status === 'CANCELLED' || policy.status === 'RENEWED') {
    throw badRequest(`Cannot generate an agreement for a ${policy.status} policy`, 'policy_id');
  }

  const agreement = await generateAgreement(req, {
    policyId: policy.id,
    templateId: agreementRequest.template_id,
    endorsementId: agreementRequest.endorsement_id,
    language: agreementRequest.language,
  });

  res.status(201).json(agreement);
}));

router.get('/:agreement_id', asyncHandler(async (req, res) => {
  const agreement = await getAgreementOr404(req.params.agreement_id);
  const { format = 'json' } = req.query;

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from('PDF content would be here', 'utf-8'));
  } else {
    res.json(agreement);
  }
}));

router.get('/:agreement_id/versions', asyncHandler(async (req, res) => {
  const agreement = await getAgreementOr404(req.params.agreement_id);

  const versions: AgreementVersion[] = [
    {
      version: agreement.template_version,
      created_at: agreement.created_at,
      changes: ['Initial version'],
    },
  ];

  res.json({ versions });
}));

router.post('/:agreement_id/sign', asyncHandler(async (req, res) => {
  const { agreement_id } = req.params;
  const { signatory_email, signatory_role } = validateSchema(signingRequestSchema, req.body);
  const agreement = await getAgreementOr404(agreement_id);

  if (agreement.status !== 'DRAFT' && agreement.status !== 'PENDING_SIGNATURE') {
    throw badRequest(`Cannot request signatures on a ${agreement.status} agreement`);
  }
  const signatories = agreement.signatories || [];
  if (signatories.some(s => s.email.toLowerCase() === signatory_email.toLowerCase())) {
    throw badRequest(`${signatory_email} has already been asked to sign this agreement`, 'signatory_email');
  }

  const envelopeId = agreement.envelope_id || randomUUID();
  const recipientId = String(signatories.length + 1);
  const signingRequest: SigningRequest = {
    signature_request_id: envelopeId,
    signing_url: `https://sign.insureeu.com/envelopes/${envelopeId}/recipients/${recipientId}`,
    expires_at: new Date(clock.now().getTime() + 24 * 60 * 60 * 1000).toISOString(),
    signatory_email,
  };

  await storage.updateAgreement(agreement_id, {
    envelope_id: envelopeId,
    signatories: [
      ...signatories,
      { recipient_id: recipientId, role: signatory_role, email: signatory_email, status: 'PENDING', signed_at: null },
    ],
    status: 'PENDING_SIGNATURE',
  });

  await audit(req, 'AGREEMENT_SIGNING_INITIATED', 'AGREEMENT', agreement_id, {
    envelope_id: envelopeId,
    recipient_id: recipientId,
    signatory_email,
    signatory_role,
  });

  res.status(201).json(signingRequest);
}));

router.get('/:agreement_id/signatures', asyncHandler(async (req, res) => {
  const { agreement_id } = req.params;
  const agreement = await getAgreementOr404(agreement_id);
  const signatories = agreement.signatories || [];

  const signatureStatus: SignatureStatus = {
    agreement_id,
    signatories,
    all_signed: signatories.length > 0 && signatories.every(s => s.status === 'SIGNED'),
  };

  res.json(signatureStatus);
}));

router.post('/:agreement_id/void', asyncHandler(async (req, res) => {
  const { agreement_id } = req.params;
  const { reason } = validateSchema(voidAgreementRequestSchema, req.body);
  const agreement = await getAgreementOr404(agreement_id);

  if (agreement.status !== 'DRAFT' && agreement.status !== 'PENDING_SIGNATURE') {
    throw badRequest(`Only unsigned agreements can be voided (agreement is ${agreement.status})`);
  }

  const voided = (await storage.updateAgreement(agreement_id, { status: 'VOIDED' }))!;
  await audit(req, 'AGREEMENT_VOIDED', 'AGREEMENT', agreement_id, { reason });
  await agreementRejected(req, voided);

  res.json(voided);
}));

export { router as agreementsRouter };
