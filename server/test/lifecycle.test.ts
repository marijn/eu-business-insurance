import {
  api,
  auditActions,
  claimRequest,
  createApprovedClaim,
  createPolicy,
  isoDate,
  quoteRequest,
  recipient,
  resetState,
  startServer,
  stopServer,
  travelDays,
  signAgreement,
} from './helpers';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

describe('quotes and binding', () => {
  it('binds a quote only once', async () => {
    const quote = await api('POST', '/quotes', quoteRequest());
    expect((await api('POST', `/quotes/${quote.body.id}`, {})).status).toBe(201);
    expect((await api('GET', `/quotes/${quote.body.id}`)).body.status).toBe('ACCEPTED');
    expect((await api('POST', `/quotes/${quote.body.id}`, {})).status).toBe(400);
  });

  it('uses the quoted term', async () => {
    const request = quoteRequest({ term: { start_date: isoDate(-10), end_date: isoDate(100) } });
    const quote = await api('POST', '/quotes', request);
    const policy = await api('POST', `/quotes/${quote.body.id}`, {});
    expect(policy.body.term).toEqual(request.term);

    const late = await api('POST', '/quotes', request);
    const bound = await api('POST', `/quotes/${late.body.id}`, { effective_date: isoDate() });
    expect(bound.body.term).toEqual({ start_date: isoDate(), end_date: isoDate(100) });
    const outside = await api('POST', '/quotes', request);
    expect((await api('POST', `/quotes/${outside.body.id}`, { effective_date: isoDate(200) })).status).toBe(400);
  });

  it('supersedes the bind-time agreement instead of orphaning it', async () => {
    const { policy } = await createPolicy({}, { signed: false });
    const first = policy.agreement_id;
    const generated = await api('POST', '/agreements/generate', {
      policy_id: policy.id,
      template_id: 'CYBER_POLICY_DE_v2',
      language: 'de',
    });
    expect(generated.status).toBe(201);
    expect((await api('GET', `/policies/${policy.id}`)).body.agreement_id).toBe(generated.body.id);
    expect((await api('GET', `/agreements/${first}`)).body.status).toBe('VOIDED');
  });

  it('only voids unsigned agreements and refuses to sign voided ones', async () => {
    const { policy } = await createPolicy({}, { signed: false });
    const voided = await api('POST', `/agreements/${policy.agreement_id}/void`, { reason: 'Mistake' });
    expect(voided.body.status).toBe('VOIDED');
    expect((await api('POST', `/agreements/${policy.agreement_id}/void`, { reason: 'Again' })).status).toBe(400);
    expect((await api('POST', `/agreements/${policy.agreement_id}/sign`, { signatory_email: 'a@b.de' })).status).toBe(400);
  });
});

