import { createHmac } from 'crypto';
import {
  api,
  apiUrl,
  auditActions,
  claimRequest,
  createApprovedClaim,
  createPolicy,
  isoDate,
  recipient,
  resetState,
  startServer,
  stopServer,
  travelDays,
  signPendingEndorsement,
} from './helpers';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

const endorse = (policyId: string, changes: object[]) =>
  api('PATCH', `/policies/${policyId}`, { changes, effective_date: isoDate() });

function upload(fields: Record<string, string>, type = 'application/pdf', withFile = true) {
  const form = new FormData();
  if (withFile) form.append('file', new Blob(['content'], { type }), 'file.bin');
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

describe('policy endorsements', () => {
  it('applies every change type', async () => {
    const { policy } = await createPolicy();
    const res = await endorse(policy.id, [
      { type: 'COVERAGE_LIMIT', field: 'aggregate', new_value: '3000000' },
      { type: 'ADD_ON', action: 'ADD', code: 'LEGAL_DEFENSE' },
      { type: 'ADD_ON', action: 'REMOVE', code: 'DATA_BREACH_RESPONSE' },
      { type: 'EXCLUSION', action: 'ADD', code: 'ACTS_OF_WAR' },
      { type: 'TERM', field: 'start_date', new_value: isoDate(-40) },
      { type: 'ADDRESS', field: 'street', new_value: 'Neue Straße 2' },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.coverage).toEqual(policy.coverage);
    const applied = await signPendingEndorsement(policy.id);
    expect(applied.coverage).toMatchObject({
      limits: { per_claim: 1_000_000, aggregate: 3_000_000 },
      add_ons: ['LEGAL_DEFENSE'],
      exclusions: ['ACTS_OF_WAR'],
    });
    expect(applied.term.start_date).toBe(isoDate(-40));

    await endorse(policy.id, [{ type: 'EXCLUSION', action: 'REMOVE', code: 'ACTS_OF_WAR' }]);
    const removed = await signPendingEndorsement(policy.id);
    expect(removed.coverage.exclusions).toEqual([]);
    expect(removed.endorsements.map((e: any) => e.status)).toEqual(['ACTIVE', 'ACTIVE']);
  });

  it('rejects malformed changes', async () => {
    const { policy } = await createPolicy();
    const invalid = [
      { type: 'COVERAGE_LIMIT', field: 'per_claim', new_value: 'lots' },
      { type: 'COVERAGE_LIMIT', field: 'deductible', new_value: '1' },
      { type: 'DEDUCTIBLE' },
      { type: 'ADD_ON', action: 'ADD' },
      { type: 'EXCLUSION', action: 'ADD' },
      { type: 'TERM', field: 'end_date', new_value: 'next year' },
      { type: 'TERM', field: 'renewal_date', new_value: isoDate(10) },
      { type: 'TERM', field: 'end_date', new_value: isoDate(-100) },
    ];
    for (const change of invalid) {
      const res = await endorse(policy.id, [change]);
      expect([res.status, change]).toEqual([400, change]);
    }
    expect((await api('GET', `/policies/${policy.id}`)).body.endorsements).toEqual([]);
  });

  it('looks up and filters policies', async () => {
    const { policy } = await createPolicy();
    await createPolicy({ business_id: 'biz_other', policy_type: 'DNO' });
    expect((await api('GET', '/policies?business_id=biz_other')).body.total).toBe(1);
    expect((await api('GET', '/policies?policy_type=CYBER')).body.policies[0].id).toBe(policy.id);
    expect((await api('GET', '/policies?status=CANCELLED')).body.total).toBe(0);
    expect((await api('GET', `/policies/${policy.id}/coverage`)).body).toEqual(policy.coverage);
    expect((await api('GET', '/policies/pol_missing')).status).toBe(404);
  });
});

describe('renewals and cancellations', () => {
  it('renews with coverage changes for a default one-year term', async () => {
    const { policy } = await createPolicy();
    const renewed = await api('POST', `/policies/${policy.id}`, {
      changes: [{ type: 'DEDUCTIBLE', new_value: '20000' }],
    });
    expect(renewed.body.coverage.deductible).toBe(20_000);
    expect(renewed.body.term.start_date).toBe(policy.term.end_date);
    expect(renewed.body.premium.net).toBeLessThan(policy.premium.net);
  });

  it('rejects a renewal term that ends before it starts', async () => {
    const { policy } = await createPolicy();
    const res = await api('POST', `/policies/${policy.id}`, { term: { start_date: isoDate(400), end_date: isoDate(300) } });
    expect(res.status).toBe(400);
  });

  it('rejects a cancellation dated before the policy started', async () => {
    const { policy } = await createPolicy();
    const res = await api('DELETE', `/policies/${policy.id}`, { reason: 'OTHER', effective_date: isoDate(-90) });
    expect(res.status).toBe(400);
    expect((await api('GET', `/policies/${policy.id}`)).body.status).toBe('ACTIVE');
  });
});

describe('agreements', () => {
  it('serves agreements as PDF and lists their versions', async () => {
    const { policy } = await createPolicy({}, { signed: false });
    const pdf = await fetch(apiUrl(`/agreements/${policy.agreement_id}?format=pdf`), { headers: { 'X-API-KEY': 'test-api-key-1' } });
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    const versions = await api('GET', `/agreements/${policy.agreement_id}/versions`);
    expect(versions.body.versions).toEqual([{ version: 'CYBER_POLICY_v1', created_at: expect.any(String), changes: ['Initial version'] }]);
    expect((await api('GET', `/agreements/${policy.agreement_id}/signatures`)).body).toMatchObject({ signatories: [], all_signed: false });
    expect((await api('GET', '/agreements/agreement_missing')).status).toBe(404);
  });

  it('only generates agreements for live policies and their own endorsements', async () => {
    const generate = (body: object) => api('POST', '/agreements/generate', { template_id: 'T', language: 'en', ...body });
    expect((await generate({ policy_id: 'pol_missing' })).status).toBe(404);

    const { policy } = await createPolicy();
    expect((await generate({ policy_id: policy.id, endorsement_id: 'end_unknown' })).status).toBe(400);

    await api('DELETE', `/policies/${policy.id}`, { reason: 'CUSTOMER_REQUEST' });
    expect((await generate({ policy_id: policy.id })).status).toBe(400);
  });

  it('regenerates an endorsement agreement until it is signed', async () => {
    const { policy } = await createPolicy();
    const endorsed = await endorse(policy.id, [{ type: 'ADD_ON', action: 'ADD', code: 'LEGAL_DEFENSE' }]);
    const endorsement = endorsed.body.endorsements[0];
    const generate = () => api('POST', '/agreements/generate', {
      policy_id: policy.id, endorsement_id: endorsement.id, template_id: 'CYBER_ENDORSEMENT_v2', language: 'de',
    });

    const regenerated = await generate();
    expect(regenerated.body.endorsement_id).toBe(endorsement.id);
    expect((await api('GET', `/agreements/${endorsement.agreement_id}`)).body.status).toBe('VOIDED');

    await api('POST', `/agreements/${regenerated.body.id}/sign`, { signatory_email: 'jane@techcorp.de' });
    const envelopeId = (await api('GET', `/agreements/${regenerated.body.id}`)).body.envelope_id;
    await docusign({ event: 'recipient-completed', data: { envelopeId, recipientId: '1' } });

    const res = await generate();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('The endorsement agreement is already signed');
  });
});

async function docusign(payload: object, key = 'test-connect-key') {
  const body = JSON.stringify(payload);
  const response = await fetch(apiUrl('/webhooks/docusign'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-DocuSign-Signature-1': createHmac('sha256', key).update(body).digest('base64') },
    body,
  });
  return { status: response.status, body: await response.json() as any };
}

describe('DocuSign webhook edge cases', () => {
  async function pendingAgreement(emails: string[]) {
    const { policy } = await createPolicy({}, { signed: false });
    for (const email of emails) await api('POST', `/agreements/${policy.agreement_id}/sign`, { signatory_email: email });
    return (await api('GET', `/agreements/${policy.agreement_id}`)).body;
  }

  it('rejects every delivery while no HMAC key is configured', async () => {
    const agreement = await pendingAgreement(['a@b.de']);
    const saved = process.env.DOCUSIGN_CONNECT_HMAC_KEYS;
    delete process.env.DOCUSIGN_CONNECT_HMAC_KEYS;
    try {
      expect((await docusign({ event: 'recipient-completed', data: { envelopeId: agreement.envelope_id, recipientId: '1' } })).status).toBe(401);
    } finally {
      process.env.DOCUSIGN_CONNECT_HMAC_KEYS = saved;
    }
  });

  it('accepts unsigned deliveries only when DOCUSIGN_CONNECT_SKIP_VERIFY is true', async () => {
    const agreement = await pendingAgreement(['a@b.de']);
    const unsigned = () => fetch(apiUrl('/webhooks/docusign'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'envelope-completed', data: { envelopeId: agreement.envelope_id } }),
    });
    expect((await unsigned()).status).toBe(401);
    process.env.DOCUSIGN_CONNECT_SKIP_VERIFY = 'true';
    try {
      expect((await unsigned()).status).toBe(200);
    } finally {
      delete process.env.DOCUSIGN_CONNECT_SKIP_VERIFY;
    }
    expect((await api('GET', `/agreements/${agreement.id}`)).body.status).toBe('SIGNED');
  });

  it('marks the agreement DECLINED on envelope-declined', async () => {
    const agreement = await pendingAgreement(['a@b.de']);
    await docusign({ event: 'envelope-declined', data: { envelopeId: agreement.envelope_id } });
    expect((await api('GET', `/agreements/${agreement.id}`)).body.status).toBe('DECLINED');
  });

  it('keeps earlier signatures and timestamps events without generatedDateTime', async () => {
    const agreement = await pendingAgreement(['a@b.de', 'c@d.de']);
    const first = await docusign({ event: 'recipient-completed', generatedDateTime: '2026-10-01T08:00:00.000Z', data: { envelopeId: agreement.envelope_id, recipientId: '1' } });
    expect(first.body.status).toBe('processed');
    expect((await docusign({ event: 'recipient-completed', data: { envelopeId: agreement.envelope_id, recipientId: '9' } })).body.status).toBe('processed');
    await docusign({ event: 'envelope-completed', data: { envelopeId: agreement.envelope_id } });

    const signed = (await api('GET', `/agreements/${agreement.id}`)).body;
    expect(signed.status).toBe('SIGNED');
    expect(signed.signatories[0].signed_at).toBe('2026-10-01T08:00:00.000Z');
    expect(new Date(signed.signatories[1].signed_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('rejects a payload without an envelope id', async () => {
    expect((await docusign({ event: 'envelope-completed', data: {} })).status).toBe(400);
  });
});

describe('claim workflow details', () => {
  it('records notes from every step', async () => {
    const { policy } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id, { notes: 'Reported by phone' }))).body;
    await api('POST', `/claims/${claim.id}/assign`, { adjuster_id: 'adj_1', notes: 'Priority' });
    await api('POST', `/claims/${claim.id}/investigate`, { investigator_id: 'inv_1', scope: ['FRAUD'], notes: 'Check logs' });
    await api('POST', `/claims/${claim.id}/investigate`, {});
    await api('POST', `/claims/${claim.id}/adjudicate`, {
      decision: 'DENY', currency: 'EUR', reason: 'Excluded', adjudicator_id: 'adj_1', notes: 'Breach predates cover',
    });
    const appealed = await api('POST', `/claims/${claim.id}/appeal`, {
      reason: 'New evidence', documents: [{ type: 'POLICE_REPORT', url: 'https://example.com/police.pdf' }],
    });
    expect(appealed.body.notes.map((n: any) => n.content)).toEqual([
      'Reported by phone',
      'Assigned to adjuster adj_1: Priority',
      'Investigation requested: Check logs',
      'Breach predates cover',
      'Appeal submitted: New evidence',
    ]);
    expect(appealed.body.documents.map((d: any) => d.type)).toEqual(['POLICE_REPORT']);
    expect((await api('GET', `/claims/${claim.id}/history`)).body.history.map((h: any) => h.action)).toEqual([
      'SUBMITTED', 'ASSIGNED', 'INVESTIGATED', 'INVESTIGATED', 'ADJUDICATED', 'APPEALED',
    ]);
  });

  it('updates losses, notes and documents before the decision', async () => {
    const { policy } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id))).body;
    const updated = await api('PATCH', `/claims/${claim.id}`, {
      estimated_loss: 600_000,
      actual_loss: 550_000,
      notes: 'Forensics report received',
      documents: [{ type: 'INVOICE', url: 'https://example.com/forensics' }],
    });
    expect(updated.body).toMatchObject({ estimated_loss: 600_000, actual_loss: 550_000 });
    expect(updated.body.documents[0]).toMatchObject({ type: 'INVOICE', file_name: 'forensics' });
    expect(await auditActions('CLAIM', claim.id)).toEqual(['CLAIM_SUBMITTED', 'CLAIM_UPDATED']);
  });

  it('freezes losses after the decision and everything after closing', async () => {
    const { policy } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id))).body;
    await api('POST', `/claims/${claim.id}/adjudicate`, { decision: 'DENY', currency: 'EUR', reason: 'Excluded', adjudicator_id: 'adj_1' });
    expect((await api('PATCH', `/claims/${claim.id}`, { estimated_loss: 1 })).status).toBe(400);

    const closed = await api('PATCH', `/claims/${claim.id}`, { status: 'CLOSED' });
    expect(closed.body).toMatchObject({ status: 'CLOSED', closed_at: expect.any(String) });
    expect((await api('PATCH', `/claims/${claim.id}`, { notes: 'late' })).status).toBe(400);
    expect((await api('POST', `/claims/${claim.id}/documents`, upload({ type: 'OTHER' }))).status).toBe(400);
    expect((await api('GET', `/claims/${claim.id}/history`)).body.history.map((h: any) => h.action)).toEqual([
      'SUBMITTED', 'ADJUDICATED', 'CLOSED',
    ]);
  });

  it('validates claim document uploads', async () => {
    const { policy } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id))).body;
    expect((await api('POST', `/claims/${claim.id}/documents`, upload({ type: 'OTHER' }, 'application/pdf', false))).status).toBe(400);
    const csv = await api('POST', `/claims/${claim.id}/documents`, upload({ type: 'INVOICE' }, 'text/csv'));
    expect(csv.body).toMatchObject({ mime_type: 'application/pdf', type: 'INVOICE' });
    const image = await api('POST', `/claims/${claim.id}/documents`, upload({}, 'image/png'));
    expect(image.body).toMatchObject({ mime_type: 'image/png', type: 'OTHER' });
  });

  it('looks up and filters claims', async () => {
    const { policy } = await createPolicy();
    const { policy: other } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id))).body;
    await api('POST', '/claims', claimRequest(other.id));
    await api('POST', `/claims/${claim.id}/assign`, { adjuster_id: 'adj_1' });
    expect((await api('GET', `/claims?policy_id=${policy.id}`)).body.total).toBe(1);
    expect((await api('GET', '/claims?status=ASSIGNED')).body.claims.map((c: any) => c.id)).toEqual([claim.id]);
    expect((await api('GET', '/claims/claim_missing')).status).toBe(404);
    expect((await api('POST', '/claims', claimRequest('pol_missing'))).status).toBe(404);
  });

  it('pays out partially approved claims', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id, 100_000, 'PARTIAL_APPROVE');
    await api('POST', '/payouts', { claim_id: claim.id, amount: 100_000, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM' });
    travelDays(3);
    expect((await api('GET', `/claims/${claim.id}`)).body.status).toBe('PAID');
  });
});

