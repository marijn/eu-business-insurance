import {
  BusinessDetails,
  Coverage,
  Currency,
  Exclusion,
  PolicyType,
  Premium,
  PremiumAdjustment,
  RatingProfile,
  UnderwritingRequirement,
} from '../types';
import { badRequest } from '../middleware/errorHandler';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const EU_VAT_RATES: Record<string, number> = {
  AT: 0.2, BE: 0.21, BG: 0.2, HR: 0.25, CY: 0.19, CZ: 0.21, DK: 0.25, EE: 0.24,
  FI: 0.255, FR: 0.2, DE: 0.19, GR: 0.24, HU: 0.27, IE: 0.23, IT: 0.22, LV: 0.21,
  LT: 0.21, LU: 0.17, MT: 0.18, NL: 0.21, PL: 0.23, PT: 0.23, RO: 0.21, SK: 0.23,
  SI: 0.22, ES: 0.21, SE: 0.25,
};

export const MINIMUM_NET_PREMIUM = 500;

export const UNDERWRITING_LIMITS = {
  minPerClaim: 1_000_000,
  maxDeductible: 50_000,
};

export function getUnderwritingRules(policyType: PolicyType, country: string) {
  return [
    {
      code: 'MIN_COVERAGE',
      description: `Minimum coverage limit of EUR ${UNDERWRITING_LIMITS.minPerClaim.toLocaleString('en-US')} per claim for ${policyType} in ${country}`,
      is_mandatory: true,
    },
    {
      code: 'MAX_DEDUCTIBLE',
      description: `Maximum deductible of EUR ${UNDERWRITING_LIMITS.maxDeductible.toLocaleString('en-US')} for ${policyType} in ${country}`,
      is_mandatory: true,
    },
    {
      code: 'EU_JURISDICTION',
      description: `Policyholder must be established in an EU member state (${country} is ${isEuCountry(country) ? 'eligible' : 'not eligible'})`,
      is_mandatory: true,
    },
  ];
}

export function isEuCountry(country: string): boolean {
  return country in EU_VAT_RATES;
}

export function assertCoverageAllowed(coverage: Pick<Coverage, 'limits' | 'deductible'>, field: string): void {
  if (coverage.limits.per_claim < UNDERWRITING_LIMITS.minPerClaim) {
    throw badRequest(
      `Per-claim limit must be at least ${UNDERWRITING_LIMITS.minPerClaim} (rule MIN_COVERAGE)`,
      `${field}.limits.per_claim`
    );
  }
  if (coverage.limits.aggregate !== undefined && coverage.limits.aggregate < coverage.limits.per_claim) {
    throw badRequest('Aggregate limit cannot be lower than the per-claim limit', `${field}.limits.aggregate`);
  }
  if (coverage.deductible > UNDERWRITING_LIMITS.maxDeductible) {
    throw badRequest(
      `Deductible cannot exceed ${UNDERWRITING_LIMITS.maxDeductible} (rule MAX_DEDUCTIBLE)`,
      `${field}.deductible`
    );
  }
}

export function assertEuCountry(country: string, field: string): void {
  if (!isEuCountry(country)) {
    throw badRequest(`Country ${country} is not an EU member state (rule EU_JURISDICTION)`, field);
  }
}

export function profileFromBusinessDetails(details: BusinessDetails): RatingProfile {
  return {
    country: details.country,
    industry: details.industry,
    revenue: details.revenue,
    employee_count: details.employee_count,
    cyber: details.cyber_risk_factors,
    dno: details.dno_risk_factors,
    surety: details.surety_risk_factors,
    workers_comp: details.workers_comp_risk_factors,
  };
}

export function profileFromUnderwritingData(data: Record<string, any>, country: string): RatingProfile {
  const pick = <T extends object>(nested: T | undefined, keys: Array<keyof T>): T | undefined => {
    const flat: Partial<T> = {};
    for (const key of keys) {
      if (data[key as string] !== undefined) flat[key] = data[key as string];
    }
    const merged = { ...flat, ...(nested || {}) } as T;
    return Object.keys(merged).length ? merged : undefined;
  };
  return {
    country,
    industry: data.industry,
    revenue: data.revenue,
    employee_count: data.employee_count,
    cyber: pick(data.cyber_risk_factors, ['has_mfa', 'has_encryption', 'cloud_provider', 'incident_history']),
    dno: pick(data.dno_risk_factors, ['governance_score', 'past_litigation', 'board_size']),
    surety: pick(data.surety_risk_factors, ['financial_strength', 'project_size', 'past_defaults']),
    workers_comp: pick(data.workers_comp_risk_factors, ['safety_training', 'industry_risk_level', 'past_claims']),
  };
}

const RISK_FACTOR: Record<PolicyType, PremiumAdjustment['factor']> = {
  CYBER: 'SECURITY',
  DNO: 'GOVERNANCE',
  SURETY: 'OTHER',
  WORKERS_COMP: 'SAFETY',
};

