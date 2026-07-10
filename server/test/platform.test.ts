import {
  api,
  apiUrl,
  auditActions,
  createPolicy,
  isoDate,
  quoteRequest,
  resetState,
  startServer,
  stopServer,
  token,
  travelDays,
  signPendingEndorsement,
} from './helpers';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

describe('authentication and scopes', () => {
  it('rejects requests without credentials', async () => {
    const res = await api('GET', '/policies', undefined, {});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid bearer token', async () => {
    const res = await api('GET', '/policies', undefined, { Authorization: 'Bearer nope' });
    expect(res.status).toBe(401);
  });

  it('enforces read/write scopes per resource', async () => {
    const readOnly = { Authorization: `Bearer ${token(['policy:read'])}` };
    expect((await api('GET', '/policies', undefined, readOnly)).status).toBe(200);
    expect((await api('POST', '/quotes', quoteRequest(), readOnly)).status).toBe(403);
    expect((await api('GET', '/claims', undefined, readOnly)).status).toBe(403);
  });

  it('requires claims:adjudicate to adjudicate', async () => {
    const { policy } = await createPolicy();
    const claim = await api('POST', '/claims', {
      policy_id: policy.id,
      claimant: { type: 'INSURED', contact: { name: 'a', email: 'a@b.de' } },
      incident: { type: 'CYBER_BREACH', date: `${isoDate(-1)}T00:00:00Z`, description: 'x' },
    });
    const body = { decision: 'DENY', reason: 'Excluded', adjudicator_id: 'adj_1' };
    const writer = { Authorization: `Bearer ${token(['claims:read', 'claims:write'])}` };
    expect((await api('POST', `/claims/${claim.body.id}/adjudicate`, body, writer)).status).toBe(403);
    const adjudicator = { Authorization: `Bearer ${token(['claims:write', 'claims:adjudicate'], 'adj_1')}` };
    const res = await api('POST', `/claims/${claim.body.id}/adjudicate`, body, adjudicator);
    expect(res.status).toBe(200);
    expect((await auditActions('CLAIM', claim.body.id))).toContain('CLAIM_ADJUDICATED');
  });

  it('records the authenticated user in the audit trail', async () => {
    const headers = { Authorization: `Bearer ${token(['policy:write', 'compliance:read'], 'user_42')}` };
    const quote = await api('POST', '/quotes', quoteRequest(), headers);
    const entries = await api('GET', `/compliance/audit?entity_id=${quote.body.id}`);
    expect(entries.body.entries[0]).toMatchObject({ action: 'QUOTE_CREATED', user_id: 'user_42' });
  });
});