describe('payout edge cases', () => {
  it('validates the claim and currency', async () => {
    const body = { amount: 100, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM' };
    expect((await api('POST', '/payouts', { ...body, claim_id: 'claim_missing' })).status).toBe(404);
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id);
    expect((await api('POST', '/payouts', { ...body, claim_id: claim.id, currency: 'USD' })).status).toBe(400);
  });

  it('filters payouts and refuses to cancel settled ones', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id);
    const payout = (await api('POST', '/payouts', { claim_id: claim.id, amount: 100, currency: 'EUR', recipient, purpose: 'CYBER_CLAIM' })).body;
    expect((await api('GET', `/payouts?claim_id=${claim.id}`)).body.total).toBe(1);
    expect((await api('GET', '/payouts?status=COMPLETED')).body.total).toBe(0);
    travelDays(3);
    expect((await api('GET', '/payouts?status=COMPLETED')).body.total).toBe(1);
    expect((await api('POST', `/payouts/${payout.id}`, { reason: 'ERROR' })).status).toBe(400);
    expect((await api('GET', '/payouts/payout_missing')).status).toBe(404);
  });
});

describe('billing edge cases', () => {
  const invoiceBody = (policyId: string, overrides: object = {}) => ({
    policy_id: policyId, type: 'PREMIUM', amount: 119, currency: 'EUR', due_date: isoDate(14),
    items: [{ description: 'Premium', amount: 100, tax_rate: 0.19 }],
    billing_address: { street: 's', city: 'c', postal_code: '1', country: 'DE' },
    ...overrides,
  });

  it('validates invoices', async () => {
    expect((await api('POST', '/invoices', invoiceBody('pol_missing'))).status).toBe(404);
    const { policy } = await createPolicy();
    expect((await api('POST', '/invoices', invoiceBody(policy.id, { currency: 'USD' }))).status).toBe(400);
    expect((await api('POST', '/invoices', invoiceBody(policy.id, { items: [] }))).status).toBe(400);

    const foreign = (await api('POST', '/payment-methods', {
      business_id: 'biz_other', type: 'SEPA', details: { holder_name: 'Other', iban: 'NL91ABNA0417164300', bic: 'ABNANL2A' },
    })).body;
    expect((await api('POST', '/invoices', invoiceBody(policy.id, { payment_method_id: foreign.id }))).status).toBe(400);
    const own = (await api('POST', '/payment-methods', {
      business_id: 'biz_test', type: 'SEPA', details: { holder_name: 'TechCorp', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
    })).body;
    expect(own.details).toEqual({ holder_name: 'TechCorp', masked_iban: '****3000' });
    expect((await api('POST', '/invoices', invoiceBody(policy.id, { payment_method_id: own.id }))).status).toBe(201);
  });

  it('looks up and filters invoices', async () => {
    const { policy } = await createPolicy();
    const { policy: other } = await createPolicy({ business_id: 'biz_other' });
    const invoice = (await api('POST', '/invoices', invoiceBody(policy.id))).body;
    await api('POST', '/invoices', invoiceBody(other.id));
    expect((await api('GET', '/invoices?business_id=biz_other')).body.total).toBe(1);
    expect((await api('GET', `/invoices?policy_id=${policy.id}`)).body.invoices[0].id).toBe(invoice.id);
    expect((await api('GET', '/invoices?status=PAID')).body.total).toBe(0);
    expect((await api('GET', '/invoices/inv_missing')).status).toBe(404);
    expect((await api('GET', '/invoices/inv_missing/payments')).status).toBe(404);
    expect((await api('POST', '/dunning/inv_missing')).status).toBe(404);
  });
});

describe('document edge cases', () => {
  it('validates uploads', async () => {
    const { policy } = await createPolicy();
    const fields = { entity_type: 'POLICY', entity_id: policy.id, type: 'POLICY_DOCUMENT' };
    expect((await api('POST', '/documents/upload', upload(fields, 'application/pdf', false))).status).toBe(400);
    expect((await api('POST', '/documents/upload', upload(fields, 'image/gif'))).status).toBe(400);
    expect((await api('POST', '/documents/upload', upload(fields, 'application/octet-stream'))).body.mime_type).toBe('application/pdf');
    expect((await api('GET', '/documents/doc_missing')).status).toBe(404);
  });

  it('lists claim documents uploaded through the documents API on the claim', async () => {
    const { policy } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id))).body;
    const doc = await api('POST', '/documents/upload', upload({ entity_type: 'CLAIM', entity_id: claim.id, type: 'CLAIM_FORM' }));
    expect((await api('GET', `/claims/${claim.id}`)).body.documents.map((d: any) => d.id)).toEqual([doc.body.id]);
  });

  it('returns metadata when downloading a document stored by reference', async () => {
    const { policy } = await createPolicy();
    const claim = (await api('POST', '/claims', claimRequest(policy.id, {
      documents: [{ type: 'INCIDENT_REPORT', url: 'https://example.com/report.pdf' }],
    }))).body;
    const download = await api('GET', `/documents/${claim.documents[0].id}/download`);
    expect(download.body).toMatchObject({ id: claim.documents[0].id, url: 'https://example.com/report.pdf' });
  });
});