describe('policy changes', () => {
  it('returns the cancelled policy and stores reason and date', async () => {
    const { policy } = await createPolicy();
    const res = await api('DELETE', `/policies/${policy.id}`, { reason: 'NON_PAYMENT', effective_date: isoDate() });
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancellation).toEqual({ reason: 'NON_PAYMENT', effective_date: isoDate() });
    expect((await api('DELETE', `/policies/${policy.id}`, { reason: 'OTHER' })).status).toBe(400);
  });

  it('renews into a clean policy with its own agreement', async () => {
    const { policy } = await createPolicy();
    await api('POST', '/invoices', invoiceRequest(policy));
    const renewed = await api('POST', `/policies/${policy.id}`, { term: { end_date: isoDate(800) } });
    expect(renewed.status).toBe(200);
    expect(renewed.body).toMatchObject({
      status: 'PENDING',
      invoices: [],
      endorsements: [],
      renewed_from: policy.id,
      term: { start_date: policy.term.end_date, end_date: isoDate(800) },
    });
    expect(renewed.body.agreement_id).not.toBe(policy.agreement_id);
    expect((await api('POST', `/policies/${policy.id}`, {})).status).toBe(400);
    expect((await api('GET', `/policies/${policy.id}`)).body.status).toBe('ACTIVE');
    await signAgreement(renewed.body.agreement_id);
    expect((await api('GET', `/policies/${renewed.body.id}`)).body.status).toBe('ACTIVE');
    expect((await api('GET', `/policies/${policy.id}`)).body.status).toBe('RENEWED');
    expect(await auditActions('POLICY', renewed.body.id)).toContain('POLICY_RENEWED');
    expect((await api('POST', `/policies/${policy.id}`, {})).status).toBe(400);
  });

  it('only endorses active policies and generates an endorsement agreement', async () => {
    const { policy } = await createPolicy();
    const endorsed = await api('PATCH', `/policies/${policy.id}`, {
      changes: [{ type: 'ADD_ON', action: 'ADD', code: 'LEGAL_DEFENSE' }],
      effective_date: isoDate(),
    });
    const endorsement = endorsed.body.endorsements[0];
    const agreement = await api('GET', `/agreements/${endorsement.agreement_id}`);
    expect(agreement.body).toMatchObject({ policy_id: policy.id, endorsement_id: endorsement.id, status: 'DRAFT' });
    expect(endorsed.body.agreement_id).toBe(policy.agreement_id);

    await api('DELETE', `/policies/${policy.id}`, { reason: 'CUSTOMER_REQUEST' });
    const rejected = await api('PATCH', `/policies/${policy.id}`, {
      changes: [{ type: 'DEDUCTIBLE', new_value: '5000' }],
      effective_date: isoDate(),
    });
    expect(rejected.status).toBe(400);
  });

  it('leaves the policy untouched when an endorsement breaks a rule', async () => {
    const { policy } = await createPolicy();
    const res = await api('PATCH', `/policies/${policy.id}`, {
      changes: [{ type: 'DEDUCTIBLE', new_value: '90000' }],
      effective_date: isoDate(),
    });
    expect(res.status).toBe(400);
    expect((await api('GET', `/policies/${policy.id}`)).body.coverage).toEqual(policy.coverage);
  });
});

describe('signing and expiry', () => {
  it('activates a bound policy only once its agreement is signed', async () => {
    const { policy } = await createPolicy({}, { signed: false });
    expect(policy.status).toBe('PENDING');
    expect((await api('POST', '/claims', claimRequest(policy.id))).status).toBe(400);
    await signAgreement(policy.agreement_id);
    expect((await api('GET', `/policies/${policy.id}`)).body.status).toBe('ACTIVE');
    expect((await api('POST', '/claims', claimRequest(policy.id))).status).toBe(201);
  });

  it('cancels an endorsement whose agreement is voided and allows the next one', async () => {
    const { policy } = await createPolicy();
    const endorse = () => api('PATCH', `/policies/${policy.id}`, {
      changes: [{ type: 'DEDUCTIBLE', new_value: '20000' }],
      effective_date: isoDate(),
    });
    const endorsed = await endorse();
    expect(endorsed.body.endorsements[0].status).toBe('PENDING');
    expect((await endorse()).status).toBe(400);

    await api('POST', `/agreements/${endorsed.body.endorsements[0].agreement_id}/void`, { reason: 'Customer changed their mind' });
    const after = (await api('GET', `/policies/${policy.id}`)).body;
    expect(after.endorsements[0].status).toBe('CANCELLED');
    expect(after.coverage).toEqual(policy.coverage);
    expect((await endorse()).status).toBe(200);
  });

  it('expires an active policy after its term and lets it be renewed', async () => {
    const { policy } = await createPolicy({ term: { start_date: isoDate(-30), end_date: isoDate(10) } });
    travelDays(11);
    expect((await api('GET', `/policies/${policy.id}`)).body.status).toBe('EXPIRED');
    expect(await auditActions('POLICY', policy.id)).toContain('POLICY_EXPIRED');
    expect((await api('POST', `/policies/${policy.id}`, {})).body.status).toBe('PENDING');
  });
});