export function baselineRequirements(policyType: PolicyType, country?: string): UnderwritingRequirement[] {
  switch (policyType) {
    case 'CYBER':
      return country === 'DE' ? ['CYBER_TRAINING', 'ANNUAL_AUDIT'] : ['CYBER_TRAINING'];
    case 'DNO':
      return ['FINANCIAL_STATEMENTS', 'ANNUAL_AUDIT'];
    case 'SURETY':
      return ['FINANCIAL_STATEMENTS'];
    case 'WORKERS_COMP':
      return ['SAFETY_INSPECTION'];
  }
}

export interface Assessment {
  risk_score: number;
  premium_base: number;
  premium_adjustments: PremiumAdjustment[];
  final_premium: number;
  requirements: UnderwritingRequirement[];
  exclusions: Exclusion[];
  recommendations: string[];
}

export function assess(
  policyType: PolicyType,
  profile: RatingProfile,
  coverage?: Pick<Coverage, 'limits' | 'deductible' | 'add_ons'>
): Assessment {
  let riskScore = 0;
  let base = 0;
  switch (policyType) {
    case 'CYBER':
      riskScore = 0.3;
      if ((profile.revenue || 0) > 10_000_000) riskScore += 0.1;
      if (profile.industry === 'FINANCE') riskScore += 0.1;
      if (profile.cyber) {
        if (!profile.cyber.has_mfa) riskScore += 0.1;
        if (!profile.cyber.has_encryption) riskScore += 0.1;
        if (profile.cyber.incident_history?.length) riskScore += 0.2;
      }
      base = (profile.revenue || 0) * 0.001;
      break;
    case 'DNO':
      riskScore = 0.4;
      if ((profile.revenue || 0) > 50_000_000) riskScore += 0.1;
      if (profile.dno?.governance_score !== undefined && profile.dno.governance_score < 7) riskScore += 0.2;
      if (profile.dno?.past_litigation) riskScore += 0.2;
      base = (profile.revenue || 0) * 0.0005;
      break;
    case 'SURETY':
      riskScore = 0.5;
      if (profile.surety?.financial_strength === 'POOR') riskScore += 0.3;
      if ((profile.surety?.past_defaults || 0) > 0) riskScore += 0.2;
      base = (profile.surety?.project_size ?? profile.revenue ?? 0) * 0.002;
      break;
    case 'WORKERS_COMP':
      riskScore = 0.3;
      if (profile.workers_comp?.industry_risk_level === 'HIGH') riskScore += 0.2;
      if ((profile.workers_comp?.past_claims || 0) > 5) riskScore += 0.2;
      if (!profile.workers_comp?.safety_training) riskScore += 0.1;
      base = (profile.employee_count || 0) * 500;
      break;
  }
  riskScore = round2(Math.min(Math.max(riskScore, 0), 1));

  const adjustments: PremiumAdjustment[] = [];
  if (riskScore > 0.5) {
    adjustments.push({ factor: RISK_FACTOR[policyType], multiplier: round2(riskScore - 0.5), reason: 'High risk score' });
  }
  if (profile.industry === 'FINANCE' || profile.industry === 'HEALTHCARE') {
    adjustments.push({ factor: 'INDUSTRY', multiplier: 0.1, reason: 'High-risk industry' });
  }
  if ((profile.revenue || 0) > 10_000_000) {
    adjustments.push({ factor: 'REVENUE', multiplier: 0.05, reason: 'High revenue' });
  }

  let deductibleFactor = 1;
  if (coverage) {
    base += coverage.limits.per_claim * 0.001 + (coverage.add_ons?.length || 0) * 100;
    deductibleFactor = 1 - Math.min(coverage.deductible / coverage.limits.per_claim, 0.2);
  }
  const multiplier = 1 + adjustments.reduce((sum, adj) => sum + adj.multiplier, 0);
  const net = Math.max(round2(base * multiplier * deductibleFactor), MINIMUM_NET_PREMIUM);

  const requirements = new Set(baselineRequirements(policyType, profile.country));
  if (policyType === 'CYBER' && (profile.revenue || 0) > 5_000_000) requirements.add('ANNUAL_AUDIT');
  if (policyType === 'SURETY' && profile.surety?.financial_strength === 'POOR') requirements.add('ANNUAL_AUDIT');

  const recommendations: string[] = [];
  if (riskScore > 0.6) recommendations.push('Implement additional risk controls');
  if (policyType === 'CYBER' && !profile.cyber?.has_mfa) recommendations.push('Implement multi-factor authentication');
  if (policyType === 'DNO' && profile.dno?.governance_score !== undefined && profile.dno.governance_score < 8) {
    recommendations.push('Improve corporate governance practices');
  }
  if (policyType === 'WORKERS_COMP' && !profile.workers_comp?.safety_training) {
    recommendations.push('Introduce safety training');
  }

  return {
    risk_score: riskScore,
    premium_base: round2(base),
    premium_adjustments: adjustments,
    final_premium: net,
    requirements: [...requirements],
    exclusions: riskScore > 0.8 ? ['TERRORISM'] : [],
    recommendations,
  };
}

export function buildPremium(net: number, country: string, currency: Currency = 'EUR'): Premium {
  const rate = EU_VAT_RATES[country] ?? 0;
  const vat = round2(net * rate);
  return {
    gross: round2(net + vat),
    net: round2(net),
    taxes: rate ? [{ type: 'VAT', rate, amount: vat }] : [],
    currency,
  };
}
