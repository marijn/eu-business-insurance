import {
  EUBusinessInsuranceClient,
  LOCAL_CONFIG,
  NotFoundError,
  ValidationError,
  isAPIError,
} from '../src';

const baseURL = process.env.API_BASE_URL || LOCAL_CONFIG.baseURL;
const apiKey = process.env.API_KEY || 'test-api-key-1';

const client = EUBusinessInsuranceClient.createWithAPIKey(apiKey, { ...LOCAL_CONFIG, baseURL });

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().split('T')[0];

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    console.log(`✔ ${name}`);
    return result;
  } catch (error) {
    if (isAPIError(error)) {
      console.error(`✘ ${name}: [${error.statusCode} ${error.code}] ${error.message}`, error.details ?? '');
    } else {
      console.error(`✘ ${name}:`, error);
    }
    throw error;
  }
}

async function completePolicyWorkflow() {
  const quote = await step('create quote', () => client.policy.createQuote({
    business_id: 'biz_12345',
    policy_type: 'CYBER',
    coverage_request: {
      limits: { per_claim: 1000000, aggregate: 5000000 },
      deductible: 10000,
      add_ons: ['DATA_BREACH_RESPONSE', 'REGULATORY_FINES'],
    },
    business_details: {
      legal_name: 'TechCorp GmbH',
      country: 'DE',
      industry: 'TECHNOLOGY',
      revenue: 5000000,
      employee_count: 50,
      cyber_risk_factors: { has_mfa: true, has_encryption: true, cloud_provider: 'AWS' },
    },
    term: { start_date: day(-30), end_date: day(335) },
  }));

  const policy = await step('bind quote', () => client.policy.bindQuote(quote.data.id, {
    notes: 'Initial policy binding',
  }));

  const agreement = await step('generate agreement', () =>
    client.agreement.generatePolicyAgreement(policy.data.id, 'CYBER_POLICY_DE_v2', 'de'));

  await step('initiate signing', () => client.agreement.initiateSigning(agreement.data.id, {
    signatory_email: 'jane@techcorp.de',
    signatory_role: 'INSURED',
    redirect_url: 'https://techcorp.de/thank-you',
  }));

  const invoice = await step('create invoice', () => client.billing.createInvoice({
    policy_id: policy.data.id,
    type: 'PREMIUM',
    amount: policy.data.premium.gross,
    currency: policy.data.premium.currency,
    due_date: day(14),
    items: [{
      description: 'Cyber Liability Insurance Premium',
      amount: policy.data.premium.net,
      tax_rate: policy.data.premium.taxes[0].rate,
    }],
    billing_address: { street: 'Musterstraße 1', city: 'Berlin', postal_code: '10115', country: 'DE' },
  }));

  const paymentsConfigured = await client.billing.addSEPAPaymentMethod('biz_12345', {
    holder_name: 'TechCorp GmbH',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
  }).then(() => true, (error) => {
    if (isAPIError(error) && error.statusCode === 503) return false;
    throw error;
  });
  if (paymentsConfigured) {
    console.log('✔ add SEPA payment method');
    await step('pay invoice with default method', () =>
      client.billing.payWithDefaultMethod(invoice.data.id, invoice.data.amount, invoice.data.currency));
  } else {
    console.log('- payment steps skipped: the server has no MOLLIE_API_KEY');
  }

  const claim = await step('submit claim', () => client.claims.submitClaim({
    policy_id: policy.data.id,
    claimant: {
      type: 'INSURED',
      business_id: 'biz_12345',
      contact: { name: 'Jane Doe', email: 'jane@techcorp.de', phone: '+49301234567' },
    },
    incident: {
      type: 'CYBER_BREACH',
      date: `${day(-1)}T14:30:00Z`,
      description: 'Ransomware attack on primary database',
      location: 'Berlin, DE',
      estimated_loss: 500000,
    },
    documents: [{ type: 'INCIDENT_REPORT', url: 'https://documents.insureeu.com/claims/incident_report.pdf' }],
  }));

  const adjudication = await step('adjudicate claim', () => client.claims.adjudicateClaim(claim.data.id, {
    decision: 'APPROVE',
    payout_amount: 450000,
    currency: 'EUR',
    deductible_applied: 10000,
    reason: 'Covered under Data Breach Response clause',
    exclusions: [],
    conditions: ['Provide proof of security improvements within 30 days'],
    adjudicator_id: 'adj_123',
  }));

  await step('create payout', () => client.payouts.createSEPAPayout({
    claim_id: claim.data.id,
    amount: adjudication.data.payout_amount!,
    currency: adjudication.data.currency!,
    recipient: {
      type: 'BUSINESS',
      name: 'TechCorp GmbH',
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      address: { street: 'Musterstraße 1', city: 'Berlin', postal_code: '10115', country: 'DE' },
    },
    purpose: 'CYBER_CLAIM',
    aml_check: true,
    kyc_check: true,
    sanctions_check: true,
  }));

  const trail = await step('audit trail', () =>
    client.compliance.listAuditLogs({ entity_type: 'CLAIM', entity_id: claim.data.id }));
  console.log('  audit:', trail.data.entries.map((e) => e.action).join(', '));

  const history = await step('claim history', () => client.claims.getClaimHistory(claim.data.id));
  console.log('  history:', history.data.history.map((h) => h.action).join(' -> '));

  await step('error handling: unknown policy is NOT_FOUND', async () => {
    try {
      await client.policy.getPolicy('invalid-id');
    } catch (error) {
      if (error instanceof NotFoundError && error.isNotFound()) return;
      throw error;
    }
    throw new Error('expected NOT_FOUND');
  });

  await step('error handling: invalid quote is VALIDATION_ERROR', async () => {
    try {
      await client.policy.createQuote({} as never);
    } catch (error) {
      if (error instanceof ValidationError && error.hasFieldError('policy_type')) return;
      throw error;
    }
    throw new Error('expected VALIDATION_ERROR');
  });

  await step('GDPR erasure request', () => client.compliance.requestBusinessDataErasure({
    business_id: 'biz_12345',
    requester_email: 'user@example.com',
    reason: 'User request',
  }));

  const doc = await step('upload document', () =>
    client.documents.uploadPolicyDocument(Buffer.from('%PDF-1.4 test'), policy.data.id));

  await step('redact document', () => client.documents.redactDocument(doc.data.id, { fields: ['ssn', 'iban', 'email'] }));

  const audit = await step('log audit', () => client.compliance.logAudit({
    action: 'QUOTE_CREATED',
    entity_type: 'QUOTE',
    entity_id: 'quote_123',
    user_id: 'user_123',
    gdpr_consent: true,
  }));

  await step('get audit log by action_id', () => client.compliance.getAuditLog(audit.data.action_id!));

  await step('documents for policy', async () => {
    const docs = await client.documents.getPolicyDocuments(policy.data.id);
    if (!docs.some((d) => d.id === doc.data.id)) throw new Error('uploaded document not listed');
  });

  await step('solvency II report', () => client.compliance.generateAnnualSolvencyReport(new Date().getFullYear()));

  await step('setAPIKey applies to service clients', async () => {
    const rotating = EUBusinessInsuranceClient.createWithAPIKey('wrong-key', { ...LOCAL_CONFIG, baseURL });
    rotating.setAPIKey(apiKey);
    await rotating.claims.listClaims();
  });

  await step('unauthenticated request is UNAUTHORIZED', async () => {
    const anonymous = new EUBusinessInsuranceClient({ apiConfig: { ...LOCAL_CONFIG, baseURL } });
    try {
      await anonymous.policy.listPolicies();
    } catch (error) {
      if (isAPIError(error) && error.isAuthError()) return;
      throw error;
    }
    throw new Error('expected UNAUTHORIZED');
  });
}

completePolicyWorkflow()
  .then(() => console.log('Workflow completed'))
  .catch(() => process.exit(1));
