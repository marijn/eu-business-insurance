import { z } from 'zod';
import { createError } from '../middleware/errorHandler';
import {
  PolicyType,
  ClaimStatus,
  AdjudicationDecision,
  Industry,
  CloudProvider,
  FinancialStrength,
  IndustryRiskLevel,
  Severity,
  DocumentType,
  EntityType,
  RetentionPolicy,
  Currency,
  Language,
  AddOn,
  Exclusion,
  UnderwritingRequirement,
  AuditAction,
  AuditEntityType,
  CancellationReason,
  PayoutCancellationReason,
  Period,
  ErasureEntityType,
  SignatoryRole,
  PolicyChangeType,
  PolicyChangeAction,
  IncidentType,
  ClaimantType,
  RecipientType,
  PaymentMethodType,
  PaymentType,
  RefundReason,
  PayoutPurpose,
  SigningScope,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from '../types';

const policyTypeSchema = z.enum([
  'CYBER', 'DNO', 'SURETY', 'WORKERS_COMP'
] as [PolicyType, ...PolicyType[]]);

const industrySchema = z.enum([
  'TECHNOLOGY', 'FINANCE', 'HEALTHCARE', 'CONSTRUCTION', 'MANUFACTURING', 'RETAIL', 'OTHER'
] as [Industry, ...Industry[]]);

const cloudProviderSchema = z.enum([
  'AWS', 'AZURE', 'GCP', 'ON_PREMISE', 'OTHER'
] as [CloudProvider, ...CloudProvider[]]);

const severitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'] as [Severity, ...Severity[]]);

const financialStrengthSchema = z.enum([
  'EXCELLENT', 'GOOD', 'FAIR', 'POOR'
] as [FinancialStrength, ...FinancialStrength[]]);

const industryRiskLevelSchema = z.enum([
  'LOW', 'MEDIUM', 'HIGH'
] as [IndustryRiskLevel, ...IndustryRiskLevel[]]);

const currencySchema = z.enum(['EUR', 'USD', 'GBP'] as [Currency, ...Currency[]]);

const languageSchema = z.enum(['en', 'de', 'fr', 'es', 'it'] as [Language, ...Language[]]);

const addOnSchema = z.enum([
  'DATA_BREACH_RESPONSE', 'REGULATORY_FINES', 'CRISIS_MANAGEMENT', 'LEGAL_DEFENSE', 'BUSINESS_INTERRUPTION'
] as [AddOn, ...AddOn[]]);

const documentTypeSchema = z.enum([
  'INCIDENT_REPORT', 'MEDICAL_REPORT', 'POLICE_REPORT', 'INVOICE', 'CONTRACT', 'OTHER',
  'POLICY_DOCUMENT', 'ENDORSEMENT', 'CLAIM_FORM'
] as [DocumentType, ...DocumentType[]]);

const entityTypeSchema = z.enum([
  'POLICY', 'CLAIM', 'INVOICE', 'AGREEMENT', 'BUSINESS'
] as [EntityType, ...EntityType[]]);

const retentionPolicySchema = z.enum([
  '1_YEAR', '7_YEARS', 'PERMANENT'
] as [RetentionPolicy, ...RetentionPolicy[]]);

const claimStatusSchema = z.enum([
  'SUBMITTED', 'ASSIGNED', 'INVESTIGATING', 'ADJUDICATING', 'APPROVED', 'PARTIALLY_APPROVED', 'DENIED',
  'PAID', 'CLOSED', 'APPEALED'
] as [ClaimStatus, ...ClaimStatus[]]);

const adjudicationDecisionSchema = z.enum([
  'APPROVE', 'DENY', 'PARTIAL_APPROVE'
] as [AdjudicationDecision, ...AdjudicationDecision[]]);

const signatoryRoleSchema = z.enum([
  'INSURED', 'INSURER', 'BROKER', 'WITNESS'
] as [SignatoryRole, ...SignatoryRole[]]);

const policyChangeTypeSchema = z.enum([
  'COVERAGE_LIMIT', 'DEDUCTIBLE', 'ADD_ON', 'EXCLUSION', 'TERM', 'ADDRESS'
] as [PolicyChangeType, ...PolicyChangeType[]]);

const policyChangeActionSchema = z.enum([
  'ADD', 'REMOVE', 'UPDATE'
] as [PolicyChangeAction, ...PolicyChangeAction[]]);

const incidentTypeSchema = z.enum([
  'CYBER_BREACH', 'DATA_LOSS', 'DNO_CLAIM', 'SURETY_DEFAULT', 'WORK_INJURY',
  'WORK_ILLNESS', 'PROPERTY_DAMAGE', 'OTHER'
] as [IncidentType, ...IncidentType[]]);

const claimantTypeSchema = z.enum([
  'INSURED', 'EMPLOYEE', 'THIRD_PARTY', 'BENEFICIARY'
] as [ClaimantType, ...ClaimantType[]]);

const recipientTypeSchema = z.enum([
  'BUSINESS', 'INDIVIDUAL', 'LAW_FIRM', 'OTHER'
] as [RecipientType, ...RecipientType[]]);

const paymentMethodTypeSchema = z.enum([
  'SEPA', 'CARD'
] as [PaymentMethodType, ...PaymentMethodType[]]);

const paymentTypeSchema = z.enum([
  'PREMIUM', 'FEE', 'ADJUSTMENT', 'REFUND'
] as [PaymentType, ...PaymentType[]]);

const refundReasonSchema = z.enum([
  'DUPLICATE', 'ERROR', 'CANCELLATION', 'OTHER'
] as [RefundReason, ...RefundReason[]]);

const payoutPurposeSchema = z.enum([
  'CYBER_CLAIM', 'DNO_CLAIM', 'SURETY_CLAIM', 'WORKERS_COMP_CLAIM', 'REFUND'
] as [PayoutPurpose, ...PayoutPurpose[]]);

const cancellationReasonSchema = z.enum([
  'CUSTOMER_REQUEST', 'NON_PAYMENT', 'RISK_CHANGE', 'FRAUD', 'OTHER'
] as [CancellationReason, ...CancellationReason[]]);

const payoutCancellationReasonSchema = z.enum([
  'FRAUD', 'ERROR', 'DUPLICATE', 'OTHER'
] as [PayoutCancellationReason, ...PayoutCancellationReason[]]);

const periodSchema = z.enum(['QUARTERLY', 'ANNUAL'] as [Period, ...Period[]]);

const erasureEntityTypeSchema = z.enum([
  'BUSINESS', 'USER', 'POLICY', 'CLAIM'
] as [ErasureEntityType, ...ErasureEntityType[]]);

const auditActionSchema = z.enum(AUDIT_ACTIONS as unknown as [AuditAction, ...AuditAction[]]);

const auditEntityTypeSchema = z.enum(AUDIT_ENTITY_TYPES as unknown as [AuditEntityType, ...AuditEntityType[]]);

const signingScopeSchema = z.enum([
  'FRAUD', 'LIABILITY', 'COVERAGE', 'DAMAGE_ASSESSMENT'
] as [SigningScope, ...SigningScope[]]);

function validate<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw createError(
      'VALIDATION_ERROR',
      'Validation failed',
      result.error.errors.map((e) => ({ field: e.path.join('.') || 'body', message: e.message }))
    );
  }
  return result.data;
}