describe('claims', () => {
  it('only accepts incidents inside the coverage period', async () => {
    const { policy } = await createPolicy();
    const before = claimRequest(policy.id, { incident: { ...claimRequest('').incident, date: `${isoDate(-60)}T00:00:00Z` } });
    expect((await api('POST', '/claims', before)).status).toBe(400);
    const future = claimRequest(policy.id, { incident: { ...claimRequest('').incident, date: `${isoDate(5)}T00:00:00Z` } });
    expect((await api('POST', '/claims', future)).status).toBe(400);

    await api('DELETE', `/policies/${policy.id}`, { reason: 'CUSTOMER_REQUEST', effective_date: isoDate(-5) });
    expect((await api('POST', '/claims', claimRequest(policy.id))).status).toBe(400);
    const beforeCancellation = claimRequest(policy.id, {
      incident: { ...claimRequest('').incident, date: `${isoDate(-10)}T00:00:00Z` },
    });
    expect((await api('POST', '/claims', beforeCancellation)).status).toBe(201);
  });

  it('stores documents referenced at submission', async () => {
    const { policy } = await createPolicy();
    const claim = await api('POST', '/claims', claimRequest(policy.id, {
      documents: [{ type: 'INCIDENT_REPORT', url: 'https://example.com/report.pdf' }],
    }));
    expect(claim.body.documents).toHaveLength(1);
    expect((await api('GET', `/documents/${claim.body.documents[0].id}`)).body.type).toBe('INCIDENT_REPORT');
  });

  it('distinguishes partial approvals and stores the adjudication', async () => {
    const { policy } = await createPolicy();
    const { claim, adjudication } = await createApprovedClaim(policy.id, 200_000, 'PARTIAL_APPROVE');
    const stored = await api('GET', `/claims/${claim.id}`);
    expect(stored.body.status).toBe('PARTIALLY_APPROVED');
    expect(stored.body.adjudication).toEqual(adjudication);
    expect(stored.body.actual_loss).toBe(200_000 + policy.coverage.deductible);
  });

  it('enforces limits and deductibles when adjudicating', async () => {
    const { policy } = await createPolicy();
    const claim = await api('POST', '/claims', claimRequest(policy.id));
    const adjudicate = (body: object) => api('POST', `/claims/${claim.body.id}/adjudicate`, {
      decision: 'APPROVE', currency: 'EUR', reason: 'Covered', adjudicator_id: 'adj_1', ...body,
    });
    expect((await adjudicate({ payout_amount: 1_500_000 })).status).toBe(400);
    expect((await adjudicate({ payout_amount: 100, deductible_applied: 0 })).status).toBe(400);
    expect((await adjudicate({})).status).toBe(400);
    expect((await adjudicate({ currency: 'USD', payout_amount: 100 })).status).toBe(400);
    expect((await adjudicate({ decision: 'DENY', payout_amount: 100 })).status).toBe(400);
  });

  it('enforces the aggregate limit across claims', async () => {
    const { policy } = await createPolicy();
    await createApprovedClaim(policy.id, 1_000_000);
    await createApprovedClaim(policy.id, 900_000);
    const third = await api('POST', '/claims', claimRequest(policy.id));
    const res = await api('POST', `/claims/${third.body.id}/adjudicate`, {
      decision: 'APPROVE', payout_amount: 200_000, currency: 'EUR', reason: 'x', adjudicator_id: 'adj_1',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('aggregate');
  });

  it('only allows workflow status changes through PATCH', async () => {
    const { policy } = await createPolicy();
    const claim = await api('POST', '/claims', claimRequest(policy.id));
    expect((await api('PATCH', `/claims/${claim.body.id}`, { status: 'APPROVED' })).status).toBe(400);
    expect((await api('PATCH', `/claims/${claim.body.id}`, { status: 'PAID' })).status).toBe(400);
    await api('POST', `/claims/${claim.body.id}/assign`, { adjuster_id: 'adj_1' });
    expect((await api('PATCH', `/claims/${claim.body.id}`, { status: 'ADJUDICATING' })).body.status).toBe('ADJUDICATING');
  });

  it('only accepts appeals against (partial) denials', async () => {
    const { policy } = await createPolicy();
    const claim = await api('POST', '/claims', claimRequest(policy.id));
    expect((await api('POST', `/claims/${claim.body.id}/appeal`, { reason: 'Unfair' })).status).toBe(400);
    await api('POST', `/claims/${claim.body.id}/adjudicate`, {
      decision: 'DENY', currency: 'EUR', reason: 'Excluded', adjudicator_id: 'adj_1',
    });
    expect((await api('POST', `/claims/${claim.body.id}/appeal`, { reason: 'Unfair' })).body.status).toBe('APPEALED');
  });

  it('filters by the business that holds the policy', async () => {
    const { policy } = await createPolicy();
    await api('POST', '/claims', claimRequest(policy.id, {
      claimant: { type: 'THIRD_PARTY', contact: { name: 'Other', email: 'o@x.de' } },
    }));
    expect((await api('GET', '/claims?business_id=biz_test')).body.total).toBe(1);
  });

  it('records a readable history without duplicates', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id);
    const history = await api('GET', `/claims/${claim.id}/history`);
    expect(history.body.history.map((h: any) => h.action)).toEqual(['SUBMITTED', 'ADJUDICATED']);
  });
});

