import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  Quote,
  QuoteList,
  QuoteRequest,
  Policy,
  PolicyList,
  EndorsementRequest,
  RenewPolicyRequest,
  CancelPolicyRequest,
  Coverage,
  PolicyType,
  QuoteStatus,
  PolicyStatus,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class PolicyManagementClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async createQuote(request: QuoteRequest): Promise<APIResponse<Quote>> {
    return this.post<Quote>('/quotes', request);
  }

  public async listQuotes(options: {
    business_id?: string;
    policy_type?: PolicyType;
    status?: QuoteStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<APIResponse<QuoteList>> {
    const params: Record<string, unknown> = {};
    
    if (options.business_id) params.business_id = options.business_id;
    if (options.policy_type) params.policy_type = options.policy_type;
    if (options.status) params.status = options.status;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;

    return this.get<QuoteList>('/quotes', params);
  }

  public async getQuote(quoteId: string): Promise<APIResponse<Quote>> {
    return this.get<Quote>(`/quotes/${quoteId}`);
  }

  public async bindQuote(
    quoteId: string,
    options: {
      effective_date?: string;
      notes?: string;
    } = {}
  ): Promise<APIResponse<Policy>> {
    return this.post<Policy>(`/quotes/${quoteId}`, options);
  }

  public async listPolicies(options: {
    business_id?: string;
    policy_type?: PolicyType;
    status?: PolicyStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<APIResponse<PolicyList>> {
    const params: Record<string, unknown> = {};
    
    if (options.business_id) params.business_id = options.business_id;
    if (options.policy_type) params.policy_type = options.policy_type;
    if (options.status) params.status = options.status;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;

    return this.get<PolicyList>('/policies', params);
  }

  public async getPolicy(policyId: string): Promise<APIResponse<Policy>> {
    return this.get<Policy>(`/policies/${policyId}`);
  }

  public async getCoverage(policyId: string): Promise<APIResponse<Coverage>> {
    return this.get<Coverage>(`/policies/${policyId}/coverage`);
  }

  public async endorsePolicy(
    policyId: string,
    request: EndorsementRequest
  ): Promise<APIResponse<Policy>> {
    return this.patch<Policy>(`/policies/${policyId}`, request);
  }

  public async renewPolicy(
    policyId: string,
    request: RenewPolicyRequest
  ): Promise<APIResponse<Policy>> {
    return this.post<Policy>(`/policies/${policyId}`, request);
  }

  public async cancelPolicy(
    policyId: string,
    request: CancelPolicyRequest
  ): Promise<APIResponse<Policy>> {
    return this.delete<Policy>(`/policies/${policyId}`, request);
  }

  public async createAndBindQuote(
    request: QuoteRequest,
    bindOptions: {
      effective_date?: string;
      notes?: string;
    } = {}
  ): Promise<APIResponse<Policy>> {
    const quoteResponse = await this.createQuote(request);
    return this.bindQuote(quoteResponse.data.id, bindOptions);
  }

  public async getQuotesForBusiness(businessId: string): Promise<APIResponse<QuoteList>> {
    return this.listQuotes({ business_id: businessId });
  }

  public async getPoliciesForBusiness(businessId: string): Promise<APIResponse<PolicyList>> {
    return this.listPolicies({ business_id: businessId });
  }

  public async getActivePoliciesForBusiness(businessId: string): Promise<APIResponse<PolicyList>> {
    return this.listPolicies({ 
      business_id: businessId,
      status: 'ACTIVE'
    });
  }

  public async getPoliciesByType(
    policyType: PolicyType,
    options: {
      business_id?: string;
      status?: PolicyStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<APIResponse<PolicyList>> {
    return this.listPolicies({
      ...options,
      policy_type: policyType
    });
  }
}

export function createPolicyManagementClient(config: BaseClientConfig = {}): PolicyManagementClient {
  return new PolicyManagementClient(config);
}
