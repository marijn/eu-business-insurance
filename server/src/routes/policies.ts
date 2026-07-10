import { Router } from 'express';
import { generateId } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import {
  validateSchema,
  endorsementRequestSchema,
  renewPolicyRequestSchema,
  cancelPolicyRequestSchema,
  paginate,
} from '../utils/validation';
import { Endorsement, Policy, PolicyList, Coverage } from '../types';
import { clock, today, addDays } from '../utils/clock';
import { audit } from '../services/audit';
import { generateAgreement } from '../services/agreements';
import { assertCoverageAllowed } from '../services/pricing';
import { applyPolicyChanges, endorse, reprice } from '../services/policies';
import { refreshPolicy } from '../services/lifecycle';

const router = Router();

async function getPolicyOr404(policyId: string): Promise<Policy> {
  const policy = await storage.getPolicy(policyId);
  if (!policy) throw notFound('Policy');
  return await refreshPolicy(policy);
}

router.get('/', asyncHandler(async (req, res) => {
  const { business_id, policy_type, status } = req.query;

  let policies: Policy[] = [];
  for (const policy of await storage.listPolicies()) policies.push(await refreshPolicy(policy));
  if (business_id) policies = policies.filter(p => p.business_id === business_id);
  if (policy_type) policies = policies.filter(p => p.policy_type === policy_type);
  if (status) policies = policies.filter(p => p.status === status);

  const { page, total, limit, offset } = paginate(policies, req.query);
  const result: PolicyList = { policies: page, total, limit, offset };
  res.json(result);
}));

router.get('/:policy_id', asyncHandler(async (req, res) => {
  res.json(await getPolicyOr404(req.params.policy_id));
}));

router.get('/:policy_id/coverage', asyncHandler(async (req, res) => {
  res.json((await getPolicyOr404(req.params.policy_id)).coverage);
}));

router.patch('/:policy_id', asyncHandler(async (req, res) => {
  const { policy_id } = req.params;
  const endorsementRequest = validateSchema(endorsementRequestSchema, req.body);
  const policy = await getPolicyOr404(policy_id);

  if (policy.status !== 'ACTIVE') {
    throw badRequest(`Only ACTIVE policies can be endorsed (policy is ${policy.status})`);
  }
  const { effective_date } = endorsementRequest;
  if (effective_date < policy.term.start_date || effective_date >= policy.term.end_date) {
    throw badRequest('effective_date must fall within the policy term', 'effective_date');
  }
  if (policy.endorsements?.some((e) => e.status === 'PENDING')) {
    throw badRequest('The policy already has an endorsement awaiting signature');
  }

  const { premium } = await endorse(policy, endorsementRequest.changes);

  const endorsement: Endorsement = {
    id: generateId('endorsement'),
    policy_id,
    changes: endorsementRequest.changes,
    effective_date,
    status: 'PENDING',
    reason: endorsementRequest.reason,
    created_at: clock.now().toISOString(),
  };

  await storage.updatePolicy(policy_id, {
    endorsements: [...(policy.endorsements || []), endorsement],
    updated_at: clock.now().toISOString(),
  });

  await audit(req, 'POLICY_ENDORSED', 'POLICY', policy_id, {
    endorsement_id: endorsement.id,
    changes: endorsement.changes,
    premium_before: policy.premium.gross,
    premium_after: premium.gross,
  });

  await generateAgreement(req, {
    policyId: policy_id,
    endorsementId: endorsement.id,
    templateId: `${policy.policy_type}_ENDORSEMENT_v1`,
  });

  res.json(await storage.getPolicy(policy_id));
}));

router.post('/:policy_id', asyncHandler(async (req, res) => {
  const { policy_id } = req.params;
  const { term, changes } = validateSchema(renewPolicyRequestSchema, req.body ?? {});
  const policy = await getPolicyOr404(policy_id);

  if (policy.status !== 'ACTIVE' && policy.status !== 'EXPIRED') {
    throw badRequest(`Only ACTIVE or EXPIRED policies can be renewed (policy is ${policy.status})`);
  }
  if ((await storage.listPolicies()).some((p) => p.renewed_from === policy_id && p.status === 'PENDING')) {
    throw badRequest('The policy already has a renewal awaiting signature');
  }

  const startDate = term?.start_date || policy.term.end_date;
  const endDate = term?.end_date || addDays(startDate, 365).toISOString().split('T')[0];
  if (startDate >= endDate) {
    throw badRequest('Term end_date must be after start_date', 'term.end_date');
  }

  const coverage: Coverage = structuredClone(policy.coverage);
  const renewedTerm = { start_date: startDate, end_date: endDate };
  if (changes) applyPolicyChanges(coverage, renewedTerm, changes);
  assertCoverageAllowed(coverage, 'changes');

  const newPolicyId = generateId('policy');
  await storage.setRatingProfile(newPolicyId, (await storage.getRatingProfile(policy_id))!);

  const now = clock.now().toISOString();
  const renewedPolicy: Policy = {
    id: newPolicyId,
    business_id: policy.business_id,
    policy_type: policy.policy_type,
    status: 'PENDING',
    premium: policy.premium,
    coverage,
    term: renewedTerm,
    invoices: [],
    endorsements: [],
    renewed_from: policy_id,
    created_at: now,
    updated_at: now,
  };
  const { premium, exclusions } = await reprice(renewedPolicy, coverage);
  renewedPolicy.premium = premium;
  renewedPolicy.coverage.exclusions = exclusions;

  await storage.createPolicy(renewedPolicy);

  await audit(req, 'POLICY_RENEWED', 'POLICY', newPolicyId, {
    renewed_from: policy_id,
    premium: renewedPolicy.premium.gross,
  });

  await generateAgreement(req, { policyId: newPolicyId, templateId: `${policy.policy_type}_POLICY_v1` });

  res.json(await storage.getPolicy(newPolicyId));
}));

router.delete('/:policy_id', asyncHandler(async (req, res) => {
  const { policy_id } = req.params;
  const { reason, effective_date } = validateSchema(cancelPolicyRequestSchema, req.body ?? {});
  const policy = await getPolicyOr404(policy_id);

  if (policy.status !== 'ACTIVE' && policy.status !== 'PENDING') {
    throw badRequest(`Policy is ${policy.status} and cannot be cancelled`);
  }
  const cancellationDate = effective_date || today();
  if (cancellationDate < policy.term.start_date) {
    throw badRequest('effective_date cannot be before the policy start date', 'effective_date');
  }

  const updated = await storage.updatePolicy(policy_id, {
    status: 'CANCELLED',
    cancellation: { reason, effective_date: cancellationDate },
    updated_at: clock.now().toISOString(),
  });

  await audit(req, 'POLICY_CANCELLED', 'POLICY', policy_id, { reason, effective_date: cancellationDate });

  res.json(updated);
}));

export { router as policiesRouter };