describe('compliance edge cases', () => {
  it('returns 404 for unknown audit entries', async () => {
    expect((await api('GET', '/compliance/audit/audit_missing')).status).toBe(404);
  });

  it('reports quarters and past years with a null ratio when nothing is owed', async () => {
    const current = await api('GET', '/compliance/reports/solvency-ii?period=QUARTERLY');
    const month = new Date().getUTCMonth();
    expect(current.body.period_start.slice(5, 7)).toBe(String(Math.floor(month / 3) * 3 + 1).padStart(2, '0'));
    expect(current.body.data).toEqual({ assets: 0, liabilities: 0, solvency_ratio: null });

    const past = await api('GET', '/compliance/reports/solvency-ii?period=QUARTERLY&year=2024');
    expect(past.body).toMatchObject({ year: 2024, period_start: '2024-10-01', period_end: '2024-12-31' });
  });

  it('counts undecided claims without an estimate as no liability', async () => {
    const { policy } = await createPolicy();
    const request = claimRequest(policy.id);
    await api('POST', '/claims', { ...request, incident: { ...request.incident, estimated_loss: undefined } });
    const report = await api('GET', '/compliance/reports/solvency-ii?period=ANNUAL');
    expect(report.body.data.liabilities).toBe(0);
  });
});

describe('GDPR erasure of users and claims', () => {
  it('erases claims filed by an employee and anonymises notes the user wrote', async () => {
    const { policy } = await createPolicy();
    const employeeClaim = (await api('POST', '/claims', claimRequest(policy.id, {
      claimant: {
        type: 'EMPLOYEE', employee_id: 'emp_7',
        contact: { name: 'Max', email: 'max@techcorp.de', address: { street: 'Weg 1', city: 'Köln', postal_code: '50667', country: 'DE' } },
      },
    }))).body;
    const other = (await api('POST', '/claims', claimRequest(policy.id))).body;
    await api('PATCH', `/claims/${other.id}`, { notes: 'Called the insured' });

    const res = await api('POST', '/compliance/gdpr/erasure', { entity_type: 'USER', entity_id: 'emp_7', requester_email: 'dpo@techcorp.de' });
    expect(res.body.erased_records).toMatchObject({ claims: 1, notes: 0 });
    const erased = (await api('GET', `/claims/${employeeClaim.id}`)).body;
    expect(erased.claimant).toMatchObject({ employee_id: '[erased]', contact: { name: '[erased]', address: { street: '[erased]', country: 'DE' } } });

    const author = await api('POST', '/compliance/gdpr/erasure', { entity_type: 'USER', entity_id: 'api-user', requester_email: 'dpo@techcorp.de' });
    expect(author.body.erased_records.notes).toBe(1);
    expect((await api('GET', `/claims/${other.id}`)).body.notes[0]).toMatchObject({ author: '[erased]', content: 'Called the insured' });
  });

  it('erases a single claim including payout tax ids', async () => {
    const { policy } = await createPolicy();
    const { claim } = await createApprovedClaim(policy.id);
    await api('POST', '/payouts', {
      claim_id: claim.id, amount: 100, currency: 'EUR', purpose: 'CYBER_CLAIM', recipient: { ...recipient, tax_id: 'DE123456789' },
    });
    const res = await api('POST', '/compliance/gdpr/erasure', { entity_type: 'CLAIM', entity_id: claim.id, requester_email: 'dpo@techcorp.de' });
    expect(res.body.erased_records).toMatchObject({ claims: 1, payouts: 1 });
    expect((await api('GET', `/payouts?claim_id=${claim.id}`)).body.payouts[0].recipient.tax_id).toBe('[erased]');
  });

  it('returns 404 for an unknown business', async () => {
    const res = await api('POST', '/compliance/gdpr/erasure', { entity_type: 'BUSINESS', entity_id: 'biz_unknown', requester_email: 'a@b.de' });
    expect(res.status).toBe(404);
  });

  it('deletes documents attached to the business', async () => {
    const { policy } = await createPolicy();
    const doc = await api('POST', '/documents/upload', upload({ entity_type: 'BUSINESS', entity_id: 'biz_test', type: 'CONTRACT' }));
    const res = await api('POST', '/compliance/gdpr/erasure', { entity_type: 'BUSINESS', entity_id: 'biz_test', requester_email: 'a@b.de' });
    expect(res.body.erased_records.documents).toBe(1);
    expect((await api('GET', `/documents/${doc.body.id}`)).status).toBe(404);
    expect((await api('GET', `/policies/${policy.id}`)).status).toBe(200);
  });
});
