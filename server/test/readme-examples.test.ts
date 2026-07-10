import { api, claimRequest, createPolicy, recipient, resetState, startServer, stopServer, travelDays } from './helpers';
import { clock } from '../src/utils/clock';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

const policyWithReadmeLimits = () => createPolicy({
  coverage_request: { limits: { per_claim: 1_000_000, aggregate: 5_000_000 }, deductible: 10_000 },
});

describe('README: payments', () => {
  it('follows the documented invoice, payment, dunning and refund example', async () => {
    const { policy } = await policyWithReadmeLimits();
    const invoiceBody = {
      policy_id: policy.id, type: 'PREMIUM', amount: 6485.5, currency: 'EUR', due_date: '2026-11-01',
      items: [{ description: 'Premium', amount: 5450, tax_rate: 0.19 }],
      billing_address: { street: 'Musterstraße 1', city: 'Berlin', postal_code: '10115', country: 'DE' },
    };
    jest.spyOn(clock, 'now').mockImplementation(() => new Date('2026-10-20T12:00:00Z'));
    expect((await api('POST', '/invoices', { ...invoiceBody, amount: 6000 })).status).toBe(400);
    const invoice = (await api('POST', '/invoices', invoiceBody)).body;
    expect(invoice).toMatchObject({ status: 'PENDING', due_date: '2026-11-01' });

    const method = (await api('POST', '/payment-methods', {
      business_id: 'biz_test', type: 'SEPA',
      details: { holder_name: 'TechCorp GmbH', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
    })).body;
    expect(method).toMatchObject({ is_default: true, details: { masked_iban: '****3000' } });

    const pay = (amount: number) => api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount, currency: 'EUR' });
    const partial = await pay(2000);
    expect(partial.body).toMatchObject({ status: 'COMPLETED', gateway: 'MOLLIE' });
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PENDING');
    expect((await pay(4485.51)).status).toBe(400);
    await pay(4485.5);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PAID');

    const refund = (amount: number) => api('POST', `/invoices/${invoice.id}/refund`, { amount, reason: 'CANCELLATION' });
    await refund(1000);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PAID');
    expect((await refund(5485.51)).status).toBe(400);
    await refund(5485.5);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('REFUNDED');
  });

  it('turns the unpaid invoice OVERDUE the day after the due date and duns three times', async () => {
    const { policy } = await policyWithReadmeLimits();
    const clockSpy = jest.spyOn(clock, 'now');
    clockSpy.mockImplementation(() => new Date('2026-10-20T12:00:00Z'));
    const invoice = (await api('POST', '/invoices', {
      policy_id: policy.id, type: 'PREMIUM', amount: 6485.5, currency: 'EUR', due_date: '2026-11-01',
      items: [{ description: 'Premium', amount: 5450, tax_rate: 0.19 }],
      billing_address: { street: 's', city: 'c', postal_code: '1', country: 'DE' },
    })).body;
    clockSpy.mockImplementation(() => new Date('2026-11-01T23:00:00Z'));
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PENDING');
    clockSpy.mockImplementation(() => new Date('2026-11-02T08:00:00Z'));
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('OVERDUE');
    for (const level of [1, 2, 3]) {
      expect((await api('POST', `/dunning/${invoice.id}`)).body.dunning_level).toBe(level);
    }
    expect((await api('POST', `/dunning/${invoice.id}`)).status).toBe(400);
  });
});

describe('README: payouts', () => {
  it('follows the documented adjudication, payout, cancel and settlement example', async () => {
    const { policy } = await policyWithReadmeLimits();
    const claim = (await api('POST', '/claims', claimRequest(policy.id))).body;
    const adjudicated = await api('POST', `/claims/${claim.id}/adjudicate`, {
      decision: 'APPROVE', payout_amount: 450_000, currency: 'EUR', reason: 'Covered', adjudicator_id: 'adj_1',
    });
    expect(adjudicated.status).toBe(200);
    expect((await api('GET', `/claims/${claim.id}`)).body).toMatchObject({ status: 'APPROVED', actual_loss: 460_000 });

    const payout = (amount: number) => api('POST', '/payouts', { claim_id: claim.id, amount, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM' });
    const first = (await payout(300_000)).body;
    expect(first.status).toBe('PENDING');
    expect((await api('GET', `/claims/${claim.id}`)).body.status).toBe('APPROVED');
    const over = await payout(150_001);
    expect(over.status).toBe(400);
    expect(over.body.message).toContain('150000');

    expect((await api('POST', `/payouts/${first.id}`, { reason: 'ERROR' })).body.status).toBe('CANCELLED');
    await payout(300_000);
    await payout(150_000);

    travelDays(3);
    const settled = await api('GET', `/claims/${claim.id}`);
    expect(settled.body.status).toBe('PAID');
    expect(settled.body.closed_at).not.toBeNull();
    expect((await payout(1)).status).toBe(400);
  });
});
