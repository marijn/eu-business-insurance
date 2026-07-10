import { Router, Request } from 'express';
import { createHash } from 'crypto';
import { generateId, generateClaimNumber } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import { authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  validateSchema,
  claimRequestSchema,
  claimUpdateSchema,
  adjudicationRequestSchema,
  assignClaimRequestSchema,
  investigationRequestSchema,
  appealRequestSchema,
  claimDocumentUploadSchema,
  paginate,
} from '../utils/validation';
import {
  Adjudication,
  AuditLogEntry,
  Claim,
  ClaimHistoryAction,
  ClaimHistoryEntry,
  ClaimList,
  ClaimStatus,
  Document,
  DocumentReference,
  MimeType,
} from '../types';
import { clock } from '../utils/clock';
import { actorId, audit } from '../services/audit';
import { refreshClaim, settleDuePayouts } from '../services/lifecycle';

const router = Router();

const PRE_DECISION: ClaimStatus[] = ['SUBMITTED', 'ASSIGNED', 'INVESTIGATING', 'ADJUDICATING', 'APPEALED'];

const PATCH_TRANSITIONS: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  ADJUDICATING: ['ASSIGNED', 'INVESTIGATING'],
  CLOSED: ['DENIED', 'PAID'],
};

async function getClaimOr404(claimId: string): Promise<Claim> {
  const claim = await storage.getClaim(claimId);
  if (!claim) throw notFound('Claim');
  return await refreshClaim(claim);
}

function assertStatus(claim: Claim, allowed: ClaimStatus[], action: string): void {
  if (!allowed.includes(claim.status)) {
    throw badRequest(`Cannot ${action} a claim with status ${claim.status}`);
  }
}

const MIME_TYPES: MimeType[] = ['application/pdf', 'application/json', 'text/plain', 'image/jpeg', 'image/png'];

async function documentFromReference(claimId: string, ref: DocumentReference): Promise<Document> {
  return await storage.createDocument({
    id: generateId('document'),
    entity_type: 'CLAIM',
    entity_id: claimId,
    type: ref.type,
    file_name: ref.url.split('/').pop() || 'document',
    mime_type: 'application/pdf',
    size: 0,
    url: ref.url,
    retention_policy: '7_YEARS',
    created_at: clock.now().toISOString(),
  });
}

async function documentsFromReferences(claimId: string, refs: DocumentReference[]): Promise<Document[]> {
  const documents: Document[] = [];
  for (const ref of refs) documents.push(await documentFromReference(claimId, ref));
  return documents;
}

function addNote(claim: Claim, req: Request, content: string, isInternal: boolean): void {
  claim.notes = [
    ...(claim.notes || []),
    { content, created_at: clock.now().toISOString(), author: actorId(req), is_internal: isInternal },
  ];
}

router.post('/', asyncHandler(async (req, res) => {
  const claimRequest = validateSchema(claimRequestSchema, req.body);

  const policy = await storage.getPolicy(claimRequest.policy_id);
  if (!policy) throw notFound('Policy');
  if (policy.status === 'PENDING') {
    throw badRequest(`Policy is ${policy.status} and does not provide coverage`, 'policy_id');
  }

  const incidentDate = claimRequest.incident.date.split('T')[0];
  if (new Date(claimRequest.incident.date) > clock.now()) {
    throw badRequest('Incident date cannot be in the future', 'incident.date');
  }
  const coverageStart = policy.term.start_date;
  const coverageEnd = policy.cancellation && policy.cancellation.effective_date < policy.term.end_date
    ? policy.cancellation.effective_date
    : policy.term.end_date;
  if (incidentDate < coverageStart || incidentDate > coverageEnd) {
    throw badRequest(`Incident date is outside the policy's coverage period ${coverageStart}..${coverageEnd}`, 'incident.date');
  }

  const claimId = generateId('claim');
  const now = clock.now().toISOString();
  const claim: Claim = {
    id: claimId,
    policy_id: claimRequest.policy_id,
    claim_number: generateClaimNumber(),
    claimant: claimRequest.claimant,
    incident: claimRequest.incident,
    status: 'SUBMITTED',
    assigned_adjuster: null,
    estimated_loss: claimRequest.incident.estimated_loss,
    actual_loss: null,
    documents: await documentsFromReferences(claimId, claimRequest.documents || []),
    notes: [],
    created_at: now,
    updated_at: now,
    closed_at: null,
  };
  if (claimRequest.notes) addNote(claim, req, claimRequest.notes, false);

  await storage.createClaim(claim);

  await audit(req, 'CLAIM_SUBMITTED', 'CLAIM', claimId, {
    policy_id: claimRequest.policy_id,
    incident_type: claimRequest.incident.type,
    estimated_loss: claimRequest.incident.estimated_loss,
  });

  res.status(201).json(claim);
}));

