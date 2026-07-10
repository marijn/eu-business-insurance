import {
  api,
  claimRequest,
  createApprovedClaim,
  createPolicy,
  recipient,
  resetState,
  startServer,
  stopServer,
  travelDays,
} from './helpers';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

function pdfUpload(fields: Record<string, string>, content = '%PDF-1.4 test') {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), 'report.pdf');
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

describe('documents', () => {
  it('uploads, lists and downloads the actual file', async () => {
    const { policy } = await createPolicy();
    const uploaded = await api('POST', '/documents/upload', pdfUpload({
      entity_type: 'POLICY', entity_id: policy.id, type: 'POLICY_DOCUMENT',
    }));
    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toMatchObject({ file_name: 'report.pdf', mime_type: 'application/pdf', size: 13 });

    const list = await api('GET', `/documents?entity_type=POLICY&entity_id=${policy.id}`);
    expect(list.body.documents.map((d: any) => d.id)).toEqual([uploaded.body.id]);

    const download = await api('GET', `/documents/${uploaded.body.id}/download`);
    expect(download.body.toString()).toBe('%PDF-1.4 test');
  });

  it('rejects uploads for entities that do not exist', async () => {
    const res = await api('POST', '/documents/upload', pdfUpload({
      entity_type: 'POLICY', entity_id: 'pol_missing', type: 'POLICY_DOCUMENT',
    }));
    expect(res.status).toBe(400);
  });

  it('removes deleted documents from their claim', async () => {
    const { policy } = await createPolicy();
    const claim = await api('POST', '/claims', claimRequest(policy.id));
    const doc = await api('POST', `/claims/${claim.body.id}/documents`, pdfUpload({ type: 'POLICE_REPORT' }));
    expect(doc.status).toBe(201);
    expect((await api('GET', `/claims/${claim.body.id}`)).body.documents).toHaveLength(1);

    await api('DELETE', `/documents/${doc.body.id}`);
    expect((await api('GET', `/claims/${claim.body.id}`)).body.documents).toHaveLength(0);
    const history = await api('GET', `/claims/${claim.body.id}/history`);
    expect(history.body.history.map((h: any) => h.action)).toEqual(['SUBMITTED', 'DOCUMENT_ADDED']);
  });
});

describe('GDPR erasure', () => {
  it('erases personal data of a business but keeps financial records', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id);
    const payout = await api('POST', '/payouts', {
      claim_id: claim.id, amount: 1000, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM',
    });
    await api('POST', '/payment-methods', {
      business_id: 'biz_test', type: 'SEPA',
      details: { holder_name: 'TechCorp', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
    });

    const res = await api('POST', '/compliance/gdpr/erasure', {
      entity_type: 'BUSINESS', entity_id: 'biz_test', requester_email: 'dpo@techcorp.de',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', erased_records: { claims: 1, payouts: 1, payment_methods: 1 } });

    const erasedClaim = await api('GET', `/claims/${claim.id}`);
    expect(erasedClaim.body.claimant.contact).toMatchObject({ name: '[erased]', email: '[erased]' });
    expect(erasedClaim.body.adjudication.payout_amount).toBe(400_000);
    const erasedPayout = await api('GET', `/payouts/${payout.body.id}`);
    expect(erasedPayout.body.recipient).toMatchObject({ name: '[erased]', iban: '****3000' });
    expect(erasedPayout.body.amount).toBe(1000);

    const auditEntry = await api('GET', '/compliance/audit?entity_type=GDPR_REQUEST');
    expect(auditEntry.body.entries[0]).toMatchObject({ action: 'GDPR_ERASURE_COMPLETED', user_id: 'api-user' });
  });

  it('validates the request and the subject', async () => {
    expect((await api('POST', '/compliance/gdpr/erasure', { entity_type: 'CLAIM', entity_id: 'x', requester_email: 'nope' })).status).toBe(400);
    expect((await api('POST', '/compliance/gdpr/erasure', { entity_type: 'CLAIM', entity_id: 'claim_x', requester_email: 'a@b.de' })).status).toBe(404);
  });
});

describe('Solvency II report', () => {
  it('is computed from premiums, payouts and claim reserves', async () => {
    const { policy } = await createPolicy();
    const invoice = (await api('POST', '/invoices', {
      policy_id: policy.id, type: 'PREMIUM', amount: 11900, currency: 'EUR', due_date: '2030-01-01',
      items: [{ description: 'Premium', amount: 10000, tax_rate: 0.19 }],
      billing_address: { street: 's', city: 'c', postal_code: '1', country: 'DE' },
    })).body;
    const method = (await api('POST', '/payment-methods', {
      business_id: 'biz_test', type: 'SEPA',
      details: { holder_name: 'T', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
    })).body;
    await api('POST', `/invoices/${invoice.id}/pay`, { payment_method_id: method.id, amount: 11900, currency: 'EUR' });
    await api('POST', '/claims', claimRequest(policy.id));
    const { claim } = await createApprovedClaim(policy.id, 4000);
    await api('POST', '/payouts', { claim_id: claim.id, amount: 1000, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM' });
    travelDays(3);

    const report = await api('GET', '/compliance/reports/solvency-ii?period=ANNUAL');
    expect(report.status).toBe(200);
    expect(typeof report.body.year).toBe('number');
    expect(report.body.data).toEqual({ assets: 10900, liabilities: 503000, solvency_ratio: 0.02 });
  });

  it('validates period and year', async () => {
    expect((await api('GET', '/compliance/reports/solvency-ii?period=MONTHLY')).status).toBe(400);
    expect((await api('GET', '/compliance/reports/solvency-ii?year=2019')).status).toBe(400);
    expect((await api('GET', '/compliance/reports/solvency-ii?year=2999')).status).toBe(400);
  });
});
