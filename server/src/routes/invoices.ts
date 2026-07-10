import { Router } from 'express';
import { generateId } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import {
  validateSchema,
  invoiceRequestSchema,
  paymentRequestSchema,
  refundRequestSchema,
  paginate,
} from '../utils/validation';
import { Invoice, InvoiceList, Payment, PaymentMethod, Refund } from '../types';
import { clock } from '../utils/clock';
import { audit } from '../services/audit';
import { refreshInvoice } from '../services/lifecycle';
import { callMollie, mollie, mollieAmount, webhookUrl } from '../services/mollie';
import { paidTotal, paymentStatus, refundStatus, settleInvoice } from '../services/payments';

const router = Router();

const round2 = (n: number) => Math.round(n * 100) / 100;

async function getInvoiceOr404(invoiceId: string): Promise<Invoice> {
  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) throw notFound('Invoice');
  return await refreshInvoice(invoice);
}

async function getPaymentMethodForPolicy(paymentMethodId: string, policyId: string): Promise<PaymentMethod> {
  const method = await storage.getPaymentMethod(paymentMethodId);
  const policy = await storage.getPolicy(policyId);
  if (!method || method.business_id !== policy?.business_id) {
    throw badRequest('Payment method not found for this business', 'payment_method_id');
  }
  return method;
}

async function committedTotal(invoiceId: string): Promise<number> {
  return (await storage.listPayments())
    .filter(p => p.invoice_id === invoiceId && p.status !== 'FAILED')
    .reduce((sum, p) => sum + p.amount, 0);
}

async function refundedTotal(invoiceId: string): Promise<number> {
  return (await storage.listRefunds())
    .filter(r => r.invoice_id === invoiceId && r.status !== 'FAILED')
    .reduce((sum, r) => sum + r.amount, 0);
}

router.post('/', asyncHandler(async (req, res) => {
  const invoiceRequest = validateSchema(invoiceRequestSchema, req.body);

  const policy = await storage.getPolicy(invoiceRequest.policy_id);
  if (!policy) throw notFound('Policy');

  if (invoiceRequest.currency !== policy.premium.currency) {
    throw badRequest(`Currency must match the policy currency (${policy.premium.currency})`, 'currency');
  }
  if (invoiceRequest.items.length === 0) {
    throw badRequest('An invoice needs at least one item', 'items');
  }
  const itemsTotal = round2(invoiceRequest.items.reduce((sum, item) => sum + item.amount * (1 + item.tax_rate), 0));
  if (Math.abs(itemsTotal - invoiceRequest.amount) > 0.01) {
    throw badRequest(`amount (${invoiceRequest.amount}) does not match the items total including tax (${itemsTotal})`, 'amount');
  }

  if (invoiceRequest.payment_method_id) {
    await getPaymentMethodForPolicy(invoiceRequest.payment_method_id, policy.id);
  }

  const invoiceId = generateId('invoice');
  const now = clock.now().toISOString();
  const invoice: Invoice = {
    id: invoiceId,
    policy_id: invoiceRequest.policy_id,
    status: 'PENDING',
    amount: round2(invoiceRequest.amount),
    currency: invoiceRequest.currency,
    due_date: invoiceRequest.due_date,
    paid_at: null,
    items: invoiceRequest.items,
    billing_address: invoiceRequest.billing_address,
    pdf_url: `https://documents.insureeu.com/invoices/${invoiceId}.pdf`,
    payment_link: `https://payments.insureeu.com/invoices/${invoiceId}`,
    created_at: now,
    updated_at: now,
  };

  await storage.createInvoice(invoice);
  await storage.updatePolicy(policy.id, { invoices: [...(policy.invoices || []), invoiceId] });

  await audit(req, 'INVOICE_CREATED', 'INVOICE', invoiceId, {
    policy_id: invoiceRequest.policy_id,
    type: invoiceRequest.type,
    amount: invoice.amount,
    currency: invoice.currency,
  });

  res.status(201).json(await refreshInvoice(invoice));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { business_id, policy_id, status } = req.query;

  const policies = new Map((await storage.listPolicies()).map(p => [p.id, p]));
  let invoices: Invoice[] = [];
  for (const invoice of await storage.listInvoices()) invoices.push(await refreshInvoice(invoice));
  if (business_id) invoices = invoices.filter(i => policies.get(i.policy_id)?.business_id === business_id);
  if (policy_id) invoices = invoices.filter(i => i.policy_id === policy_id);
  if (status) invoices = invoices.filter(i => i.status === status);

  const { page, total, limit, offset } = paginate(invoices, req.query);
  const result: InvoiceList = { invoices: page, total, limit, offset };
  res.json(result);
}));

router.get('/:invoice_id', asyncHandler(async (req, res) => {
  res.json(await getInvoiceOr404(req.params.invoice_id));
}));