router.get('/', asyncHandler(async (req, res) => {
  const { business_id, policy_id, status } = req.query;

  await settleDuePayouts();
  const policies = new Map((await storage.listPolicies()).map(p => [p.id, p]));
  let claims = await storage.listClaims();
  if (business_id) claims = claims.filter(c => policies.get(c.policy_id)?.business_id === business_id);
  if (policy_id) claims = claims.filter(c => c.policy_id === policy_id);
  if (status) claims = claims.filter(c => c.status === status);

  const { page, total, limit, offset } = paginate(claims, req.query);
  const result: ClaimList = { claims: page, total, limit, offset };
  res.json(result);
}));

router.get('/:claim_id', asyncHandler(async (req, res) => {
  res.json(await getClaimOr404(req.params.claim_id));
}));

router.patch('/:claim_id', asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  const claimUpdate = validateSchema(claimUpdateSchema, req.body);
  const claim = await getClaimOr404(claim_id);

  if (claim.status === 'CLOSED') throw badRequest('Closed claims cannot be updated');

  const previousStatus = claim.status;
  if (claimUpdate.status && claimUpdate.status !== claim.status) {
    const allowedFrom = PATCH_TRANSITIONS[claimUpdate.status];
    if (!allowedFrom?.includes(claim.status)) {
      throw badRequest(
        `Cannot change status from ${claim.status} to ${claimUpdate.status} via update; use the dedicated endpoint`,
        'status'
      );
    }
    claim.status = claimUpdate.status;
    if (claim.status === 'CLOSED') claim.closed_at = clock.now().toISOString();
  }

  const lossesEditable = PRE_DECISION.includes(previousStatus);
  if (claimUpdate.estimated_loss !== undefined || claimUpdate.actual_loss !== undefined) {
    if (!lossesEditable) throw badRequest('Losses can only be changed before the claim is decided');
    if (claimUpdate.estimated_loss !== undefined) claim.estimated_loss = claimUpdate.estimated_loss;
    if (claimUpdate.actual_loss !== undefined) claim.actual_loss = claimUpdate.actual_loss;
  }
  if (claimUpdate.notes) addNote(claim, req, claimUpdate.notes, false);
  if (claimUpdate.documents) {
    claim.documents = [
      ...(claim.documents || []),
      ...await documentsFromReferences(claim_id, claimUpdate.documents),
    ];
  }
  claim.updated_at = clock.now().toISOString();
  await storage.updateClaim(claim_id, claim);

  if ((claim.status as ClaimStatus) === 'CLOSED') {
    await audit(req, 'CLAIM_CLOSED', 'CLAIM', claim_id, { previous_status: previousStatus });
  } else {
    await audit(req, 'CLAIM_UPDATED', 'CLAIM', claim_id, {
      fields: Object.keys(claimUpdate),
      status: claim.status !== previousStatus ? claim.status : undefined,
    });
  }

  res.json(claim);
}));

