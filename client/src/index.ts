export * from './utils/config';

export * from './utils/auth';

export * from './utils/client';

export * from './interfaces';

export * from './errors';

export * from './clients';

import {
  PolicyManagementClient,
  AgreementEngineClient,
  BillingClient,
  ClaimsManagementClient,
  PayoutsClient,
  UnderwritingClient,
  ComplianceClient,
  DocumentManagementClient,
} from './clients';

import { BaseClientConfig, BaseAPIClient } from './utils/client';
import { AuthConfig } from './utils/auth';

export class EUBusinessInsuranceClient extends BaseAPIClient {
  public readonly policy: PolicyManagementClient;
  public readonly agreement: AgreementEngineClient;
  public readonly billing: BillingClient;
  public readonly claims: ClaimsManagementClient;
  public readonly payouts: PayoutsClient;
  public readonly underwriting: UnderwritingClient;
  public readonly compliance: ComplianceClient;
  public readonly documents: DocumentManagementClient;

  constructor(config: BaseClientConfig = {}) {
    super(config);
    
    const shared: BaseClientConfig = {
      ...config,
      transport: { axiosInstance: this.axiosInstance, authManager: this.authManager },
    };
    this.policy = new PolicyManagementClient(shared);
    this.agreement = new AgreementEngineClient(shared);
    this.billing = new BillingClient(shared);
    this.claims = new ClaimsManagementClient(shared);
    this.payouts = new PayoutsClient(shared);
    this.underwriting = new UnderwritingClient(shared);
    this.compliance = new ComplianceClient(shared);
    this.documents = new DocumentManagementClient(shared);
  }

  public static createWithAuth(
    authConfig: AuthConfig,
    apiConfig?: import('./utils/config').APIConfig
  ): EUBusinessInsuranceClient {
    return new EUBusinessInsuranceClient({
      authConfig,
      apiConfig,
    });
  }

  public static createWithBearerToken(
    token: string,
    scopes?: string[],
    apiConfig?: import('./utils/config').APIConfig
  ): EUBusinessInsuranceClient {
    return new EUBusinessInsuranceClient({
      authConfig: {
        type: 'bearer',
        token,
        scopes,
      },
      apiConfig,
    });
  }

  public static createWithAPIKey(
    apiKey: string,
    apiConfig?: import('./utils/config').APIConfig
  ): EUBusinessInsuranceClient {
    return new EUBusinessInsuranceClient({
      authConfig: {
        type: 'apiKey',
        key: apiKey,
      },
      apiConfig,
    });
  }
}

export type {
  PolicyType,
  QuoteStatus,
  PolicyStatus,
  ClaimStatus,
  InvoiceStatus,
  PayoutStatus,
  AdjudicationDecision,
} from './interfaces';

export type {
  Quote,
  Policy,
  Claim,
  Invoice,
  Payment,
  Payout,
  Agreement,
  Document,
  UnderwritingResponse,
  AuditLogEntry,
} from './interfaces';
