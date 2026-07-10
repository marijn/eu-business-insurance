import { createHmac } from 'crypto';
import { api, apiUrl, auditActions, createPolicy, resetState, startServer, stopServer } from './helpers';

beforeAll(startServer);
afterAll(stopServer);
beforeEach(resetState);

async function connect(payload: object, key = 'test-connect-key', headerName = 'X-DocuSign-Signature-1') {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', key).update(body).digest('base64');
  const response = await fetch(apiUrl('/webhooks/docusign'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [headerName]: signature },
    body,
  });
  return { status: response.status, body: await response.json() as any };
}

async function agreementAwaitingSignatures(emails = ['jane@techcorp.de', 'underwriter@insureeu.com']) {
  const { policy } = await createPolicy({}, { signed: false });
  const requests = [];
  for (const email of emails) {
    requests.push((await api('POST', `/agreements/${policy.agreement_id}/sign`, { signatory_email: email })).body);
  }
  const agreement = (await api('GET', `/agreements/${policy.agreement_id}`)).body;
  return { agreement, envelopeId: agreement.envelope_id as string, requests };
}

const recipientEvent = (event: string, envelopeId: string, recipientId: string, extra: object = {}) => ({
  event,
  apiVersion: 'v2.1',
  uri: `/restapi/v2.1/accounts/acc/envelopes/${envelopeId}`,
  retryCount: 0,
  configurationId: 1,
  generatedDateTime: '2026-10-11T10:00:00.000Z',
  data: { accountId: 'acc', userId: 'usr', envelopeId, recipientId, ...extra },
});

describe('signing requests', () => {
  it('puts all signatories of an agreement in one envelope', async () => {
    const { agreement, requests } = await agreementAwaitingSignatures();
    expect(requests[0].signature_request_id).toBe(agreement.envelope_id);
    expect(requests[1].signature_request_id).toBe(agreement.envelope_id);
    expect(agreement.signatories.map((s: any) => s.recipient_id)).toEqual(['1', '2']);
    const duplicate = await api('POST', `/agreements/${agreement.id}/sign`, { signatory_email: 'JANE@techcorp.de' });
    expect(duplicate.status).toBe(400);
  });
});

