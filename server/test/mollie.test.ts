import { api, apiUrl, createPolicy, isoDate, mollieMock, resetState, startServer, stopServer } from './helpers';
import { setMollieGateway } from '../src/services/mollie';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

const webhook = (id: string) => fetch(apiUrl('/webhooks/mollie'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `id=${id}`,
});

async function invoiceFor(amount = 119) {
  const { policy } = await createPolicy();
  return (await api('POST', '/invoices', {
    policy_id: policy.id, type: 'PREMIUM', amount, currency: 'EUR', due_date: isoDate(14),
    items: [{ description: 'Premium', amount: amount / 1.19, tax_rate: 0.19 }],
    billing_address: { street: 's', city: 'c', postal_code: '1', country: 'DE' },
  })).body;
}

const sepa = (business_id = 'biz_test') => api('POST', '/payment-methods', {
  business_id, type: 'SEPA', details: { holder_name: 'TechCorp GmbH', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
});

describe('Mollie payment methods', () => {
  it('creates one customer per business and a SEPA Direct Debit mandate', async () => {
    const method = (await sepa()).body;
    await sepa();
    expect(mollieMock.createCustomer).toHaveBeenCalledTimes(1);
    expect(mollieMock.createDirectDebitMandate).toHaveBeenCalledWith(expect.objectContaining({
      customerId: method.mollie_customer_id,
      consumerName: 'TechCorp GmbH',
      consumerAccount: 'DE89370400440532013000',
      consumerBic: 'COBADEFFXXX',
      mandateReference: method.id,
    }));
    expect(method).toMatchObject({ status: 'ACTIVE', details: { masked_iban: '****3000' } });
  });

  it('activates a card once its first payment is paid', async () => {
    const created = await api('POST', '/payment-methods', {
      business_id: 'biz_test', type: 'CARD', details: { holder_name: 'Jane' }, redirect_url: 'https://techcorp.de/done',
    });
    expect(created.body).toMatchObject({ status: 'PENDING', checkout_url: expect.stringContaining('mollie.com') });
    expect(mollieMock.createPayment).toHaveBeenCalledWith(expect.objectContaining({ sequenceType: 'first', method: 'creditcard' }));

    mollieMock.completeFirstPayment(created.body.mollie_payment_id, { cardNumber: '4242', cardLabel: 'Mastercard', cardHolder: 'Jane Doe' });
    expect((await webhook(created.body.mollie_payment_id)).status).toBe(200);
    const methods = (await api('GET', '/payment-methods?business_id=biz_test')).body.payment_methods;
    expect(methods[0]).toMatchObject({
      status: 'ACTIVE',
      details: { holder_name: 'Jane Doe', masked_card: '****4242', card_brand: 'MASTERCARD' },
    });
  });

  it('answers 503 when Mollie is not configured', async () => {
    setMollieGateway(undefined);
    expect((await sepa()).status).toBe(503);
  });
});

describe('charging invoices on demand', () => {
  it('creates a recurring payment and settles it from the webhook', async () => {
    const method = (await sepa()).body;
    const invoice = await invoiceFor();
    mollieMock.nextRecurringStatus = 'pending';

    const payment = (await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: 119, currency: 'EUR' })).body;
    expect(mollieMock.createPayment).toHaveBeenLastCalledWith(expect.objectContaining({
      amount: { currency: 'EUR', value: '119.00' },
      customerId: method.mollie_customer_id,
      mandateId: method.mollie_mandate_id,
      sequenceType: 'recurring',
    }));
    expect(payment).toMatchObject({ status: 'PENDING', gateway: 'MOLLIE' });
    expect((await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: 1, currency: 'EUR' })).status).toBe(400);

    mollieMock.setPaymentStatus(payment.gateway_transaction_id, 'paid');
    await webhook(payment.gateway_transaction_id);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PAID');
  });

  it('frees the amount again when Mollie reports the payment failed', async () => {
    const method = (await sepa()).body;
    const invoice = await invoiceFor();
    mollieMock.nextRecurringStatus = 'pending';
    const payment = (await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: 119, currency: 'EUR' })).body;

    mollieMock.setPaymentStatus(payment.gateway_transaction_id, 'failed');
    await webhook(payment.gateway_transaction_id);
    expect((await api('GET', `/invoices/${invoice.id}/payments`)).body.payments[0].status).toBe('FAILED');
    expect((await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: 119, currency: 'EUR' })).status).toBe(201);
  });

  it('refunds through Mollie and marks the invoice REFUNDED when the refund completes', async () => {
    const method = (await sepa()).body;
    const invoice = await invoiceFor();
    const payment = (await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: 119, currency: 'EUR' })).body;
    mollieMock.nextRefundStatus = 'pending';

    const refund = (await api('POST', `/invoices/${invoice.id}/refund`, { amount: 119, reason: 'CANCELLATION' })).body;
    expect(mollieMock.createRefund).toHaveBeenCalledWith(payment.gateway_transaction_id, { currency: 'EUR', value: '119.00' });
    expect(refund.status).toBe('PROCESSING');
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PAID');

    mollieMock.setRefundStatus(payment.gateway_transaction_id, 'refunded');
    await webhook(payment.gateway_transaction_id);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('REFUNDED');
  });

  it('ignores webhooks for unknown payments without calling Mollie', async () => {
    expect((await webhook('tr_unknown')).status).toBe(200);
    expect((await webhook('not-a-payment')).status).toBe(400);
    expect(mollieMock.getPayment).not.toHaveBeenCalled();
  });
});
