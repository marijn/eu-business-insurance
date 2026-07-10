import { AddressInfo } from 'net';
import { createHmac } from 'crypto';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { storage } from '../src/storage';
import { clock } from '../src/utils/clock';
import { setMollieGateway } from '../src/services/mollie';
import { createMollieMock, MollieMock } from './mollie-mock';

let server: Server;
let baseUrl: string;

export async function startServer(): Promise<void> {
  await storage.init();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
}

export async function stopServer(): Promise<void> {
  await new Promise((resolve) => server.close(resolve));
  await storage.close();
}

export const apiUrl = (path: string) => `${baseUrl}${path}`;

export let mollieMock: MollieMock = createMollieMock();

export async function resetState(): Promise<void> {
  jest.restoreAllMocks();
  mollieMock = createMollieMock();
  setMollieGateway(mollieMock);
  await storage.clear();
}

export function travelDays(days: number): void {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  jest.spyOn(clock, 'now').mockImplementation(() => new Date(target));
}

export function token(scopes: string[], userId = 'user_test'): string {
  return jwt.sign({ userId, scopes }, 'your-super-secret-jwt-key-12345', { expiresIn: '1h' });
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = { 'X-API-KEY': 'test-api-key-1' }
): Promise<ApiResponse<T>> {
  const isForm = body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const type = response.headers.get('content-type') || '';
  const parsed = type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: parsed as T };
}

export const isoDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export function quoteRequest(overrides: Record<string, any> = {}) {
  return {
    business_id: 'biz_test',
    policy_type: 'CYBER',
    coverage_request: {
      limits: { per_claim: 1_000_000, aggregate: 2_000_000 },
      deductible: 10_000,
      add_ons: ['DATA_BREACH_RESPONSE'],
    },
    business_details: {
      legal_name: 'TechCorp GmbH',
      country: 'DE',
      industry: 'TECHNOLOGY',
      revenue: 5_000_000,
      employee_count: 50,
      cyber_risk_factors: { has_mfa: true, has_encryption: true, cloud_provider: 'AWS' },
    },
    term: { start_date: isoDate(-30), end_date: isoDate(335) },
    ...overrides,
  };
}

export async function signAgreement(agreementId: string): Promise<void> {
  const signing = await api('POST', `/agreements/${agreementId}/sign`, { signatory_email: 'jane@techcorp.de' });
  if (signing.status !== 201) throw new Error(JSON.stringify(signing.body));
  const body = JSON.stringify({ event: 'envelope-completed', data: { envelopeId: signing.body.signature_request_id } });
  const response = await fetch(`${baseUrl}/webhooks/docusign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-DocuSign-Signature-1': createHmac('sha256', 'test-connect-key').update(body).digest('base64') },
    body,
  });
  if (response.status !== 200) throw new Error(await response.text());
}

export async function signPendingEndorsement(policyId: string) {
  const policy = (await api('GET', `/policies/${policyId}`)).body;
  await signAgreement(policy.endorsements.find((e: any) => e.status === 'PENDING').agreement_id);
  return (await api('GET', `/policies/${policyId}`)).body;
}

export async function createPolicy(overrides: Record<string, any> = {}, { signed = true } = {}) {
  const quote = await api('POST', '/quotes', quoteRequest(overrides));
  if (quote.status !== 201) throw new Error(JSON.stringify(quote.body));
  const bound = await api('POST', `/quotes/${quote.body.id}`, {});
  if (bound.status !== 201) throw new Error(JSON.stringify(bound.body));
  if (!signed) return { quote: quote.body, policy: bound.body };
  await signAgreement(bound.body.agreement_id);
  return { quote: quote.body, policy: (await api('GET', `/policies/${bound.body.id}`)).body };
}

export function claimRequest(policyId: string, overrides: Record<string, any> = {}) {
  return {
    policy_id: policyId,
    claimant: {
      type: 'INSURED',
      business_id: 'biz_test',
      contact: { name: 'Jane Doe', email: 'jane@techcorp.de', phone: '+49301234567' },
    },
    incident: {
      type: 'CYBER_BREACH',
      date: `${isoDate(-1)}T10:00:00Z`,
      description: 'Ransomware attack',
      location: 'Berlin',
      estimated_loss: 500_000,
    },
    ...overrides,
  };
}

export async function createApprovedClaim(policyId: string, payout = 400_000, decision = 'APPROVE') {
  const claim = await api('POST', '/claims', claimRequest(policyId));
  const adjudication = await api('POST', `/claims/${claim.body.id}/adjudicate`, {
    decision,
    payout_amount: payout,
    currency: 'EUR',
    reason: 'Covered',
    adjudicator_id: 'adj_1',
  });
  if (adjudication.status !== 200) throw new Error(JSON.stringify(adjudication.body));
  return { claim: claim.body, adjudication: adjudication.body };
}

export const recipient = {
  type: 'BUSINESS',
  name: 'TechCorp GmbH',
  iban: 'DE89370400440532013000',
  bic: 'COBADEFFXXX',
  address: { street: 'Musterstraße 1', city: 'Berlin', postal_code: '10115', country: 'DE' },
};

export async function auditActions(entityType: string, entityId: string): Promise<string[]> {
  const res = await api('GET', `/compliance/audit?entity_type=${entityType}&entity_id=${entityId}&limit=100`);
  return res.body.entries.map((e: any) => e.action);
}
