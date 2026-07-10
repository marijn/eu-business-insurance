import { Request } from 'express';
import { storage } from '../storage';
import { CardBrand, Invoice, Payment, PaymentStatus, Refund } from '../types';
import { clock } from '../utils/clock';
import { audit } from './audit';
import { MolliePayment, MollieRefund, callMollie, mollie } from './mollie';

const round2 = (n: number) => Math.round(n * 100) / 100;

const PAYMENT_STATUS: Record<string, PaymentStatus> = {
  open: 'PENDING',
  pending: 'PENDING',
  authorized: 'PROCESSING',
  paid: 'COMPLETED',
  failed: 'FAILED',
  canceled: 'FAILED',
  expired: 'FAILED',
};

const CARD_BRANDS: Record<string, CardBrand> = { Visa: 'VISA', Mastercard: 'MASTERCARD', 'American Express': 'AMEX' };

export function paymentStatus(molliePayment: MolliePayment): PaymentStatus {
  return PAYMENT_STATUS[molliePayment.status] || 'PENDING';
}

export function refundStatus(refunds: MollieRefund[]): Refund['status'] {
  if (refunds.some((r) => r.status === 'failed' || r.status === 'canceled')) return 'FAILED';
  if (refunds.every((r) => r.status === 'refunded')) return 'COMPLETED';
  return 'PROCESSING';
}

export async function paidTotal(invoiceId: string): Promise<number> {
  return (await storage.listPayments())
    .filter((p) => p.invoice_id === invoiceId && (p.status === 'COMPLETED' || p.status === 'REFUNDED'))
    .reduce((sum, p) => sum + p.amount, 0);
}

export async function settleInvoice(invoice: Invoice): Promise<void> {
  const now = clock.now().toISOString();
  const paid = round2(await paidTotal(invoice.id));
  const refunded = round2((await storage.listRefunds())
    .filter((r) => r.invoice_id === invoice.id && r.status === 'COMPLETED')
    .reduce((sum, r) => sum + r.amount, 0));

  if (paid > 0 && refunded >= paid && invoice.status !== 'REFUNDED') {
    await storage.updateInvoice(invoice.id, { status: 'REFUNDED', updated_at: now });
    for (const p of (await storage.listPayments()).filter((p) => p.invoice_id === invoice.id && p.status === 'COMPLETED')) {
      await storage.updatePayment(p.id, { status: 'REFUNDED' });
    }
  } else if (paid >= invoice.amount && (invoice.status === 'PENDING' || invoice.status === 'OVERDUE')) {
    await storage.updateInvoice(invoice.id, { status: 'PAID', paid_at: now, updated_at: now });
  }
}

async function updatePayment(req: Request | undefined, payment: Payment, molliePayment: MolliePayment): Promise<void> {
  const status = paymentStatus(molliePayment);
  if (status !== payment.status && payment.status !== 'REFUNDED') {
    await storage.updatePayment(payment.id, {
      status,
      completed_at: status === 'COMPLETED' ? clock.now().toISOString() : payment.completed_at,
    });
    await audit(req, 'PAYMENT_UPDATED', 'PAYMENT', payment.id, { status, mollie_payment_id: molliePayment.id });
  }

  for (const refund of (await storage.listRefunds()).filter((r) => r.mollie_refunds.some((m) => m.payment_id === molliePayment.id))) {
    const current = await callMollie(() => mollie().listRefunds(molliePayment.id));
    const mollieRefunds = refund.mollie_refunds.map((m) => ({
      ...m,
      status: current.find((c) => c.id === m.id)?.status || m.status,
    }));
    const status = refundStatus(mollieRefunds);
    if (status !== refund.status) {
      await storage.updateRefund(refund.id, {
        mollie_refunds: mollieRefunds,
        status,
        completed_at: status === 'COMPLETED' ? clock.now().toISOString() : refund.completed_at,
      });
      await audit(req, 'REFUND_UPDATED', 'REFUND', refund.id, { status });
    }
  }

  const invoice = await storage.getInvoice(payment.invoice_id);
  if (invoice) await settleInvoice(invoice);
}

async function activatePaymentMethod(req: Request | undefined, paymentMethodId: string, molliePayment: MolliePayment): Promise<void> {
  const method = await storage.getPaymentMethod(paymentMethodId);
  if (!method || method.status !== 'PENDING') return;

  const status = paymentStatus(molliePayment);
  if (status === 'COMPLETED' && molliePayment.mandateId) {
    const mandate = await callMollie(() => mollie().getMandate(method.mollie_customer_id, molliePayment.mandateId!));
    await storage.updatePaymentMethod(method.id, {
      status: mandate.status === 'valid' ? 'ACTIVE' : 'PENDING',
      mollie_mandate_id: mandate.id,
      checkout_url: undefined,
      details: {
        holder_name: mandate.details.cardHolder || method.details.holder_name,
        masked_card: mandate.details.cardNumber ? `****${mandate.details.cardNumber.slice(-4)}` : undefined,
        card_brand: CARD_BRANDS[mandate.details.cardLabel || ''] || 'OTHER',
      },
    });
  } else if (status === 'FAILED') {
    await storage.updatePaymentMethod(method.id, { status: 'INVALID', checkout_url: undefined });
  } else {
    return;
  }
  await audit(req, 'PAYMENT_METHOD_UPDATED', 'PAYMENT_METHOD', method.id, { mollie_payment_id: molliePayment.id });
}

export async function handleMolliePayment(req: Request | undefined, molliePaymentId: string): Promise<boolean> {
  const payment = (await storage.listPayments()).find((p) => p.gateway_transaction_id === molliePaymentId);
  const method = payment ? undefined : (await storage.listPaymentMethods()).find((m) => m.mollie_payment_id === molliePaymentId);
  if (!payment && !method) return false;

  const molliePayment = await callMollie(() => mollie().getPayment(molliePaymentId));
  if (payment) await updatePayment(req, payment, molliePayment);
  if (method) await activatePaymentMethod(req, method.id, molliePayment);
  return true;
}