describe('payouts', () => {
  it('requires an approved claim and stays within the adjudicated amount', async () => {
    const { policy } = await createPolicy();
    const denied = await api('POST', '/claims', claimRequest(policy.id));
    await api('POST', `/claims/${denied.body.id}/adjudicate`, {
      decision: 'DENY', currency: 'EUR', reason: 'Excluded', adjudicator_id: 'adj_1',
    });
    const payout = (claimId: string, amount: number, purpose = 'CYBER_CLAIM') =>
      api('POST', '/payouts', { claim_id: claimId, amount, currency: 'EUR', recipient, purpose });
    expect((await payout(denied.body.id, 100)).status).toBe(400);

    const { claim } = await createApprovedClaim(policy.id, 400_000);
    expect((await payout(claim.id, 400_001)).status).toBe(400);
    expect((await payout(claim.id, 100, 'DNO_CLAIM')).status).toBe(400);
    expect((await payout(claim.id, 300_000)).status).toBe(201);
    expect((await payout(claim.id, 100_001)).status).toBe(400);
  });

  it('marks the claim PAID only when the transfers settle', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id, 400_000);
    const payout = await api('POST', '/payouts', {
      claim_id: claim.id, amount: 400_000, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM',
    });
    expect((await api('GET', `/claims/${claim.id}`)).body.status).toBe('APPROVED');

    travelDays(3);
    expect((await api('GET', `/payouts/${payout.body.id}`)).body.status).toBe('COMPLETED');
    const paid = await api('GET', `/claims/${claim.id}`);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.closed_at).not.toBeNull();
    expect(await auditActions('CLAIM', claim.id)).toEqual(['CLAIM_SUBMITTED', 'CLAIM_ADJUDICATED', 'CLAIM_PAID']);
  });

  it('frees the amount again when a payout is cancelled', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id, 400_000);
    const body = { claim_id: claim.id, amount: 400_000, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM' };
    const first = await api('POST', '/payouts', body);
    const cancelled = await api('POST', `/payouts/${first.body.id}`, { reason: 'ERROR' });
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await api('GET', `/claims/${claim.id}`)).body.status).toBe('APPROVED');
    expect((await api('POST', '/payouts', body)).status).toBe(201);
    expect(await auditActions('PAYOUT', first.body.id)).toEqual(['PAYOUT_INITIATED', 'PAYOUT_CANCELLED']);
  });
});

function invoiceRequest(policy: any, overrides: Record<string, any> = {}) {
  return {
    policy_id: policy.id,
    type: 'PREMIUM',
    amount: policy.premium.gross,
    currency: 'EUR',
    due_date: isoDate(14),
    items: [{ description: 'Premium', amount: policy.premium.net, tax_rate: 0.19 }],
    billing_address: { street: 'Musterstraße 1', city: 'Berlin', postal_code: '10115', country: 'DE' },
    ...overrides,
  };
}