router.post('/:invoice_id/pay', asyncHandler(async (req, res) => {
  const { invoice_id } = req.params;
  const paymentRequest = validateSchema(paymentRequestSchema, req.body);
  const invoice = await getInvoiceOr404(invoice_id);

  if (invoice.status !== 'PENDING' && invoice.status !== 'OVERDUE') {
    throw badRequest(`Invoice is ${invoice.status} and cannot be paid`);
  }
  if (paymentRequest.currency !== invoice.currency) {
    throw badRequest(`Currency must match the invoice currency (${invoice.currency})`, 'currency');
  }
  const outstanding = round2(invoice.amount - await committedTotal(invoice_id));
  if (paymentRequest.amount > outstanding) {
    throw badRequest(`Amount exceeds the outstanding balance of ${outstanding}`, 'amount');
  }
  const method = await getPaymentMethodForPolicy(paymentRequest.payment_method_id, invoice.policy_id);
  if (method.type === 'CARD' && paymentRequest.metadata?.psd2_sca === false) {
    throw badRequest('Strong Customer Authentication is required for card payments (PSD2)', 'metadata.psd2_sca');
  }
  if (method.status !== 'ACTIVE' || !method.mollie_mandate_id) {
    throw badRequest(`Payment method is ${method.status} and cannot be charged`, 'payment_method_id');
  }

  const paymentId = generateId('payment');
  const molliePayment = await callMollie(() => mollie().createPayment({
    amount: mollieAmount(paymentRequest.amount, paymentRequest.currency),
    description: `Invoice ${invoice_id}`,
    customerId: method.mollie_customer_id,
    mandateId: method.mollie_mandate_id,
    sequenceType: 'recurring',
    webhookUrl: webhookUrl(),
    metadata: { invoice_id, payment_id: paymentId },
  }));

  const now = clock.now().toISOString();
  const status = paymentStatus(molliePayment);
  const payment: Payment = {
    id: paymentId,
    invoice_id,
    payment_method_id: method.id,
    amount: paymentRequest.amount,
    currency: paymentRequest.currency,
    status,
    gateway: 'MOLLIE',
    gateway_transaction_id: molliePayment.id,
    created_at: now,
    completed_at: status === 'COMPLETED' ? now : null,
  };
  await storage.createPayment(payment);
  await settleInvoice(invoice);

  await audit(req, 'PAYMENT_PROCESSED', 'PAYMENT', paymentId, {
    invoice_id,
    payment_method_id: method.id,
    amount: payment.amount,
    currency: payment.currency,
    mollie_payment_id: molliePayment.id,
    status,
  });

  res.status(201).json(payment);
}));

router.get('/:invoice_id/payments', asyncHandler(async (req, res) => {
  const { invoice_id } = req.params;
  await getInvoiceOr404(invoice_id);
  res.json({ payments: (await storage.listPayments()).filter(p => p.invoice_id === invoice_id) });
}));

router.post('/:invoice_id/refund', asyncHandler(async (req, res) => {
  const { invoice_id } = req.params;
  const { amount, reason, payment_method_id } = validateSchema(refundRequestSchema, req.body);
  const invoice = await getInvoiceOr404(invoice_id);

  const paid = await paidTotal(invoice_id);
  const refundable = round2(paid - await refundedTotal(invoice_id));
  if (paid === 0) {
    throw badRequest('Invoice has no completed payments to refund');
  }
  if (amount > refundable) {
    throw badRequest(`Amount exceeds the refundable balance of ${refundable}`, 'amount');
  }
  if (payment_method_id) await getPaymentMethodForPolicy(payment_method_id, invoice.policy_id);

  const refunds = (await storage.listRefunds()).filter(r => r.invoice_id === invoice_id && r.status !== 'FAILED');
  const refundedPerPayment = (paymentId: string) => refunds
    .flatMap(r => r.mollie_refunds)
    .filter(m => m.payment_id === paymentId)
    .reduce((sum, m) => sum + m.amount, 0);

  const mollieRefunds: Refund['mollie_refunds'] = [];
  let remaining = amount;
  for (const payment of (await storage.listPayments()).filter(p => p.invoice_id === invoice_id && p.status === 'COMPLETED')) {
    const part = round2(Math.min(remaining, payment.amount - refundedPerPayment(payment.gateway_transaction_id!)));
    if (part <= 0) continue;
    const mollieRefund = await callMollie(() =>
      mollie().createRefund(payment.gateway_transaction_id!, mollieAmount(part, invoice.currency)));
    mollieRefunds.push({ id: mollieRefund.id, payment_id: payment.gateway_transaction_id!, amount: part, status: mollieRefund.status });
    remaining = round2(remaining - part);
    if (remaining <= 0) break;
  }

  const now = clock.now().toISOString();
  const status = refundStatus(mollieRefunds);
  const refund: Refund = {
    id: generateId('refund'),
    invoice_id,
    amount,
    currency: invoice.currency,
    reason,
    status,
    payment_method_id,
    mollie_refunds: mollieRefunds,
    created_at: now,
    completed_at: status === 'COMPLETED' ? now : null,
  };
  await storage.createRefund(refund);
  await settleInvoice(invoice);

  await audit(req, 'REFUND_ISSUED', 'REFUND', refund.id, { invoice_id, amount, reason, status });

  res.status(201).json(refund);
}));

export { router as invoicesRouter };