export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  vat_id: z.string().optional(),
});

export const policyTermSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const coverageRequestSchema = z.object({
  limits: z.object({
    per_claim: z.number().min(1000),
    aggregate: z.number().min(1000).optional(),
  }),
  deductible: z.number().min(0),
  add_ons: z.array(addOnSchema).optional(),
});

export const cyberRiskFactorsSchema = z.object({
  has_mfa: z.boolean().optional(),
  has_encryption: z.boolean().optional(),
  cloud_provider: cloudProviderSchema.optional(),
  incident_history: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    severity: severitySchema,
    description: z.string(),
  })).optional(),
});

export const dnoRiskFactorsSchema = z.object({
  governance_score: z.number().min(0).max(10).optional(),
  past_litigation: z.boolean().optional(),
  board_size: z.number().min(1).optional(),
});

export const suretyRiskFactorsSchema = z.object({
  financial_strength: financialStrengthSchema.optional(),
  project_size: z.number().min(0).optional(),
  past_defaults: z.number().min(0).optional(),
});

export const workersCompRiskFactorsSchema = z.object({
  safety_training: z.boolean().optional(),
  industry_risk_level: industryRiskLevelSchema.optional(),
  past_claims: z.number().min(0).optional(),
});

export const businessDetailsSchema = z.object({
  legal_name: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  industry: industrySchema,
  revenue: z.number().min(0),
  employee_count: z.number().min(1).optional(),
  vat_id: z.string().optional(),
  cyber_risk_factors: cyberRiskFactorsSchema.optional(),
  dno_risk_factors: dnoRiskFactorsSchema.optional(),
  surety_risk_factors: suretyRiskFactorsSchema.optional(),
  workers_comp_risk_factors: workersCompRiskFactorsSchema.optional(),
});

