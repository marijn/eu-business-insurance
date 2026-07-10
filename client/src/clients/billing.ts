import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  Invoice,
  InvoiceList,
  Policy,
  InvoiceRequest,
  Payment,
  PaymentRequest,
  PaymentMethod,
  PaymentMethodRequest,
  Refund,
  RefundRequest,
  InvoiceStatus,
  PaymentMethodType,
  Currency,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class BillingClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async createInvoice(request: InvoiceRequest): Promise<APIResponse<Invoice>> {
    return this.post<Invoice>('/invoices', request);
  }

  public async listInvoices(options: {
    business_id?: string;
    policy_id?: string;
    status?: InvoiceStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<APIResponse<InvoiceList>> {
    const params: Record<string, unknown> = {};
    
    if (options.business_id) params.business_id = options.business_id;
    if (options.policy_id) params.policy_id = options.policy_id;
    if (options.status) params.status = options.status;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;

    return this.get<InvoiceList>('/invoices', params);
  }

  public async getInvoice(invoiceId: string): Promise<APIResponse<Invoice>> {
    return this.get<Invoice>(`/invoices/${invoiceId}`);
  }

  public async processPayment(
    invoiceId: string,
    request: PaymentRequest
  ): Promise<APIResponse<Payment>> {
    return this.post<Payment>(`/invoices/${invoiceId}/pay`, request);
  }

  public async refundPayment(
    invoiceId: string,
    request: RefundRequest
  ): Promise<APIResponse<Refund>> {
    return this.post<Refund>(`/invoices/${invoiceId}/refund`, request);
  }

  public async listPayments(invoiceId: string): Promise<APIResponse<{ payments: Payment[] }>> {
    return this.get<{ payments: Payment[] }>(`/invoices/${invoiceId}/payments`);
  }

  public async addPaymentMethod(request: PaymentMethodRequest): Promise<APIResponse<PaymentMethod>> {
    return this.post<PaymentMethod>('/payment-methods', request);
  }

  public async listPaymentMethods(businessId: string): Promise<APIResponse<{ payment_methods: PaymentMethod[] }>> {
    return this.get<{ payment_methods: PaymentMethod[] }>('/payment-methods', { business_id: businessId });
  }

  public async triggerDunning(invoiceId: string): Promise<APIResponse<void>> {
    return this.post<void>(`/dunning/${invoiceId}`);
  }

  public async createInvoiceAndPay(
    invoiceRequest: InvoiceRequest,
    paymentRequest: PaymentRequest
  ): Promise<APIResponse<Payment>> {
    const invoiceResponse = await this.createInvoice(invoiceRequest);
    return this.processPayment(invoiceResponse.data.id, paymentRequest);
  }

  public async getInvoicesForBusiness(businessId: string): Promise<APIResponse<InvoiceList>> {
    return this.listInvoices({ business_id: businessId });
  }

  public async getUnpaidInvoicesForBusiness(businessId: string): Promise<APIResponse<InvoiceList>> {
    return this.listInvoices({
      business_id: businessId,
      status: 'PENDING',
    });
  }

  public async getOverdueInvoicesForBusiness(businessId: string): Promise<APIResponse<InvoiceList>> {
    return this.listInvoices({
      business_id: businessId,
      status: 'OVERDUE',
    });
  }

  public async getInvoicesForPolicy(policyId: string): Promise<APIResponse<InvoiceList>> {
    return this.listInvoices({ policy_id: policyId });
  }

  public async getPaymentMethodsForBusiness(businessId: string): Promise<PaymentMethod[]> {
    const response = await this.listPaymentMethods(businessId);
    return response.data.payment_methods;
  }

  public async getDefaultPaymentMethod(businessId: string): Promise<PaymentMethod | null> {
    const paymentMethods = (await this.getPaymentMethodsForBusiness(businessId)).filter(m => m.status === 'ACTIVE');
    const defaultMethod = paymentMethods.find(m => m.is_default);
    return defaultMethod || paymentMethods[0] || null;
  }

  public async addSEPAPaymentMethod(
    businessId: string,
    details: {
      holder_name: string;
      iban: string;
      bic: string;
      is_default?: boolean;
    }
  ): Promise<APIResponse<PaymentMethod>> {
    return this.addPaymentMethod({
      business_id: businessId,
      type: 'SEPA' as PaymentMethodType,
      details: {
        holder_name: details.holder_name,
        iban: details.iban,
        bic: details.bic,
      },
      is_default: details.is_default,
    });
  }

  public async addCreditCardPaymentMethod(
    businessId: string,
    details: {
      holder_name: string;
      redirect_url: string;
      email?: string;
      is_default?: boolean;
    }
  ): Promise<APIResponse<PaymentMethod>> {
    return this.addPaymentMethod({
      business_id: businessId,
      type: 'CARD' as PaymentMethodType,
      details: { holder_name: details.holder_name },
      redirect_url: details.redirect_url,
      email: details.email,
      is_default: details.is_default,
    });
  }

  public async payWithDefaultMethod(
    invoiceId: string,
    amount: number,
    currency: Currency = 'EUR'
  ): Promise<APIResponse<Payment>> {
    const invoiceResponse = await this.getInvoice(invoiceId);
    const policyResponse = await this.get<Policy>(`/policies/${invoiceResponse.data.policy_id}`);
    const businessId = policyResponse.data.business_id;
    
    const defaultMethod = await this.getDefaultPaymentMethod(businessId);
    
    if (!defaultMethod) {
      throw new Error('No default payment method found for this business');
    }

    return this.processPayment(invoiceId, {
      payment_method_id: defaultMethod.id,
      amount,
      currency,
      metadata: {
        psd2_sca: true,
      },
    });
  }
}

export function createBillingClient(config: BaseClientConfig = {}): BillingClient {
  return new BillingClient(config);
}
