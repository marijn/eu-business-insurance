import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  UnderwritingRequest,
  UnderwritingResponse,
  UnderwritingRequirementsRequest,
  UnderwritingRequirementsResponse,
  UnderwritingRule,
  PolicyType,
  UnderwritingRequirement,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class UnderwritingClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async assessRisk(request: UnderwritingRequest): Promise<APIResponse<UnderwritingResponse>> {
    return this.post<UnderwritingResponse>('/underwriting/assess', request);
  }

  public async getRequirements(
    request: UnderwritingRequirementsRequest
  ): Promise<APIResponse<UnderwritingRequirementsResponse>> {
    return this.post<UnderwritingRequirementsResponse>('/underwriting/requirements', request);
  }

  public async getUnderwritingRules(
    country: string,
    policyType: PolicyType
  ): Promise<APIResponse<{ rules: UnderwritingRule[] }>> {
    return this.get<{ rules: UnderwritingRule[] }>(`/underwriting/rules/${country}/${policyType}`);
  }

  public async assessCyberRisk(options: {
    business_id: string;
    data: {
      revenue: number;
      industry: string;
      employee_count: number;
      countries_of_operation: string[];
      cyber_risk_factors: {
        has_mfa: boolean;
        has_encryption: boolean;
        cloud_provider: string;
        incident_history: Array<{
          date: string;
          severity: string;
          description: string;
        }>;
      };
    };
    country?: string;
  }): Promise<APIResponse<UnderwritingResponse>> {
    return this.assessRisk({
      policy_type: 'CYBER' as PolicyType,
      business_id: options.business_id,
      data: options.data,
      country: options.country,
    });
  }

  public async assessDNORisk(options: {
    business_id: string;
    data: {
      revenue: number;
      industry: string;
      governance_score: number;
      past_litigation: boolean;
      board_size?: number;
    };
    country?: string;
  }): Promise<APIResponse<UnderwritingResponse>> {
    return this.assessRisk({
      policy_type: 'DNO' as PolicyType,
      business_id: options.business_id,
      data: options.data,
      country: options.country,
    });
  }

  public async assessSuretyRisk(options: {
    business_id: string;
    data: {
      financial_strength: string;
      project_size: number;
      past_defaults: number;
    };
    country?: string;
  }): Promise<APIResponse<UnderwritingResponse>> {
    return this.assessRisk({
      policy_type: 'SURETY' as PolicyType,
      business_id: options.business_id,
      data: options.data,
      country: options.country,
    });
  }

  public async assessWorkersCompRisk(options: {
    business_id: string;
    data: {
      safety_training: boolean;
      industry_risk_level: string;
      past_claims: number;
      revenue: number;
      employee_count: number;
    };
    country?: string;
  }): Promise<APIResponse<UnderwritingResponse>> {
    return this.assessRisk({
      policy_type: 'WORKERS_COMP' as PolicyType,
      business_id: options.business_id,
      data: options.data,
      country: options.country,
    });
  }

  public async getRequirementsForBusiness(
    businessId: string,
    policyType: PolicyType,
    country?: string
  ): Promise<UnderwritingRequirement[]> {
    const response = await this.getRequirements({
      business_id: businessId,
      policy_type: policyType,
      country,
    });
    return response.data.requirements;
  }

  public async meetsRequirements(
    businessId: string,
    policyType: PolicyType,
    fulfilled: UnderwritingRequirement[],
    country?: string
  ): Promise<{ met: boolean; missing: UnderwritingRequirement[] }> {
    const requirements = await this.getRequirementsForBusiness(businessId, policyType, country);
    const missing = requirements.filter(requirement => !fulfilled.includes(requirement));
    return { met: missing.length === 0, missing };
  }

  public async getAllRulesForCountry(country: string): Promise<UnderwritingRule[]> {
    const policyTypes: PolicyType[] = ['CYBER', 'DNO', 'SURETY', 'WORKERS_COMP'];
    const allRules: UnderwritingRule[] = [];

    for (const policyType of policyTypes) {
      const response = await this.getUnderwritingRules(country, policyType);
      allRules.push(...response.data.rules);
    }

    return allRules;
  }

  public async getMandatoryRules(
    country: string,
    policyType: PolicyType
  ): Promise<UnderwritingRule[]> {
    const response = await this.getUnderwritingRules(country, policyType);
    return response.data.rules.filter(rule => rule.is_mandatory);
  }

  public async calculatePremium(options: {
    business_id: string;
    policy_type: PolicyType;
    coverage_amount: number;
    country?: string;
  }): Promise<number> {
    const response = await this.assessRisk({
      policy_type: options.policy_type,
      business_id: options.business_id,
      data: {
        coverage_amount: options.coverage_amount,
      },
      country: options.country,
    });
    return response.data.final_premium;
  }

  public async getRiskScore(options: {
    business_id: string;
    policy_type: PolicyType;
    country?: string;
  }): Promise<number> {
    const response = await this.assessRisk({
      policy_type: options.policy_type,
      business_id: options.business_id,
      data: {},
      country: options.country,
    });
    return response.data.risk_score;
  }
}

export function createUnderwritingClient(config: BaseClientConfig = {}): UnderwritingClient {
  return new UnderwritingClient(config);
}