export const quoteRequestSchema = z.object({
  business_id: z.string().min(1),
  policy_type: policyTypeSchema,
  coverage_request: coverageRequestSchema,
  business_details: businessDetailsSchema,
  term: policyTermSchema,
});

export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: addressSchema.optional(),
});

export const claimantSchema = z.object({
  type: claimantTypeSchema,
  business_id: z.string().optional(),
  employee_id: z.string().optional(),
  contact: contactSchema,
});

export const incidentSchema = z.object({
  type: incidentTypeSchema,
  date: z.string().datetime(),
  description: z.string().min(1),
  location: z.string().optional(),
  estimated_loss: z.number().min(0).optional(),
  actual_loss: z.number().min(0).nullable().optional(),
});

export const documentReferenceSchema = z.object({
  type: documentTypeSchema,
  url: z.string().url(),
  description: z.string().optional(),
});

export const claimRequestSchema = z.object({
  policy_id: z.string().regex(/^pol_[a-zA-Z0-9-]+$/),
  claimant: claimantSchema,
  incident: incidentSchema,
  documents: z.array(documentReferenceSchema).optional(),
  notes: z.string().optional(),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  tax_rate: z.number().min(0).max(1),
});

export const invoiceRequestSchema = z.object({
  policy_id: z.string().regex(/^pol_[a-zA-Z0-9-]+$/),
  type: paymentTypeSchema,
  amount: z.number().min(0).gt(0),
  currency: currencySchema,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(invoiceItemSchema),
  billing_address: addressSchema,
  payment_method_id: z.string().regex(/^pm_[a-zA-Z0-9-]+$/).optional(),
});

export const paymentRequestSchema = z.object({
  payment_method_id: z.string().regex(/^pm_[a-zA-Z0-9-]+$/),
  amount: z.number().min(0).gt(0),
  currency: currencySchema,
  metadata: z.object({
    psd2_sca: z.boolean().default(true),
    sepa_mandate_id: z.string().optional(),
    reference: z.string().optional(),
  }).optional(),
});

export const paymentMethodDetailsSchema = z.object({
  holder_name: z.string().min(1),
  iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/).optional(),
  bic: z.string().regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),
}).strict();

export const paymentMethodRequestSchema = z.object({
  business_id: z.string().min(1),
  type: paymentMethodTypeSchema,
  details: paymentMethodDetailsSchema,
  email: z.string().email().optional(),
  redirect_url: z.string().url().optional(),
  is_default: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const missing: Array<[string[], boolean]> = value.type === 'SEPA'
    ? [[['details', 'iban'], !value.details.iban], [['details', 'bic'], !value.details.bic]]
    : [[['redirect_url'], !value.redirect_url]];
  for (const [path, isMissing] of missing) {
    if (isMissing) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `Required for ${value.type}` });
  }
});

