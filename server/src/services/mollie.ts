import createMollieClient, { Mandate, MandateMethod, MollieClient, Payment, SequenceType } from '@mollie/api-client';
import { createError } from '../middleware/errorHandler';

export interface MollieAmount {
  currency: string;
  value: string;
}

export interface MolliePayment {
  id: string;
  status: string;
  customerId?: string;
  mandateId?: string;
  metadata: unknown;
  checkoutUrl?: string | null;
}

export interface MollieMandate {
  id: string;
  status: string;
  details: { cardNumber?: string; cardLabel?: string | null; cardHolder?: string; consumerAccount?: string };
}

export interface MollieRefund {
  id: string;
  status: string;
}

export interface CreatePaymentParameters {
  amount: MollieAmount;
  description: string;
  customerId: string;
  sequenceType: 'first' | 'recurring';
  mandateId?: string;
  method?: 'creditcard';
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, string>;
}

export interface MollieGateway {
  createCustomer(params: { name: string; email?: string; metadata?: Record<string, string> }): Promise<{ id: string }>;
  createDirectDebitMandate(params: {
    customerId: string;
    consumerName: string;
    consumerAccount: string;
    consumerBic: string;
    signatureDate: string;
    mandateReference: string;
  }): Promise<MollieMandate>;
  getMandate(customerId: string, mandateId: string): Promise<MollieMandate>;
  createPayment(params: CreatePaymentParameters): Promise<MolliePayment>;
  getPayment(paymentId: string): Promise<MolliePayment>;
  createRefund(paymentId: string, amount: MollieAmount): Promise<MollieRefund>;
  listRefunds(paymentId: string): Promise<MollieRefund[]>;
}

export function sdkGateway(client: MollieClient): MollieGateway {
  const toPayment = (payment: Payment): MolliePayment => ({
    id: payment.id,
    status: payment.status,
    customerId: payment.customerId,
    mandateId: payment.mandateId,
    metadata: payment.metadata,
    checkoutUrl: payment.getCheckoutUrl(),
  });
  const toMandate = (mandate: Mandate): MollieMandate => ({
    id: mandate.id,
    status: mandate.status,
    details: mandate.details as MollieMandate['details'],
  });

  return {
    createCustomer: async (params) => ({ id: (await client.customers.create(params)).id }),
    createDirectDebitMandate: async (params) =>
      toMandate(await client.customerMandates.create({ ...params, method: MandateMethod.directdebit })),
    getMandate: async (customerId, mandateId) => toMandate(await client.customerMandates.get(mandateId, { customerId })),
    createPayment: async (params) => toPayment(await client.payments.create({
      ...params,
      sequenceType: params.sequenceType === 'first' ? SequenceType.first : SequenceType.recurring,
    } as Parameters<MollieClient['payments']['create']>[0])),
    getPayment: async (paymentId) => toPayment(await client.payments.get(paymentId)),
    createRefund: async (paymentId, amount) => {
      const refund = await client.paymentRefunds.create({ paymentId, amount });
      return { id: refund.id, status: refund.status };
    },
    listRefunds: async (paymentId) =>
      Array.from(await client.paymentRefunds.page({ paymentId })).map((refund) => ({ id: refund.id, status: refund.status })),
  };
}

let gateway: MollieGateway | undefined = process.env.MOLLIE_API_KEY
  ? sdkGateway(createMollieClient({ apiKey: process.env.MOLLIE_API_KEY }))
  : undefined;

export function setMollieGateway(next: MollieGateway | undefined): void {
  gateway = next;
}

export function mollie(): MollieGateway {
  if (!gateway) throw createError('INTERNAL_ERROR', 'Payments are not configured: set MOLLIE_API_KEY', undefined, 503);
  return gateway;
}

export async function callMollie<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if ((error as { name?: string }).name === 'APIError') throw error;
    throw createError('INTERNAL_ERROR', `Mollie: ${(error as Error).message}`, undefined, 502);
  }
}

export function mollieAmount(amount: number, currency: string): MollieAmount {
  return { currency, value: amount.toFixed(2) };
}

export function webhookUrl(): string | undefined {
  return process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/v1/webhooks/mollie` : undefined;
}