async function addPaymentMethod(businessId = 'biz_test') {
  const res = await api('POST', '/payment-methods', {
    business_id: businessId,
    type: 'SEPA',
    details: { holder_name: 'TechCorp', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
  });
  return res.body;
}

describe('billing', () => {
  it('keeps the requested amount and due date, and rejects mismatching items', async () => {
    const { policy } = await createPolicy();
    const invoice = await api('POST', '/invoices', invoiceRequest(policy));
    expect(invoice.status).toBe(201);
    expect(invoice.body).toMatchObject({ amount: policy.premium.gross, due_date: isoDate(14), status: 'PENDING' });
    expect((await api('POST', '/invoices', invoiceRequest(policy, { amount: 999 }))).status).toBe(400);
  });

  it('validates payments and marks the invoice PAID when settled', async () => {
    const { policy } = await createPolicy();
    const invoice = (await api('POST', '/invoices', invoiceRequest(policy))).body;
    const method = await addPaymentMethod();
    const foreign = await addPaymentMethod('biz_other');
    const pay = (body: object) => api('POST', `/invoices/${invoice.id}/pay`, {
      payment_method_id: method.id, amount: invoice.amount, currency: 'EUR', ...body,
    });

    expect((await pay({ payment_method_id: 'pm_missing' })).status).toBe(400);
    expect((await pay({ payment_method_id: foreign.id })).status).toBe(400);
    expect((await pay({ amount: -5 })).status).toBe(400);
    expect((await pay({ currency: 'USD' })).status).toBe(400);
    expect((await pay({ amount: invoice.amount + 1 })).status).toBe(400);

    const partial = await pay({ amount: 100 });
    expect(partial.body).toMatchObject({ status: 'COMPLETED', gateway: 'MOLLIE' });
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PENDING');
    await pay({ amount: Math.round((invoice.amount - 100) * 100) / 100 });
    const paid = await api('GET', `/invoices/${invoice.id}`);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.paid_at).not.toBeNull();
    expect((await pay({ amount: 1 })).status).toBe(400);
  });

  it('bounds refunds by what was paid', async () => {
    const { policy } = await createPolicy();
    const invoice = (await api('POST', '/invoices', invoiceRequest(policy))).body;
    expect((await api('POST', `/invoices/${invoice.id}/refund`, { amount: 10, reason: 'ERROR' })).status).toBe(400);

    const method = await addPaymentMethod();
    await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: invoice.amount, currency: 'EUR' });
    expect((await api('POST', `/invoices/${invoice.id}/refund`, { amount: invoice.amount + 1, reason: 'ERROR' })).status).toBe(400);

    const partial = await api('POST', `/invoices/${invoice.id}/refund`, { amount: 100, reason: 'ERROR' });
    expect(partial.status).toBe(201);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('PAID');

    await api('POST', `/invoices/${invoice.id}/refund`, { amount: Math.round((invoice.amount - 100) * 100) / 100, reason: 'CANCELLATION' });
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('REFUNDED');
    const payments = await api('GET', `/invoices/${invoice.id}/payments`);
    expect(payments.body.payments.every((p: any) => p.status === 'REFUNDED')).toBe(true);
  });

  it('stores payment methods per business with a single default', async () => {
    const first = await addPaymentMethod();
    expect(first).toMatchObject({ business_id: 'biz_test', is_default: true });
    const second = await api('POST', '/payment-methods', {
      business_id: 'biz_test', type: 'SEPA', is_default: true,
      details: { holder_name: 'T', iban: 'NL91ABNA0417164300', bic: 'ABNANL2A' },
    });
    expect(second.body.details).toEqual({ holder_name: 'T', masked_iban: '****4300' });
    const list = await api('GET', '/payment-methods?business_id=biz_test');
    expect(list.body.payment_methods.filter((m: any) => m.is_default).map((m: any) => m.id)).toEqual([second.body.id]);
    const missingIban = await api('POST', '/payment-methods', { business_id: 'b', type: 'SEPA', details: { holder_name: 'x' } });
    expect(missingIban.status).toBe(400);
  });

  it('only duns overdue invoices, escalating up to a final notice', async () => {
    const { policy } = await createPolicy();
    const invoice = (await api('POST', '/invoices', invoiceRequest(policy))).body;
    expect((await api('POST', `/dunning/${invoice.id}`)).status).toBe(400);

    travelDays(20);
    expect((await api('GET', `/invoices/${invoice.id}`)).body.status).toBe('OVERDUE');
    const levels = [];
    for (let i = 0; i < 3; i++) levels.push((await api('POST', `/dunning/${invoice.id}`)).body.dunning_level);
    expect(levels).toEqual([1, 2, 3]);
    expect((await api('POST', `/dunning/${invoice.id}`)).status).toBe(400);
    expect(await auditActions('INVOICE', invoice.id)).toEqual([
      'INVOICE_CREATED', 'DUNNING_TRIGGERED', 'DUNNING_TRIGGERED', 'DUNNING_TRIGGERED',
    ]);
  });
});