export const recipientSchema = z.object({
  type: recipientTypeSchema,
  name: z.string().min(1),
  iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/),
  bic: z.string().regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/),
  address: addressSchema,
  tax_id: z.string().optional(),
});

export const payoutRequestSchema = z.object({
  claim_id: z.string().regex(/^claim_[a-zA-Z0-9-]+$/),
  amount: z.number().min(0).gt(0),
  currency: currencySchema,
  recipient: recipientSchema,
  purpose: payoutPurposeSchema,
  metadata: z.object({
    tax_withholding: z.number().default(0),
    compliance_checks: z.object({
      aml: z.boolean().default(true),
      kyc: z.boolean().default(true),
      sanctions: z.boolean().default(true),
    }).optional(),
    reference: z.string().optional(),
  }).optional(),
});

export const underwritingRequestSchema = z.object({
  policy_type: policyTypeSchema,
  business_id: z.string().min(1),
  data: z.record(z.unknown()),
  country: z.string().regex(/^[A-Z]{2}$/).default('DE'),
});

export const agreementRequestSchema = z.object({
  policy_id: z.string().regex(/^pol_[a-zA-Z0-9-]+$/),
  template_id: z.string().min(1),
  language: languageSchema,
  variables: z.record(z.unknown()).optional(),
  endorsement_id: z.string().regex(/^end_[a-zA-Z0-9-]+$/).optional(),
});

export const adjudicationRequestSchema = z.object({
  decision: adjudicationDecisionSchema,
  payout_amount: z.number().min(0).optional(),
  currency: currencySchema.default('EUR'),
  deductible_applied: z.number().min(0).optional(),
  reason: z.string().min(1),
  exclusions: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  adjudicator_id: z.string().min(1),
  notes: z.string().optional(),
});

export const auditLogEntrySchema = z.object({
  action: auditActionSchema,
  entity_type: auditEntityTypeSchema,
  entity_id: z.string().min(1),
  user_id: z.string().min(1),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  gdpr_consent: z.boolean().optional(),
});

export function validateSchema<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return validate(schema, data);
}

export const claimUpdateSchema = z.object({
  status: claimStatusSchema.optional(),
  estimated_loss: z.number().min(0).optional(),
  actual_loss: z.number().min(0).optional(),
  notes: z.string().optional(),
  documents: z.array(documentReferenceSchema).optional(),
});

export const policyChangeSchema = z.object({
  type: policyChangeTypeSchema,
  field: z.string().optional(),
  old_value: z.string().nullable().optional(),
  new_value: z.string().nullable().optional(),
  action: policyChangeActionSchema.optional(),
  code: z.string().optional(),
});

