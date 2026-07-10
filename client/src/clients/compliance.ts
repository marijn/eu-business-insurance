import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  AuditLogEntry,
  AuditLogList,
  GDPRErasureRequest,
  GDPRErasureResponse,
  SolvencyIIReport,
  AuditAction,
  AuditEntityType,
  Period,
  GDPREntityType,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class ComplianceClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<APIResponse<AuditLogEntry>> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    return this.post<AuditLogEntry>('/compliance/audit', auditEntry);
  }

  public async getAuditLog(actionId: string): Promise<APIResponse<AuditLogEntry>> {
    return this.get<AuditLogEntry>(`/compliance/audit/${actionId}`);
  }

  public async listAuditLogs(options: {
    entity_type?: AuditEntityType;
    entity_id?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  } = {}): Promise<APIResponse<AuditLogList>> {
    return this.get<AuditLogList>('/compliance/audit', { ...options });
  }

  public async requestErasure(request: GDPRErasureRequest): Promise<APIResponse<GDPRErasureResponse>> {
    return this.post<GDPRErasureResponse>('/compliance/gdpr/erasure', request);
  }

  public async generateSolvencyReport(options: {
    period?: Period;
    year?: number;
  } = {}): Promise<APIResponse<SolvencyIIReport>> {
    const params: Record<string, unknown> = {};
    
    if (options.period) params.period = options.period;
    if (options.year) params.year = options.year;

    return this.get<SolvencyIIReport>('/compliance/reports/solvency-ii', params);
  }

  public async logQuoteCreated(options: {
    quote_id: string;
    business_id: string;
    user_id: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'QUOTE_CREATED' as AuditAction,
      entity_type: 'QUOTE' as AuditEntityType,
      entity_id: options.quote_id,
      user_id: options.user_id,
      metadata: {
        business_id: options.business_id,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async logPolicyBound(options: {
    policy_id: string;
    quote_id: string;
    business_id: string;
    user_id: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'POLICY_BOUND' as AuditAction,
      entity_type: 'POLICY' as AuditEntityType,
      entity_id: options.policy_id,
      user_id: options.user_id,
      metadata: {
        quote_id: options.quote_id,
        business_id: options.business_id,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async logPolicyEndorsed(options: {
    policy_id: string;
    endorsement_id: string;
    user_id: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'POLICY_ENDORSED' as AuditAction,
      entity_type: 'POLICY' as AuditEntityType,
      entity_id: options.policy_id,
      user_id: options.user_id,
      metadata: {
        endorsement_id: options.endorsement_id,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async logClaimSubmitted(options: {
    claim_id: string;
    policy_id: string;
    business_id: string;
    user_id: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'CLAIM_SUBMITTED' as AuditAction,
      entity_type: 'CLAIM' as AuditEntityType,
      entity_id: options.claim_id,
      user_id: options.user_id,
      metadata: {
        policy_id: options.policy_id,
        business_id: options.business_id,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async logClaimAdjudicated(options: {
    claim_id: string;
    adjudication_id: string;
    user_id: string;
    decision: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'CLAIM_ADJUDICATED' as AuditAction,
      entity_type: 'CLAIM' as AuditEntityType,
      entity_id: options.claim_id,
      user_id: options.user_id,
      metadata: {
        adjudication_id: options.adjudication_id,
        decision: options.decision,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async logPaymentProcessed(options: {
    payment_id: string;
    invoice_id: string;
    user_id: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'PAYMENT_PROCESSED' as AuditAction,
      entity_type: 'PAYMENT' as AuditEntityType,
      entity_id: options.payment_id,
      user_id: options.user_id,
      metadata: {
        invoice_id: options.invoice_id,
        amount: options.amount,
        currency: options.currency,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async logPayoutInitiated(options: {
    payout_id: string;
    claim_id: string;
    user_id: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    country?: string;
    gdpr_consent?: boolean;
  }): Promise<APIResponse<AuditLogEntry>> {
    return this.logAudit({
      action: 'PAYOUT_INITIATED' as AuditAction,
      entity_type: 'PAYOUT' as AuditEntityType,
      entity_id: options.payout_id,
      user_id: options.user_id,
      metadata: {
        claim_id: options.claim_id,
        amount: options.amount,
        currency: options.currency,
        ...options.metadata,
      },
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      country: options.country,
      gdpr_consent: options.gdpr_consent,
    });
  }

  public async requestBusinessDataErasure(options: {
    business_id: string;
    requester_email: string;
    reason?: string;
  }): Promise<APIResponse<GDPRErasureResponse>> {
    return this.requestErasure({
      entity_type: 'BUSINESS' as GDPREntityType,
      entity_id: options.business_id,
      requester_email: options.requester_email,
      reason: options.reason,
    });
  }

  public async requestUserDataErasure(options: {
    user_id: string;
    requester_email: string;
    reason?: string;
  }): Promise<APIResponse<GDPRErasureResponse>> {
    return this.requestErasure({
      entity_type: 'USER' as GDPREntityType,
      entity_id: options.user_id,
      requester_email: options.requester_email,
      reason: options.reason,
    });
  }

  public async requestPolicyDataErasure(options: {
    policy_id: string;
    requester_email: string;
    reason?: string;
  }): Promise<APIResponse<GDPRErasureResponse>> {
    return this.requestErasure({
      entity_type: 'POLICY' as GDPREntityType,
      entity_id: options.policy_id,
      requester_email: options.requester_email,
      reason: options.reason,
    });
  }

  public async requestClaimDataErasure(options: {
    claim_id: string;
    requester_email: string;
    reason?: string;
  }): Promise<APIResponse<GDPRErasureResponse>> {
    return this.requestErasure({
      entity_type: 'CLAIM' as GDPREntityType,
      entity_id: options.claim_id,
      requester_email: options.requester_email,
      reason: options.reason,
    });
  }

  public async generateQuarterlySolvencyReport(year: number): Promise<APIResponse<SolvencyIIReport>> {
    return this.generateSolvencyReport({ period: 'QUARTERLY', year });
  }

  public async generateAnnualSolvencyReport(year: number): Promise<APIResponse<SolvencyIIReport>> {
    return this.generateSolvencyReport({ period: 'ANNUAL', year });
  }

  public async getLatestSolvencyReport(): Promise<APIResponse<SolvencyIIReport>> {
    const currentYear = new Date().getFullYear();
    return this.generateAnnualSolvencyReport(currentYear);
  }

  public async entityExistsInAuditLog(
    entityType: AuditEntityType,
    entityId: string
  ): Promise<boolean> {
    const response = await this.listAuditLogs({ entity_type: entityType, entity_id: entityId, limit: 1 });
    return response.data.total > 0;
  }
}

export function createComplianceClient(config: BaseClientConfig = {}): ComplianceClient {
  return new ComplianceClient(config);
}