router.post('/:claim_id/documents', upload.single('file'), asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  const { type, description } = validateSchema(claimDocumentUploadSchema, req.body ?? {});
  const claim = await getClaimOr404(claim_id);
  const file = req.file;
  if (!file) throw badRequest('file is required', 'file');
  if (claim.status === 'CLOSED') throw badRequest('Cannot add documents to a closed claim');

  const documentId = generateId('document');
  const mimeType = MIME_TYPES.includes(file.mimetype as MimeType) ? file.mimetype as MimeType : 'application/pdf';
  const document = await storage.createDocument({
    id: documentId,
    entity_type: 'CLAIM',
    entity_id: claim_id,
    type,
    file_name: file.originalname,
    mime_type: mimeType,
    size: file.size,
    url: `https://documents.insureeu.com/claim/${claim_id}/${documentId}`,
    checksum: 'sha256:' + createHash('sha256').update(file.buffer).digest('hex'),
    storage_location: 'EU_CENTRAL',
    retention_policy: '7_YEARS',
    created_at: clock.now().toISOString(),
  }, file.buffer);

  await storage.updateClaim(claim_id, {
    documents: [...(claim.documents || []), document],
    updated_at: clock.now().toISOString(),
  });

  await audit(req, 'CLAIM_DOCUMENT_ADDED', 'CLAIM', claim_id, { document_id: documentId, type, description });

  res.status(201).json(document);
}));

router.post('/:claim_id/assign', asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  const { adjuster_id, notes } = validateSchema(assignClaimRequestSchema, req.body);
  const claim = await getClaimOr404(claim_id);
  assertStatus(claim, PRE_DECISION, 'assign');

  claim.assigned_adjuster = adjuster_id;
  claim.status = 'ASSIGNED';
  claim.updated_at = clock.now().toISOString();
  if (notes) addNote(claim, req, `Assigned to adjuster ${adjuster_id}: ${notes}`, true);
  await storage.updateClaim(claim_id, claim);

  await audit(req, 'CLAIM_ASSIGNED', 'CLAIM', claim_id, { adjuster_id });

  res.json(claim);
}));

router.post('/:claim_id/investigate', asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  const { investigator_id, scope, notes } = validateSchema(investigationRequestSchema, req.body ?? {});
  const claim = await getClaimOr404(claim_id);
  assertStatus(claim, PRE_DECISION, 'investigate');

  claim.status = 'INVESTIGATING';
  claim.updated_at = clock.now().toISOString();
  if (notes) addNote(claim, req, `Investigation requested: ${notes}`, true);
  await storage.updateClaim(claim_id, claim);

  await audit(req, 'CLAIM_INVESTIGATION_REQUESTED', 'CLAIM', claim_id, { investigator_id, scope });

  res.json(claim);
}));