export const endorsementRequestSchema = z.object({
  changes: z.array(policyChangeSchema).min(1),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const bindQuoteRequestSchema = z.object({
  effective_date: dateSchema.optional(),
  notes: z.string().optional(),
});

export const renewPolicyRequestSchema = z.object({
  term: z.object({ start_date: dateSchema.optional(), end_date: dateSchema.optional() }).optional(),
  changes: z.array(policyChangeSchema).optional(),
});

export const cancelPolicyRequestSchema = z.object({
  reason: cancellationReasonSchema,
  effective_date: dateSchema.optional(),
});

export const signingRequestSchema = z.object({
  signatory_email: z.string().email(),
  redirect_url: z.string().url().optional(),
  signatory_role: signatoryRoleSchema.default('INSURED'),
});

export const voidAgreementRequestSchema = z.object({
  reason: z.string().min(1),
});

export const refundRequestSchema = z.object({
  amount: z.number().gt(0),
  reason: refundReasonSchema,
  payment_method_id: z.string().regex(/^pm_[a-zA-Z0-9-]+$/).optional(),
});

export const assignClaimRequestSchema = z.object({
  adjuster_id: z.string().min(1),
  notes: z.string().optional(),
});

export const investigationRequestSchema = z.object({
  investigator_id: z.string().min(1).optional(),
  scope: z.array(signingScopeSchema).optional(),
  notes: z.string().optional(),
});

export const appealRequestSchema = z.object({
  reason: z.string().min(1),
  documents: z.array(documentReferenceSchema).optional(),
});

export const claimDocumentUploadSchema = z.object({
  type: z.enum(['INCIDENT_REPORT', 'MEDICAL_REPORT', 'POLICE_REPORT', 'INVOICE', 'OTHER']).default('OTHER'),
  description: z.string().optional(),
});

export const documentUploadSchema = z.object({
  entity_type: entityTypeSchema,
  entity_id: z.string().min(1),
  type: documentTypeSchema,
  retention_policy: retentionPolicySchema.default('7_YEARS'),
});

export const redactRequestSchema = z.object({
  fields: z.array(z.string().min(1)).min(1),
});

export const cancelPayoutRequestSchema = z.object({
  reason: payoutCancellationReasonSchema,
});

export const underwritingRequirementsRequestSchema = z.object({
  business_id: z.string().min(1),
  policy_type: policyTypeSchema,
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
});

export const quoteUnderwritingUpdateSchema = z.object({
  net_premium: z.number().positive().optional(),
  risk_score: z.number().min(0).max(1).optional(),
  requirements: z.array(z.enum([
    'ANNUAL_AUDIT', 'CYBER_TRAINING', 'SAFETY_INSPECTION', 'FINANCIAL_STATEMENTS', 'OTHER'
  ] as [UnderwritingRequirement, ...UnderwritingRequirement[]])).optional(),
  exclusions: z.array(z.enum([
    'ACTS_OF_WAR', 'TERRORISM', 'FRAUD', 'INTENTIONAL_DAMAGE', 'OTHER'
  ] as [Exclusion, ...Exclusion[]])).optional(),
  reason: z.string().min(1),
}).refine(
  (value) => [value.net_premium, value.risk_score, value.requirements, value.exclusions].some((change) => change !== undefined),
  { message: 'Provide net_premium, risk_score, requirements or exclusions' }
);

export const underwritingRulesParamsSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  policy_type: policyTypeSchema,
});

export const erasureRequestSchema = z.object({
  entity_type: erasureEntityTypeSchema,
  entity_id: z.string().min(1),
  requester_email: z.string().email(),
  reason: z.string().optional(),
});

export const solvencyReportQuerySchema = z.object({
  period: periodSchema.default('QUARTERLY'),
  year: z.coerce.number().int().min(2020).optional(),
});

export const auditLogQuerySchema = z.object({
  entity_type: auditEntityTypeSchema.optional(),
  entity_id: z.string().optional(),
  action: auditActionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const documentListQuerySchema = z.object({
  entity_type: entityTypeSchema,
  entity_id: z.string().min(1),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function paginate<T>(items: T[], query: unknown) {
  const { limit, offset } = validate(paginationSchema, query);
  return { page: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

const docusignSignerSchema = z.object({
  recipientId: z.string(),
  email: z.string().optional(),
  status: z.string().optional(),
  signedDateTime: z.string().optional(),
  declinedDateTime: z.string().optional(),
  declinedReason: z.string().optional(),
}).passthrough();

export const docusignConnectEventSchema = z.object({
  event: z.string().min(1),
  generatedDateTime: z.string().optional(),
  data: z.object({
    envelopeId: z.string().min(1),
    recipientId: z.string().optional(),
    envelopeSummary: z.object({
      status: z.string().optional(),
      completedDateTime: z.string().optional(),
      voidedReason: z.string().optional(),
      recipients: z.object({ signers: z.array(docusignSignerSchema).optional() }).passthrough().optional(),
    }).passthrough().optional(),
  }).passthrough(),
}).passthrough();
