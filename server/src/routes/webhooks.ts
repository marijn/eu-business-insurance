import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/errorHandler';
import { validateSchema, docusignConnectEventSchema } from '../utils/validation';
import { AgreementStatus, Signatory } from '../types';
import { clock } from '../utils/clock';
import { audit } from '../services/audit';
import { handleMolliePayment } from '../services/payments';
import { agreementRejected, agreementSigned } from '../services/policies';

const router = Router();

const DOCUSIGN_USER = { userId: 'docusign', scopes: [] };

router.post('/docusign', asyncHandler(async (req, res) => {
  const keys = (process.env.DOCUSIGN_CONNECT_HMAC_KEYS || '').split(',').map((key) => key.trim()).filter(Boolean);
  const signatures = Object.entries(req.headers)
    .filter(([name]) => /^x-docusign-signature-\d+$/.test(name))
    .map(([, value]) => Buffer.from(String(value)));
  const verified = keys.some((key) => {
    const expected = Buffer.from(createHmac('sha256', key).update(req.rawBody || Buffer.alloc(0)).digest('base64'));
    return signatures.some((signature) => signature.length === expected.length && timingSafeEqual(signature, expected));
  });
  if (!verified && process.env.DOCUSIGN_CONNECT_SKIP_VERIFY !== 'true') {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or missing DocuSign Connect HMAC signature' });
    return;
  }
  req.user = DOCUSIGN_USER;

  const { event, generatedDateTime, data } = validateSchema(docusignConnectEventSchema, req.body);
  const agreement = (await storage.listAgreements()).find((a) => a.envelope_id === data.envelopeId);
  if (!agreement || agreement.status !== 'PENDING_SIGNATURE') {
    res.json({ status: 'ignored' });
    return;
  }

  const eventTime = generatedDateTime || clock.now().toISOString();
  const signers = data.envelopeSummary?.recipients?.signers || [];
  const signerFor = (signatory: Signatory) => signers.find((s) => s.recipientId === signatory.recipient_id);
  let signatories = agreement.signatories;
  let status: AgreementStatus = agreement.status;
  let signedAt = agreement.signed_at;

  switch (event) {
    case 'recipient-completed':
    case 'recipient-declined': {
      const signed = event === 'recipient-completed';
      const signatory = signatories.find((s) => s.recipient_id === data.recipientId);
      if (!signatory || signatory.status !== 'PENDING') break;
      signatories = signatories.map((s) => s === signatory
        ? { ...s, status: signed ? 'SIGNED' : 'REJECTED', signed_at: signed ? signerFor(s)?.signedDateTime || eventTime : null }
        : s);
      await audit(req, signed ? 'AGREEMENT_SIGNATORY_SIGNED' : 'AGREEMENT_SIGNATORY_DECLINED', 'AGREEMENT', agreement.id, {
        envelope_id: data.envelopeId,
        recipient_id: data.recipientId,
        email: signatory.email,
        reason: signed ? undefined : signerFor(signatory)?.declinedReason,
      });
      if (!signed) status = 'DECLINED';
      break;
    }
    case 'envelope-completed':
      signatories = signatories.map((s) => s.status === 'SIGNED'
        ? s
        : { ...s, status: 'SIGNED', signed_at: signerFor(s)?.signedDateTime || eventTime });
      break;
    case 'envelope-declined':
      status = 'DECLINED';
      break;
    case 'envelope-voided':
      status = 'VOIDED';
      await audit(req, 'AGREEMENT_VOIDED', 'AGREEMENT', agreement.id, {
        envelope_id: data.envelopeId,
        reason: data.envelopeSummary?.voidedReason,
      });
      break;
    default:
      res.json({ status: 'ignored' });
      return;
  }

  if (status === 'PENDING_SIGNATURE' && signatories.length > 0 && signatories.every((s) => s.status === 'SIGNED')) {
    status = 'SIGNED';
    signedAt = data.envelopeSummary?.completedDateTime || eventTime;
    await audit(req, 'AGREEMENT_SIGNED', 'AGREEMENT', agreement.id, { envelope_id: data.envelopeId, signed_at: signedAt });
  }
  if (status === 'DECLINED') {
    await audit(req, 'AGREEMENT_DECLINED', 'AGREEMENT', agreement.id, { envelope_id: data.envelopeId });
  }

  const updated = (await storage.updateAgreement(agreement.id, { signatories, status, signed_at: signedAt }))!;
  if (status === 'SIGNED') await agreementSigned(req, updated);
  if (status === 'DECLINED' || status === 'VOIDED') await agreementRejected(req, updated);
  res.json({ status: 'processed' });
}));

router.post('/mollie', asyncHandler(async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id : '';
  if (!/^tr_\w+$/.test(id)) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Expected a Mollie payment id' });
    return;
  }
  req.user = { userId: 'mollie', scopes: [] };
  await handleMolliePayment(req, id);
  res.status(200).end();
}));

export { router as webhooksRouter };