router.post('/:claim_id/adjudicate', authorize('claims:adjudicate'), asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  const request = validateSchema(adjudicationRequestSchema, req.body);
  const claim = await getClaimOr404(claim_id);
  assertStatus(claim, PRE_DECISION, 'adjudicate');

  const policy = (await storage.getPolicy(claim.policy_id))!;
  const { decision } = request;
  const isApproval = decision !== 'DENY';
  const deductible = request.deductible_applied ?? policy.coverage.deductible;

  if (request.currency !== policy.premium.currency) {
    throw badRequest(`Currency must match the policy currency (${policy.premium.currency})`, 'currency');
  }
  if (isApproval) {
    if (!request.payout_amount) {
      throw badRequest(`payout_amount is required for ${decision}`, 'payout_amount');
    }
    if (deductible < policy.coverage.deductible) {
      throw badRequest(`deductible_applied cannot be lower than the policy deductible (${policy.coverage.deductible})`, 'deductible_applied');
    }
    if (request.payout_amount > policy.coverage.limits.per_claim) {
      throw badRequest(`payout_amount exceeds the per-claim limit of ${policy.coverage.limits.per_claim}`, 'payout_amount');
    }
    if (policy.coverage.limits.aggregate !== undefined) {
      const otherApproved = (await storage.listClaims())
        .filter(c => c.policy_id === policy.id && c.id !== claim_id && c.adjudication && c.adjudication.decision !== 'DENY')
        .reduce((sum, c) => sum + (c.adjudication!.payout_amount || 0), 0);
      const remaining = policy.coverage.limits.aggregate - otherApproved;
      if (request.payout_amount > remaining) {
        throw badRequest(`payout_amount exceeds the remaining aggregate limit of ${remaining}`, 'payout_amount');
      }
    }
  } else if (request.payout_amount) {
    throw badRequest('A denied claim cannot have a payout_amount', 'payout_amount');
  }

  const adjudication: Adjudication = {
    id: generateId('adjudication'),
    claim_id,
    decision,
    payout_amount: isApproval ? request.payout_amount! : null,
    currency: request.currency,
    deductible_applied: isApproval ? deductible : null,
    reason: request.reason,
    exclusions: request.exclusions,
    conditions: request.conditions,
    adjudicator_id: request.adjudicator_id,
    timestamp: clock.now().toISOString(),
  };

  claim.adjudication = adjudication;
  claim.status = decision === 'APPROVE' ? 'APPROVED' : decision === 'PARTIAL_APPROVE' ? 'PARTIALLY_APPROVED' : 'DENIED';
  if (isApproval) claim.actual_loss = adjudication.payout_amount! + deductible;
  claim.updated_at = clock.now().toISOString();
  if (request.notes) addNote(claim, req, request.notes, true);
  await storage.updateClaim(claim_id, claim);

  await audit(req, 'CLAIM_ADJUDICATED', 'CLAIM', claim_id, {
    adjudication_id: adjudication.id,
    decision,
    payout_amount: adjudication.payout_amount,
    adjudicator_id: request.adjudicator_id,
  });

  res.json(adjudication);
}));

router.post('/:claim_id/appeal', asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  const { reason, documents } = validateSchema(appealRequestSchema, req.body);
  const claim = await getClaimOr404(claim_id);
  assertStatus(claim, ['DENIED', 'PARTIALLY_APPROVED'], 'appeal');

  claim.status = 'APPEALED';
  claim.updated_at = clock.now().toISOString();
  addNote(claim, req, `Appeal submitted: ${reason}`, false);
  if (documents) {
    claim.documents = [...(claim.documents || []), ...await documentsFromReferences(claim_id, documents)];
  }
  await storage.updateClaim(claim_id, claim);

  await audit(req, 'CLAIM_APPEALED', 'CLAIM', claim_id, {
    reason,
    previous_adjudication_id: claim.adjudication?.id,
  });

  res.json(claim);
}));

router.get('/:claim_id/history', asyncHandler(async (req, res) => {
  const { claim_id } = req.params;
  await getClaimOr404(claim_id);

  const history: ClaimHistoryEntry[] = (await storage.listAuditLogs())
    .filter(log => log.entity_type === 'CLAIM' && log.entity_id === claim_id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .flatMap(log => {
      const action = HISTORY_ACTIONS[log.action];
      return action ? [{ action, timestamp: log.timestamp, user_id: log.user_id, details: log.metadata }] : [];
    });

  res.json({ history });
}));

const HISTORY_ACTIONS: Partial<Record<AuditLogEntry['action'], ClaimHistoryAction>> = {
  CLAIM_SUBMITTED: 'SUBMITTED',
  CLAIM_UPDATED: 'UPDATED',
  CLAIM_DOCUMENT_ADDED: 'DOCUMENT_ADDED',
  CLAIM_ASSIGNED: 'ASSIGNED',
  CLAIM_INVESTIGATION_REQUESTED: 'INVESTIGATED',
  CLAIM_ADJUDICATED: 'ADJUDICATED',
  CLAIM_APPEALED: 'APPEALED',
  CLAIM_PAID: 'PAID',
  CLAIM_CLOSED: 'CLOSED',
};

export { router as claimsRouter };
