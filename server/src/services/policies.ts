import { Request } from 'express';
import { storage } from '../storage';
import { badRequest } from '../middleware/errorHandler';
import { Agreement, Coverage, Exclusion, Policy, PolicyChange, Premium } from '../types';
import { clock } from '../utils/clock';
import { audit } from './audit';
import { assess, assertCoverageAllowed, buildPremium } from './pricing';

export async function reprice(policy: Policy, coverage: Coverage) {
  const profile = (await storage.getRatingProfile(policy.id))!;
  const assessment = assess(policy.policy_type, profile, coverage);
  return {
    premium: buildPremium(assessment.final_premium, profile.country, policy.premium.currency),
    exclusions: [...new Set([...(coverage.exclusions || []), ...assessment.exclusions])] as Exclusion[],
  };
}

export async function endorse(policy: Policy, changes: PolicyChange[]): Promise<{ coverage: Coverage; term: Policy['term']; premium: Premium }> {
  const coverage: Coverage = structuredClone(policy.coverage);
  const term = { ...policy.term };
  applyPolicyChanges(coverage, term, changes);
  assertCoverageAllowed(coverage, 'changes');
  if (term.start_date >= term.end_date) {
    throw badRequest('Term end_date must be after start_date', 'changes');
  }
  const { premium, exclusions } = await reprice(policy, coverage);
  coverage.exclusions = exclusions;
  return { coverage, term, premium };
}

export async function agreementSigned(req: Request | undefined, agreement: Agreement): Promise<void> {
  const policy = await storage.getPolicy(agreement.policy_id!);
  if (!policy) return;
  const now = clock.now().toISOString();

  if (agreement.endorsement_id) {
    const endorsement = policy.endorsements?.find((e) => e.id === agreement.endorsement_id);
    if (!endorsement || endorsement.status !== 'PENDING' || endorsement.agreement_id !== agreement.id || policy.status !== 'ACTIVE') return;
    const { coverage, term, premium } = await endorse(policy, endorsement.changes);
    await storage.updatePolicy(policy.id, {
      coverage,
      term,
      premium,
      endorsements: policy.endorsements!.map((e) => (e === endorsement ? { ...e, status: 'ACTIVE' } : e)),
      updated_at: now,
    });
    await audit(req, 'ENDORSEMENT_APPLIED', 'POLICY', policy.id, {
      endorsement_id: endorsement.id,
      agreement_id: agreement.id,
      premium_before: policy.premium.gross,
      premium_after: premium.gross,
    });
    return;
  }

  if (policy.status !== 'PENDING' || policy.agreement_id !== agreement.id) return;
  await storage.updatePolicy(policy.id, { status: 'ACTIVE', updated_at: now });
  await audit(req, 'POLICY_ACTIVATED', 'POLICY', policy.id, { agreement_id: agreement.id });

  const renewed = policy.renewed_from ? await storage.getPolicy(policy.renewed_from) : undefined;
  if (renewed && (renewed.status === 'ACTIVE' || renewed.status === 'EXPIRED')) {
    await storage.updatePolicy(renewed.id, { status: 'RENEWED', updated_at: now });
  }
}

export async function agreementRejected(req: Request | undefined, agreement: Agreement): Promise<void> {
  if (!agreement.endorsement_id) return;
  const policy = await storage.getPolicy(agreement.policy_id!);
  const endorsement = policy?.endorsements?.find((e) => e.id === agreement.endorsement_id);
  if (!policy || !endorsement || endorsement.status !== 'PENDING' || endorsement.agreement_id !== agreement.id) return;
  await storage.updatePolicy(policy.id, {
    endorsements: policy.endorsements!.map((e) => (e === endorsement ? { ...e, status: 'CANCELLED' } : e)),
    updated_at: clock.now().toISOString(),
  });
  await audit(req, 'ENDORSEMENT_CANCELLED', 'POLICY', policy.id, { endorsement_id: endorsement.id, agreement_id: agreement.id });
}

export function applyPolicyChanges(coverage: Coverage, term: Policy['term'], changes: PolicyChange[]): void {
  for (const change of changes) {
    switch (change.type) {
      case 'COVERAGE_LIMIT': {
        const value = Number(change.new_value);
        if (!change.new_value || Number.isNaN(value)) throw badRequest('COVERAGE_LIMIT requires a numeric new_value', 'changes');
        if (change.field === 'per_claim') coverage.limits.per_claim = value;
        else if (change.field === 'aggregate') coverage.limits.aggregate = value;
        else throw badRequest('COVERAGE_LIMIT field must be per_claim or aggregate', 'changes');
        break;
      }
      case 'DEDUCTIBLE': {
        const value = Number(change.new_value);
        if (!change.new_value || Number.isNaN(value)) throw badRequest('DEDUCTIBLE requires a numeric new_value', 'changes');
        coverage.deductible = value;
        break;
      }
      case 'ADD_ON':
        if (!change.code) throw badRequest('ADD_ON requires a code', 'changes');
        if (change.action === 'ADD' && !coverage.add_ons.includes(change.code)) coverage.add_ons.push(change.code);
        else if (change.action === 'REMOVE') coverage.add_ons = coverage.add_ons.filter(a => a !== change.code);
        break;
      case 'EXCLUSION':
        if (!change.code) throw badRequest('EXCLUSION requires a code', 'changes');
        coverage.exclusions = coverage.exclusions || [];
        if (change.action === 'ADD' && !coverage.exclusions.includes(change.code as Exclusion)) {
          coverage.exclusions.push(change.code as Exclusion);
        } else if (change.action === 'REMOVE') {
          coverage.exclusions = coverage.exclusions.filter(e => e !== change.code);
        }
        break;
      case 'TERM':
        if (!change.new_value || !/^\d{4}-\d{2}-\d{2}$/.test(change.new_value)) {
          throw badRequest('TERM requires a YYYY-MM-DD new_value', 'changes');
        }
        if (change.field === 'start_date') term.start_date = change.new_value;
        else if (change.field === 'end_date') term.end_date = change.new_value;
        else throw badRequest('TERM field must be start_date or end_date', 'changes');
        break;
      case 'ADDRESS':
        break;
    }
  }
}
