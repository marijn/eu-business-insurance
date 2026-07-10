import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  Claim,
  ClaimList,
  ClaimRequest,
  ClaimUpdate,
  ClaimHistory,
  Adjudication,
  AdjudicationRequest,
  Document,
  AssignClaimRequest,
  InvestigationRequest,
  AppealRequest,
  ClaimStatus,
  AdjudicationDecision,
  IncidentType,
  ClaimantType,
  Currency,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class ClaimsManagementClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async submitClaim(request: ClaimRequest): Promise<APIResponse<Claim>> {
    return this.post<Claim>('/claims', request);
  }

  public async listClaims(options: {
    business_id?: string;
    policy_id?: string;
    status?: ClaimStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<APIResponse<ClaimList>> {
    const params: Record<string, unknown> = {};
    
    if (options.business_id) params.business_id = options.business_id;
    if (options.policy_id) params.policy_id = options.policy_id;
    if (options.status) params.status = options.status;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;

    return this.get<ClaimList>('/claims', params);
  }

  public async getClaim(claimId: string): Promise<APIResponse<Claim>> {
    return this.get<Claim>(`/claims/${claimId}`);
  }

  public async updateClaim(
    claimId: string,
    request: ClaimUpdate
  ): Promise<APIResponse<Claim>> {
    return this.patch<Claim>(`/claims/${claimId}`, request);
  }

  public async uploadClaimDocument(
    claimId: string,
    file: Blob | Buffer,
    type: 'INCIDENT_REPORT' | 'MEDICAL_REPORT' | 'POLICE_REPORT' | 'INVOICE' | 'OTHER',
    description?: string
  ): Promise<APIResponse<Document>> {
    const formData = new FormData();
    formData.append('file', file instanceof Blob ? file : new Blob([new Uint8Array(file)]), 'document');
    formData.append('type', type);
    if (description) {
      formData.append('description', description);
    }

    return this.post<Document>(`/claims/${claimId}/documents`, formData, {}, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  public async assignClaim(
    claimId: string,
    request: AssignClaimRequest
  ): Promise<APIResponse<Claim>> {
    return this.post<Claim>(`/claims/${claimId}/assign`, request);
  }

  public async requestInvestigation(
    claimId: string,
    request: InvestigationRequest
  ): Promise<APIResponse<Claim>> {
    return this.post<Claim>(`/claims/${claimId}/investigate`, request);
  }

  public async adjudicateClaim(
    claimId: string,
    request: AdjudicationRequest
  ): Promise<APIResponse<Adjudication>> {
    return this.post<Adjudication>(`/claims/${claimId}/adjudicate`, request);
  }

  public async appealClaim(
    claimId: string,
    request: AppealRequest
  ): Promise<APIResponse<Claim>> {
    return this.post<Claim>(`/claims/${claimId}/appeal`, request);
  }

  public async getClaimHistory(claimId: string): Promise<APIResponse<ClaimHistory>> {
    return this.get<ClaimHistory>(`/claims/${claimId}/history`);
  }

  public async submitAndAssignClaim(
    request: ClaimRequest,
    adjusterId: string
  ): Promise<APIResponse<Claim>> {
    const claimResponse = await this.submitClaim(request);
    return this.assignClaim(claimResponse.data.id, { adjuster_id: adjusterId });
  }

  public async getClaimsForBusiness(businessId: string): Promise<APIResponse<ClaimList>> {
    return this.listClaims({ business_id: businessId });
  }

  public async getClaimsForPolicy(policyId: string): Promise<APIResponse<ClaimList>> {
    return this.listClaims({ policy_id: policyId });
  }

  public async getClaimsByStatus(status: ClaimStatus): Promise<APIResponse<ClaimList>> {
    return this.listClaims({ status });
  }

  public async getSubmittedClaims(): Promise<APIResponse<ClaimList>> {
    return this.getClaimsByStatus('SUBMITTED');
  }

  public async getClaimsForAdjuster(adjusterId: string): Promise<Claim[]> {
    const response = await this.listClaims();
    return response.data.claims.filter(claim => claim.assigned_adjuster === adjusterId);
  }

  public async getClaimsByType(incidentType: IncidentType): Promise<Claim[]> {
    const response = await this.listClaims();
    return response.data.claims.filter(claim => claim.incident.type === incidentType);
  }

  public async getClaimsByClaimantType(claimantType: ClaimantType): Promise<Claim[]> {
    const response = await this.listClaims();
    return response.data.claims.filter(claim => claim.claimant.type === claimantType);
  }

  public async approveClaim(
    claimId: string,
    options: {
      payout_amount: number;
      currency?: Currency;
      deductible_applied?: number;
      reason?: string;
      exclusions?: string[];
      conditions?: string[];
      adjudicator_id: string;
    }
  ): Promise<APIResponse<Adjudication>> {
    return this.adjudicateClaim(claimId, {
      decision: 'APPROVE' as AdjudicationDecision,
      payout_amount: options.payout_amount,
      currency: options.currency,
      deductible_applied: options.deductible_applied,
      reason: options.reason || 'Claim approved',
      exclusions: options.exclusions,
      conditions: options.conditions,
      adjudicator_id: options.adjudicator_id,
    });
  }

  public async denyClaim(
    claimId: string,
    options: {
      reason: string;
      exclusions?: string[];
      adjudicator_id: string;
    }
  ): Promise<APIResponse<Adjudication>> {
    return this.adjudicateClaim(claimId, {
      decision: 'DENY' as AdjudicationDecision,
      reason: options.reason,
      exclusions: options.exclusions,
      adjudicator_id: options.adjudicator_id,
    });
  }

  public async partiallyApproveClaim(
    claimId: string,
    options: {
      payout_amount: number;
      currency?: Currency;
      deductible_applied?: number;
      reason?: string;
      exclusions?: string[];
      conditions?: string[];
      adjudicator_id: string;
    }
  ): Promise<APIResponse<Adjudication>> {
    return this.adjudicateClaim(claimId, {
      decision: 'PARTIAL_APPROVE' as AdjudicationDecision,
      payout_amount: options.payout_amount,
      currency: options.currency,
      deductible_applied: options.deductible_applied,
      reason: options.reason || 'Partial approval',
      exclusions: options.exclusions,
      conditions: options.conditions,
      adjudicator_id: options.adjudicator_id,
    });
  }

  public async getClaimsNeedingAttention(): Promise<Claim[]> {
    const response = await this.listClaims();
    const attentionStatuses: ClaimStatus[] = ['SUBMITTED', 'ASSIGNED', 'INVESTIGATING', 'ADJUDICATING'];
    return response.data.claims.filter(claim => attentionStatuses.includes(claim.status));
  }

  public async getApprovedUnpaidClaims(): Promise<Claim[]> {
    const response = await this.listClaims();
    return response.data.claims.filter(
      claim => (claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED') && !claim.closed_at
    );
  }
}

export function createClaimsManagementClient(config: BaseClientConfig = {}): ClaimsManagementClient {
  return new ClaimsManagementClient(config);
}
