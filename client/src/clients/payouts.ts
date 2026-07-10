import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  Payout,
  PayoutList,
  PayoutRequest,
  CancelPayoutRequest,
  PayoutStatus,
  Currency,
  RecipientType,
  PayoutPurpose,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class PayoutsClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async createPayout(request: PayoutRequest): Promise<APIResponse<Payout>> {
    return this.post<Payout>('/payouts', request);
  }

  public async listPayouts(options: {
    claim_id?: string;
    status?: PayoutStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<APIResponse<PayoutList>> {
    const params: Record<string, unknown> = {};
    
    if (options.claim_id) params.claim_id = options.claim_id;
    if (options.status) params.status = options.status;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;

    return this.get<PayoutList>('/payouts', params);
  }

  public async getPayout(payoutId: string): Promise<APIResponse<Payout>> {
    return this.get<Payout>(`/payouts/${payoutId}`);
  }

  public async cancelPayout(
    payoutId: string,
    request: CancelPayoutRequest
  ): Promise<APIResponse<Payout>> {
    return this.post<Payout>(`/payouts/${payoutId}`, request);
  }

  public async getPayoutsForClaim(claimId: string): Promise<APIResponse<PayoutList>> {
    return this.listPayouts({ claim_id: claimId });
  }

  public async getPayoutsByStatus(status: PayoutStatus): Promise<APIResponse<PayoutList>> {
    return this.listPayouts({ status });
  }

  public async getPendingPayouts(): Promise<APIResponse<PayoutList>> {
    return this.getPayoutsByStatus('PENDING');
  }

  public async getProcessingPayouts(): Promise<APIResponse<PayoutList>> {
    return this.getPayoutsByStatus('PROCESSING');
  }

  public async getCompletedPayouts(): Promise<APIResponse<PayoutList>> {
    return this.getPayoutsByStatus('COMPLETED');
  }

  public async getFailedPayouts(): Promise<APIResponse<PayoutList>> {
    return this.getPayoutsByStatus('FAILED');
  }

  public async createSEPAPayout(options: {
    claim_id: string;
    amount: number;
    currency?: Currency;
    recipient: {
      type: RecipientType;
      name: string;
      iban: string;
      bic: string;
      address: {
        street: string;
        city: string;
        postal_code: string;
        country: string;
      };
      tax_id?: string;
    };
    purpose?: PayoutPurpose;
    tax_withholding?: number;
    aml_check?: boolean;
    kyc_check?: boolean;
    sanctions_check?: boolean;
    reference?: string;
  }): Promise<APIResponse<Payout>> {
    return this.createPayout({
      claim_id: options.claim_id,
      amount: options.amount,
      currency: options.currency || 'EUR',
      recipient: options.recipient,
      purpose: options.purpose || 'CYBER_CLAIM',
      metadata: {
        tax_withholding: options.tax_withholding || 0,
        compliance_checks: {
          aml: options.aml_check !== false,
          kyc: options.kyc_check !== false,
          sanctions: options.sanctions_check !== false,
        },
        reference: options.reference,
      },
    });
  }

  public async createBusinessPayout(options: {
    claim_id: string;
    amount: number;
    currency?: Currency;
    business_name: string;
    iban: string;
    bic: string;
    address: {
      street: string;
      city: string;
      postal_code: string;
      country: string;
    };
    tax_id?: string;
    purpose?: PayoutPurpose;
  }): Promise<APIResponse<Payout>> {
    return this.createSEPAPayout({
      ...options,
      recipient: {
        type: 'BUSINESS' as RecipientType,
        name: options.business_name,
        iban: options.iban,
        bic: options.bic,
        address: options.address,
        tax_id: options.tax_id,
      },
      purpose: options.purpose || 'CYBER_CLAIM',
    });
  }

  public async createIndividualPayout(options: {
    claim_id: string;
    amount: number;
    currency?: Currency;
    individual_name: string;
    iban: string;
    bic: string;
    address: {
      street: string;
      city: string;
      postal_code: string;
      country: string;
    };
    purpose?: PayoutPurpose;
  }): Promise<APIResponse<Payout>> {
    return this.createSEPAPayout({
      ...options,
      recipient: {
        type: 'INDIVIDUAL' as RecipientType,
        name: options.individual_name,
        iban: options.iban,
        bic: options.bic,
        address: options.address,
      },
      purpose: options.purpose || 'CYBER_CLAIM',
    });
  }

  public canCancelPayout(payout: Payout): boolean {
    return payout.status === 'PENDING';
  }

  public async getPayoutsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<Payout[]> {
    const response = await this.listPayouts();
    return response.data.payouts.filter(payout => {
      const createdAt = new Date(payout.created_at);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return createdAt >= start && createdAt <= end;
    });
  }

  public async getTotalPayoutAmount(claimId: string): Promise<number> {
    const response = await this.getPayoutsForClaim(claimId);
    return response.data.payouts.reduce((total, payout) => {
      return total + payout.amount;
    }, 0);
  }

  public async getPayoutsByRecipient(recipientName: string): Promise<Payout[]> {
    const response = await this.listPayouts();
    return response.data.payouts.filter(
      payout => payout.recipient.name === recipientName
    );
  }
}

export function createPayoutsClient(config: BaseClientConfig = {}): PayoutsClient {
  return new PayoutsClient(config);
}
