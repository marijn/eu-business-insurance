import { Router } from 'express';
import { generateId } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import { validateSchema, payoutRequestSchema, cancelPayoutRequestSchema, paginate } from '../utils/validation';
import { Payout, PayoutList, PayoutPurpose, PolicyType } from '../types';
import { clock, addDays } from '../utils/clock';
import { audit } from '../services/audit';
import { committedPayoutTotal, refreshPayout, settleDuePayouts } from '../services/lifecycle';

const router = Router();

const SEPA_SETTLEMENT_DAYS = 2;

const PURPOSE_BY_POLICY_TYPE: Record<PolicyType, PayoutPurpose> = {
  CYBER: 'CYBER_CLAIM',
  DNO: 'DNO_CLAIM',
  SURETY: 'SURETY_CLAIM',
  WORKERS_COMP: 'WORKERS_COMP_CLAIM',
};

async function getPayoutOr404(payoutId: string): Promise<Payout> {
  const payout = await storage.getPayout(payoutId);
  if (!payout) throw notFound('Payout');
  return await refreshPayout(payout);
}

router.post('/', asyncHandler(async (req, res) => {
  const payoutRequest = validateSchema(payoutRequestSchema, req.body);

  const claim = await storage.getClaim(payoutRequest.claim_id);
  if (!claim) throw notFound('Claim');
  if (claim.status !== 'APPROVED' && claim.status !== 'PARTIALLY_APPROVED') {
    throw badRequest(`Payouts require an approved claim (claim is ${claim.status})`, 'claim_id');
  }
  const adjudication = claim.adjudication!;
  if (payoutRequest.currency !== adjudication.currency) {
    throw badRequest(`Currency must match the adjudicated currency (${adjudication.currency})`, 'currency');
  }
  const remaining = Math.round(((adjudication.payout_amount || 0) - await committedPayoutTotal(claim.id)) * 100) / 100;
  if (payoutRequest.amount > remaining) {
    throw badRequest(`Amount exceeds the remaining adjudicated payout of ${remaining}`, 'amount');
  }
  const policy = (await storage.getPolicy(claim.policy_id))!;
  const expectedPurpose = PURPOSE_BY_POLICY_TYPE[policy.policy_type];
  if (payoutRequest.purpose !== expectedPurpose) {
    throw badRequest(`Purpose must be ${expectedPurpose} for a ${policy.policy_type} claim`, 'purpose');
  }

  const payoutId = generateId('payout');
  const now = clock.now();
  const payout: Payout = {
    id: payoutId,
    claim_id: payoutRequest.claim_id,
    amount: payoutRequest.amount,
    currency: payoutRequest.currency,
    recipient: payoutRequest.recipient,
    status: 'PENDING',
    bank_reference: `REF_${payoutId.replace('payout_', '')}`,
    purpose: payoutRequest.purpose,
    estimated_arrival: addDays(now, SEPA_SETTLEMENT_DAYS).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    completed_at: null,
  };

  await storage.createPayout(payout);

  await audit(req, 'PAYOUT_INITIATED', 'PAYOUT', payoutId, {
    claim_id: payoutRequest.claim_id,
    amount: payoutRequest.amount,
    currency: payoutRequest.currency,
    recipient: payoutRequest.recipient.name,
  });

  res.status(201).json(payout);
}));

router.get('/', asyncHandler(async (req, res) => {
  const { claim_id, status } = req.query;

  let payouts = await settleDuePayouts();
  if (claim_id) payouts = payouts.filter(p => p.claim_id === claim_id);
  if (status) payouts = payouts.filter(p => p.status === status);

  const { page, total, limit, offset } = paginate(payouts, req.query);
  const result: PayoutList = { payouts: page, total, limit, offset };
  res.json(result);
}));

router.get('/:payout_id', asyncHandler(async (req, res) => {
  res.json(await getPayoutOr404(req.params.payout_id));
}));

router.post('/:payout_id', asyncHandler(async (req, res) => {
  const { payout_id } = req.params;
  const { reason } = validateSchema(cancelPayoutRequestSchema, req.body);
  const payout = await getPayoutOr404(payout_id);

  if (payout.status !== 'PENDING') {
    throw badRequest(`Payout can only be cancelled while PENDING (payout is ${payout.status})`);
  }

  const cancelled = await storage.updatePayout(payout_id, {
    status: 'CANCELLED',
    updated_at: clock.now().toISOString(),
  });

  await audit(req, 'PAYOUT_CANCELLED', 'PAYOUT', payout_id, { claim_id: payout.claim_id, reason });

  res.json(cancelled);
}));

export { router as payoutsRouter };