describe('validation', () => {
  it('returns 400 with field details for invalid bodies', async () => {
    const res = await api('POST', '/quotes', {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.map((d: any) => d.field)).toContain('policy_type');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await fetch(apiUrl('/quotes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'test-api-key-1' },
      body: '{"broken": ',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).code).toBe('VALIDATION_ERROR');
  });
});

describe('pricing', () => {
  it('makes gross equal net plus taxes', async () => {
    const quote = await api('POST', '/quotes', quoteRequest());
    const { gross, net, taxes } = quote.body.premium;
    const taxTotal = taxes.reduce((sum: number, t: any) => sum + t.amount, 0);
    expect(gross).toBeCloseTo(net + taxTotal, 2);
  });

  it("taxes at the policyholder country's VAT rate", async () => {
    const fr = await api('POST', '/quotes', quoteRequest({
      business_details: { ...quoteRequest().business_details, country: 'FR' },
    }));
    expect(fr.body.premium.taxes).toEqual([{ type: 'VAT', rate: 0.2, amount: expect.any(Number) }]);
  });

  it('rejects non-EU businesses', async () => {
    const res = await api('POST', '/quotes', quoteRequest({
      business_details: { ...quoteRequest().business_details, country: 'US' },
    }));
    expect(res.status).toBe(400);
  });

  it('prices a quote exactly like an underwriting assessment of the same input', async () => {
    const request = quoteRequest();
    const quote = await api('POST', '/quotes', request);
    const assessment = await api('POST', '/underwriting/assess', {
      policy_type: 'CYBER',
      business_id: request.business_id,
      country: 'DE',
      data: { ...request.business_details, coverage: request.coverage_request },
    });
    expect(assessment.status).toBe(200);
    expect(assessment.body.final_premium).toBe(quote.body.premium.net);
    expect(assessment.body.risk_score).toBe(quote.body.underwriting.risk_score);
    expect(assessment.body.requirements).toEqual(quote.body.underwriting.requirements);
  });

  it('is deterministic', async () => {
    const a = await api('POST', '/quotes', quoteRequest());
    const b = await api('POST', '/quotes', quoteRequest());
    expect(a.body.premium).toEqual(b.body.premium);
  });

  it('enforces the published underwriting rules', async () => {
    const rules = await api('GET', '/underwriting/rules/DE/CYBER');
    expect(rules.body.rules.map((r: any) => r.code)).toEqual(['MIN_COVERAGE', 'MAX_DEDUCTIBLE', 'EU_JURISDICTION']);

    const lowLimit = await api('POST', '/quotes', quoteRequest({
      coverage_request: { limits: { per_claim: 500_000 }, deductible: 0 },
    }));
    expect(lowLimit.status).toBe(400);
    const highDeductible = await api('POST', '/quotes', quoteRequest({
      coverage_request: { limits: { per_claim: 1_000_000 }, deductible: 100_000 },
    }));
    expect(highDeductible.status).toBe(400);
  });

  it('returns baseline requirements that are a subset of the assessed ones', async () => {
    const baseline = await api('POST', '/underwriting/requirements', { business_id: 'b', policy_type: 'CYBER', country: 'DE' });
    const quote = await api('POST', '/quotes', quoteRequest());
    for (const requirement of baseline.body.requirements) {
      expect(quote.body.underwriting.requirements).toContain(requirement);
    }
  });

  it('keeps the premium when an endorsement does not change coverage', async () => {
    const { policy } = await createPolicy();
    const endorsed = await api('PATCH', `/policies/${policy.id}`, {
      changes: [{ type: 'TERM', field: 'end_date', new_value: isoDate(400) }],
      effective_date: isoDate(),
    });
    expect(endorsed.status).toBe(200);
    const applied = await signPendingEndorsement(policy.id);
    expect(applied.premium).toEqual(policy.premium);
    expect(applied.term.end_date).toBe(isoDate(400));
  });

  it('re-prices coverage changes with the quote model', async () => {
    const { policy } = await createPolicy();
    const endorsed = await api('PATCH', `/policies/${policy.id}`, {
      changes: [{ type: 'COVERAGE_LIMIT', field: 'per_claim', new_value: '2000000' }],
      effective_date: isoDate(),
    });
    const fresh = await api('POST', '/quotes', quoteRequest({
      coverage_request: { ...quoteRequest().coverage_request, limits: { per_claim: 2_000_000, aggregate: 2_000_000 } },
    }));
    expect(endorsed.body.premium).toEqual(policy.premium);
    expect((await signPendingEndorsement(policy.id)).premium).toEqual(fresh.body.premium);
  });
});

describe('audit trail', () => {
  it('records a specific action for every operation', async () => {
    const { policy } = await createPolicy();
    await api('POST', '/payment-methods', {
      business_id: 'biz_test',
      type: 'SEPA',
      details: { holder_name: 'TechCorp', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
    });
    await api('DELETE', `/policies/${policy.id}`, { reason: 'CUSTOMER_REQUEST' });

    expect(await auditActions('POLICY', policy.id)).toEqual(['POLICY_BOUND', 'POLICY_ACTIVATED', 'POLICY_CANCELLED']);
    const methods = await api('GET', '/compliance/audit?entity_type=PAYMENT_METHOD');
    expect(methods.body.entries.map((e: any) => e.action)).toEqual(['PAYMENT_METHOD_ADDED']);
    const agreement = await api('GET', `/compliance/audit?entity_type=AGREEMENT`);
    expect(agreement.body.entries.map((e: any) => e.action)).toEqual(['AGREEMENT_GENERATED', 'AGREEMENT_SIGNING_INITIATED', 'AGREEMENT_SIGNED']);
  });

  it('assigns action ids that can be looked up', async () => {
    const created = await api('POST', '/compliance/audit', {
      action: 'QUOTE_CREATED',
      entity_type: 'QUOTE',
      entity_id: 'quote_1',
      user_id: 'u',
      timestamp: new Date().toISOString(),
    });
    expect(created.status).toBe(201);
    const fetched = await api('GET', `/compliance/audit/${created.body.action_id}`);
    expect(fetched.body).toEqual(created.body);
  });
});

describe('time-based transitions', () => {
  it('expires quotes after 7 days', async () => {
    const quote = await api('POST', '/quotes', quoteRequest());
    travelDays(8);
    expect((await api('GET', `/quotes/${quote.body.id}`)).body.status).toBe('EXPIRED');
    expect((await api('POST', `/quotes/${quote.body.id}`, {})).status).toBe(400);
  });
});