describe('DocuSign Connect webhook', () => {
  it('rejects deliveries without a valid HMAC signature', async () => {
    const { envelopeId } = await agreementAwaitingSignatures();
    const payload = recipientEvent('recipient-completed', envelopeId, '1');
    expect((await connect(payload, 'wrong-key')).status).toBe(401);
    const unsigned = await fetch(apiUrl('/webhooks/docusign'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(unsigned.status).toBe(401);
  });

  it('accepts any configured key in any signature header', async () => {
    const { envelopeId } = await agreementAwaitingSignatures();
    const res = await connect(recipientEvent('recipient-completed', envelopeId, '1'), 'old-connect-key', 'X-DocuSign-Signature-2');
    expect(res).toEqual({ status: 200, body: { status: 'processed' } });
  });

  it('marks the agreement SIGNED once every recipient has signed', async () => {
    const { agreement, envelopeId } = await agreementAwaitingSignatures();
    await connect(recipientEvent('recipient-completed', envelopeId, '1', {
      envelopeSummary: { recipients: { signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-11T09:58:00.000Z' }] } },
    }));
    let current = (await api('GET', `/agreements/${agreement.id}`)).body;
    expect(current.status).toBe('PENDING_SIGNATURE');
    expect(current.signatories[0]).toMatchObject({ status: 'SIGNED', signed_at: '2026-10-11T09:58:00.000Z' });

    await connect(recipientEvent('recipient-completed', envelopeId, '2'));
    current = (await api('GET', `/agreements/${agreement.id}`)).body;
    expect(current.status).toBe('SIGNED');
    expect(current.signed_at).toBe('2026-10-11T10:00:00.000Z');
    expect((await api('GET', `/agreements/${agreement.id}/signatures`)).body.all_signed).toBe(true);

    expect(await auditActions('AGREEMENT', agreement.id)).toEqual([
      'AGREEMENT_GENERATED',
      'AGREEMENT_SIGNING_INITIATED',
      'AGREEMENT_SIGNING_INITIATED',
      'AGREEMENT_SIGNATORY_SIGNED',
      'AGREEMENT_SIGNATORY_SIGNED',
      'AGREEMENT_SIGNED',
    ]);
    const signedEntry = await api('GET', `/compliance/audit?action=AGREEMENT_SIGNED&entity_id=${agreement.id}`);
    expect(signedEntry.body.entries[0].user_id).toBe('docusign');
  });

  it('completes all signatories on envelope-completed', async () => {
    const { agreement, envelopeId } = await agreementAwaitingSignatures();
    await connect({
      ...recipientEvent('envelope-completed', envelopeId, ''),
      data: { envelopeId, envelopeSummary: { status: 'completed', completedDateTime: '2026-10-11T09:59:00.000Z' } },
    });
    const current = (await api('GET', `/agreements/${agreement.id}`)).body;
    expect(current.status).toBe('SIGNED');
    expect(current.signed_at).toBe('2026-10-11T09:59:00.000Z');
    expect(current.signatories.every((s: any) => s.status === 'SIGNED')).toBe(true);
  });

  it('records a decline and lets a new agreement be generated', async () => {
    const { agreement, envelopeId } = await agreementAwaitingSignatures();
    await connect(recipientEvent('recipient-declined', envelopeId, '1', {
      envelopeSummary: { recipients: { signers: [{ recipientId: '1', status: 'declined', declinedReason: 'Wrong address' }] } },
    }));
    const current = (await api('GET', `/agreements/${agreement.id}`)).body;
    expect(current.status).toBe('DECLINED');
    expect(current.signatories[0].status).toBe('REJECTED');
    expect((await api('POST', `/agreements/${agreement.id}/sign`, { signatory_email: 'x@y.de' })).status).toBe(400);

    const regenerated = await api('POST', '/agreements/generate', {
      policy_id: current.policy_id, template_id: 'CYBER_POLICY_v2', language: 'en',
    });
    expect(regenerated.status).toBe(201);
  });

  it('voids the agreement when the envelope is voided in DocuSign', async () => {
    const { agreement, envelopeId } = await agreementAwaitingSignatures();
    await connect({ ...recipientEvent('envelope-voided', envelopeId, ''), data: { envelopeId, envelopeSummary: { voidedReason: 'Superseded' } } });
    expect((await api('GET', `/agreements/${agreement.id}`)).body.status).toBe('VOIDED');
  });

  it('ignores unknown envelopes, irrelevant events, repeats and late events', async () => {
    const { agreement, envelopeId } = await agreementAwaitingSignatures(['jane@techcorp.de']);
    expect((await connect(recipientEvent('recipient-completed', 'unknown-envelope', '1'))).body.status).toBe('ignored');
    expect((await connect(recipientEvent('recipient-delivered', envelopeId, '1'))).body.status).toBe('ignored');

    await connect(recipientEvent('recipient-completed', envelopeId, '1'));
    expect((await connect(recipientEvent('recipient-completed', envelopeId, '1'))).body.status).toBe('ignored');
    expect((await connect(recipientEvent('envelope-voided', envelopeId, ''))).body.status).toBe('ignored');
    expect((await api('GET', `/agreements/${agreement.id}`)).body.status).toBe('SIGNED');
  });

  it('keeps a signed policy agreement from being replaced', async () => {
    const { agreement, envelopeId } = await agreementAwaitingSignatures(['jane@techcorp.de']);
    await connect(recipientEvent('recipient-completed', envelopeId, '1'));
    const res = await api('POST', '/agreements/generate', { policy_id: agreement.policy_id, template_id: 'T', language: 'en' });
    expect(res.status).toBe(400);
  });
});
