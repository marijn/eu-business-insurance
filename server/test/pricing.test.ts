import { api, quoteRequest, resetState, startServer, stopServer } from './helpers';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

const assess = (policy_type: string, data: Record<string, unknown>, country = 'DE') =>
  api('POST', '/underwriting/assess', { policy_type, business_id: 'biz_test', country, data });

describe('rating model per policy type', () => {
  it('prices a high-risk cyber business', async () => {
    const res = await assess('CYBER', {
      revenue: 20_000_000,
      industry: 'FINANCE',
      cyber_risk_factors: { has_mfa: false, has_encryption: false, incident_history: [{ date: '2025-01-01', severity: 'HIGH', description: 'x' }] },
    });
    expect(res.body).toMatchObject({
      risk_score: 0.9,
      premium_base: 20_000,
      final_premium: 31_000,
      requirements: ['CYBER_TRAINING', 'ANNUAL_AUDIT'],
      exclusions: ['TERRORISM'],
      recommendations: ['Implement additional risk controls', 'Implement multi-factor authentication'],
    });
    expect(res.body.premium_adjustments).toEqual([
      { factor: 'SECURITY', multiplier: 0.4, reason: 'High risk score' },
      { factor: 'INDUSTRY', multiplier: 0.1, reason: 'High-risk industry' },
      { factor: 'REVENUE', multiplier: 0.05, reason: 'High revenue' },
    ]);
  });

  it('prices D&O from flat risk factors', async () => {
    const res = await assess('DNO', { revenue: 60_000_000, industry: 'TECHNOLOGY', governance_score: 5, past_litigation: true });
    expect(res.body).toMatchObject({
      risk_score: 0.9,
      premium_base: 30_000,
      final_premium: 43_500,
      requirements: ['FINANCIAL_STATEMENTS', 'ANNUAL_AUDIT'],
      recommendations: ['Implement additional risk controls', 'Improve corporate governance practices'],
    });
  });

  it('applies the minimum premium to a low-risk D&O business without revenue', async () => {
    const res = await assess('DNO', { dno_risk_factors: { governance_score: 9 } });
    expect(res.body).toMatchObject({ risk_score: 0.4, premium_base: 0, final_premium: 500, recommendations: [] });
  });

  it('prices surety on the project size', async () => {
    const res = await assess('SURETY', { surety_risk_factors: { financial_strength: 'POOR', past_defaults: 2, project_size: 3_000_000 } });
    expect(res.body).toMatchObject({
      risk_score: 1,
      premium_base: 6_000,
      final_premium: 9_000,
      requirements: ['FINANCIAL_STATEMENTS', 'ANNUAL_AUDIT'],
      exclusions: ['TERRORISM'],
    });
    expect(res.body.premium_adjustments).toEqual([{ factor: 'OTHER', multiplier: 0.5, reason: 'High risk score' }]);
  });

  it('falls back to revenue, then zero, for surety exposure', async () => {
    expect((await assess('SURETY', { revenue: 1_000_000 })).body.premium_base).toBe(2_000);
    expect((await assess('SURETY', {})).body).toMatchObject({ premium_base: 0, final_premium: 500 });
  });

  it("prices workers' compensation per employee", async () => {
    const res = await assess('WORKERS_COMP', {
      employee_count: 100, industry_risk_level: 'HIGH', past_claims: 9, safety_training: false,
    });
    expect(res.body).toMatchObject({
      risk_score: 0.8,
      premium_base: 50_000,
      final_premium: 65_000,
      requirements: ['SAFETY_INSPECTION'],
      exclusions: [],
      recommendations: ['Implement additional risk controls', 'Introduce safety training'],
    });
    expect((await assess('WORKERS_COMP', { safety_training: true })).body).toMatchObject({ risk_score: 0.3, final_premium: 500 });
  });

  it('prices a coverage amount or a full coverage object when supplied', async () => {
    const amount = await assess('CYBER', { revenue: 1_000_000, cyber_risk_factors: { has_mfa: true, has_encryption: true }, coverage_amount: 2_000_000 });
    expect(amount.body).toMatchObject({ premium_base: 3_000, final_premium: 3_000 });
    const coverage = await assess('CYBER', {
      revenue: 1_000_000,
      cyber_risk_factors: { has_mfa: true, has_encryption: true },
      coverage: { limits: { per_claim: 2_000_000 } },
    });
    expect(coverage.body.final_premium).toBe(amount.body.final_premium);
  });

  it('rejects assessments for non-EU countries and rule violations', async () => {
    expect((await assess('CYBER', { revenue: 1 }, 'US')).status).toBe(400);
    expect((await assess('CYBER', { coverage_amount: 10_000 })).status).toBe(400);
    expect((await assess('CYBER', { coverage: { limits: { per_claim: 2_000_000, aggregate: 1_000_000 } } })).status).toBe(400);
  });

  it('reports EU eligibility in the published rules', async () => {
    const eu = await api('GET', '/underwriting/rules/FR/DNO');
    expect(eu.body.rules[2].description).toContain('FR is eligible');
    const nonEu = await api('GET', '/underwriting/rules/US/DNO');
    expect(nonEu.body.rules[2].description).toContain('US is not eligible');
    expect((await api('GET', '/underwriting/rules/de/DNO')).status).toBe(400);
  });

  it('returns country-specific baseline requirements', async () => {
    const requirements = (policy_type: string, country?: string) =>
      api('POST', '/underwriting/requirements', { business_id: 'b', policy_type, country });
    expect((await requirements('CYBER', 'FR')).body.requirements).toEqual(['CYBER_TRAINING']);
    expect((await requirements('SURETY')).body.requirements).toEqual(['FINANCIAL_STATEMENTS']);
    expect((await requirements('WORKERS_COMP')).body.requirements).toEqual(['SAFETY_INSPECTION']);
  });
});

describe('quote validation', () => {
  it('rejects a term that ends before it starts', async () => {
    const res = await api('POST', '/quotes', quoteRequest({ term: { start_date: '2026-06-01', end_date: '2026-05-01' } }));
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('term.end_date');
  });

  it("requires an employee count for workers' compensation", async () => {
    const details = { ...quoteRequest().business_details, employee_count: undefined };
    const res = await api('POST', '/quotes', quoteRequest({ policy_type: 'WORKERS_COMP', business_details: details }));
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('business_details.employee_count');
  });

  it('rejects an aggregate limit below the per-claim limit', async () => {
    const res = await api('POST', '/quotes', quoteRequest({
      coverage_request: { limits: { per_claim: 2_000_000, aggregate: 1_000_000 }, deductible: 0 },
    }));
    expect(res.status).toBe(400);
  });

  it('reports a body that is not an object as a body error', async () => {
    const res = await api('POST', '/quotes', []);
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'body', message: expect.any(String) }]);
  });

  it('filters and looks up quotes', async () => {
    await api('POST', '/quotes', quoteRequest());
    await api('POST', '/quotes', quoteRequest({ business_id: 'biz_other', policy_type: 'DNO' }));
    expect((await api('GET', '/quotes?business_id=biz_other')).body.total).toBe(1);
    expect((await api('GET', '/quotes?policy_type=CYBER')).body.total).toBe(1);
    expect((await api('GET', '/quotes?status=ACCEPTED')).body.total).toBe(0);
    expect((await api('GET', '/quotes?limit=1&offset=1')).body).toMatchObject({ total: 2, limit: 1, offset: 1 });
    expect((await api('GET', '/quotes/quote_missing')).status).toBe(404);
    expect((await api('POST', '/quotes/quote_missing', {})).status).toBe(404);
  });
});
