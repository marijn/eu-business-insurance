export type PolicyType = 'CYBER' | 'DNO' | 'SURETY' | 'WORKERS_COMP';
export type ClaimStatus = 'SUBMITTED' | 'ASSIGNED' | 'INVESTIGATING' | 'ADJUDICATING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED' | 'PAID' | 'CLOSED' | 'APPEALED';
export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AdjudicationDecision = 'APPROVE' | 'DENY' | 'PARTIAL_APPROVE';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';
export type PolicyStatus = 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'RENEWED';
export type SignatoryRole = 'INSURED' | 'INSURER' | 'BROKER' | 'WITNESS';
export type SignatoryStatus = 'PENDING' | 'SIGNED' | 'REJECTED';
export type AgreementStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'DECLINED' | 'VOIDED';
export type EndorsementStatus = 'PENDING' | 'ACTIVE' | 'CANCELLED';
export type PolicyChangeType = 'COVERAGE_LIMIT' | 'DEDUCTIBLE' | 'ADD_ON' | 'EXCLUSION' | 'TERM' | 'ADDRESS';
export type PolicyChangeAction = 'ADD' | 'REMOVE' | 'UPDATE';
export type IncidentType = 'CYBER_BREACH' | 'DATA_LOSS' | 'DNO_CLAIM' | 'SURETY_DEFAULT' | 'WORK_INJURY' | 'WORK_ILLNESS' | 'PROPERTY_DAMAGE' | 'OTHER';
export type ClaimantType = 'INSURED' | 'EMPLOYEE' | 'THIRD_PARTY' | 'BENEFICIARY';
export type RecipientType = 'BUSINESS' | 'INDIVIDUAL' | 'LAW_FIRM' | 'OTHER';
export type PaymentMethodType = 'SEPA' | 'CARD';
export type PaymentMethodStatus = 'PENDING' | 'ACTIVE' | 'INVALID';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentType = 'PREMIUM' | 'FEE' | 'ADJUSTMENT' | 'REFUND';
export type RefundReason = 'DUPLICATE' | 'ERROR' | 'CANCELLATION' | 'OTHER';
export type PayoutPurpose = 'CYBER_CLAIM' | 'DNO_CLAIM' | 'SURETY_CLAIM' | 'WORKERS_COMP_CLAIM' | 'REFUND';
export type Industry = 'TECHNOLOGY' | 'FINANCE' | 'HEALTHCARE' | 'CONSTRUCTION' | 'MANUFACTURING' | 'RETAIL' | 'OTHER';
export type CloudProvider = 'AWS' | 'AZURE' | 'GCP' | 'ON_PREMISE' | 'OTHER';
export type FinancialStrength = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export type IndustryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type DocumentType = 'INCIDENT_REPORT' | 'MEDICAL_REPORT' | 'POLICE_REPORT' | 'INVOICE' | 'CONTRACT' | 'OTHER' | 'POLICY_DOCUMENT' | 'ENDORSEMENT' | 'CLAIM_FORM';
export type EntityType = 'POLICY' | 'CLAIM' | 'INVOICE' | 'AGREEMENT' | 'BUSINESS';
export type RetentionPolicy = '1_YEAR' | '7_YEARS' | 'PERMANENT';
export type StorageLocation = 'EU_CENTRAL' | 'EU_WEST' | 'EU_NORTH';
export type MimeType = 'application/pdf' | 'application/json' | 'text/plain' | 'image/jpeg' | 'image/png';
export type TaxType = 'VAT' | 'STAMP_DUTY' | 'OTHER';
export type Currency = 'EUR' | 'USD' | 'GBP';
export type Language = 'en' | 'de' | 'fr' | 'es' | 'it';
export type AddOn = 'DATA_BREACH_RESPONSE' | 'REGULATORY_FINES' | 'CRISIS_MANAGEMENT' | 'LEGAL_DEFENSE' | 'BUSINESS_INTERRUPTION';
export type Exclusion = 'ACTS_OF_WAR' | 'TERRORISM' | 'FRAUD' | 'INTENTIONAL_DAMAGE' | 'OTHER';
export type UnderwritingRequirement = 'ANNUAL_AUDIT' | 'CYBER_TRAINING' | 'SAFETY_INSPECTION' | 'FINANCIAL_STATEMENTS' | 'OTHER';
export type PremiumAdjustmentFactor = 'INDUSTRY' | 'REVENUE' | 'EMPLOYEE_COUNT' | 'SECURITY' | 'GOVERNANCE' | 'SAFETY' | 'OTHER';
export const AUDIT_ACTIONS = [
  'QUOTE_CREATED', 'POLICY_BOUND', 'POLICY_ACTIVATED', 'POLICY_ENDORSED', 'ENDORSEMENT_APPLIED', 'ENDORSEMENT_CANCELLED',
  'POLICY_RENEWED', 'POLICY_CANCELLED', 'POLICY_EXPIRED',
  'AGREEMENT_GENERATED', 'AGREEMENT_SIGNING_INITIATED', 'AGREEMENT_SIGNATORY_SIGNED',
  'AGREEMENT_SIGNATORY_DECLINED', 'AGREEMENT_SIGNED', 'AGREEMENT_DECLINED', 'AGREEMENT_VOIDED',
  'INVOICE_CREATED', 'PAYMENT_PROCESSED', 'PAYMENT_UPDATED', 'REFUND_ISSUED', 'REFUND_UPDATED',
  'PAYMENT_METHOD_ADDED', 'PAYMENT_METHOD_UPDATED', 'DUNNING_TRIGGERED',
  'CLAIM_SUBMITTED', 'CLAIM_UPDATED', 'CLAIM_DOCUMENT_ADDED', 'CLAIM_ASSIGNED', 'CLAIM_INVESTIGATION_REQUESTED',
  'CLAIM_ADJUDICATED', 'CLAIM_APPEALED', 'CLAIM_PAID', 'CLAIM_CLOSED',
  'PAYOUT_INITIATED', 'PAYOUT_CANCELLED', 'PAYOUT_COMPLETED',
  'UNDERWRITING_ASSESSED', 'UNDERWRITING_ADJUSTED',
  'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'DOCUMENT_REDACTED',
  'GDPR_ERASURE_COMPLETED', 'SOLVENCY_REPORT_GENERATED',
] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];
export const AUDIT_ENTITY_TYPES = [
  'QUOTE', 'POLICY', 'CLAIM', 'INVOICE', 'PAYOUT', 'AGREEMENT', 'PAYMENT', 'DOCUMENT', 'UNDERWRITING',
  'PAYMENT_METHOD', 'REFUND', 'GDPR_REQUEST', 'REPORT',
] as const;
export type AuditEntityType = typeof AUDIT_ENTITY_TYPES[number];
export type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
export type CancellationReason = 'CUSTOMER_REQUEST' | 'NON_PAYMENT' | 'RISK_CHANGE' | 'FRAUD' | 'OTHER';
export type PayoutCancellationReason = 'FRAUD' | 'ERROR' | 'DUPLICATE' | 'OTHER';
export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTHER';
export type Gateway = 'MOLLIE';
export type Period = 'QUARTERLY' | 'ANNUAL';
export type ErasureEntityType = 'BUSINESS' | 'USER' | 'POLICY' | 'CLAIM';
export type ErasureStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED';
export type ClaimHistoryAction = 'SUBMITTED' | 'UPDATED' | 'DOCUMENT_ADDED' | 'ASSIGNED' | 'INVESTIGATED' | 'ADJUDICATED' | 'APPEALED' | 'PAID' | 'CLOSED';
export type SigningScope = 'FRAUD' | 'LIABILITY' | 'COVERAGE' | 'DAMAGE_ASSESSMENT';

export interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
  vat_id?: string;
}

export interface PolicyTerm {
  start_date: string;
  end_date: string;
}

export interface CoverageRequest {
  limits: {
    per_claim: number;
    aggregate?: number;
  };
  deductible: number;
  add_ons?: AddOn[];
}

export interface Coverage {
  limits: {
    per_claim: number;
    aggregate?: number;
  };
  deductible: number;
  add_ons: string[];
  exclusions?: Exclusion[];
}

export interface CyberRiskFactors {
  has_mfa?: boolean;
  has_encryption?: boolean;
  cloud_provider?: CloudProvider;
  incident_history?: Array<{
    date: string;
    severity: Severity;
    description: string;
  }>;
}

export interface DNORiskFactors {
  governance_score?: number;
  past_litigation?: boolean;
  board_size?: number;
}

export interface SuretyRiskFactors {
  financial_strength?: FinancialStrength;
  project_size?: number;
  past_defaults?: number;
}

export interface WorkersCompRiskFactors {
  safety_training?: boolean;
  industry_risk_level?: IndustryRiskLevel;
  past_claims?: number;
}

export interface BusinessDetails {
  legal_name: string;
  country: string;
  industry: Industry;
  revenue: number;
  employee_count?: number;
  vat_id?: string;
  cyber_risk_factors?: CyberRiskFactors;
  dno_risk_factors?: DNORiskFactors;
  surety_risk_factors?: SuretyRiskFactors;
  workers_comp_risk_factors?: WorkersCompRiskFactors;
}

export interface QuoteRequest {
  business_id: string;
  policy_type: PolicyType;
  coverage_request: CoverageRequest;
  business_details: BusinessDetails;
  term: PolicyTerm;
}

export interface Tax {
  type: TaxType;
  rate: number;
  amount: number;
}

export interface Premium {
  gross: number;
  net: number;
  taxes: Tax[];
  currency: Currency;
}

export interface UnderwritingSummary {
  risk_score?: number;
  requirements?: UnderwritingRequirement[];
  exclusions?: string[];
}

export interface Quote {
  id: string;
  status: QuoteStatus;
  premium: Premium;
  coverage: Coverage;
  underwriting: UnderwritingSummary;
  expiry_date: string;
  created_at: string;
  business_id?: string;
  policy_type?: PolicyType;
  term?: PolicyTerm;
}

export interface QuoteList {
  quotes: Quote[];
  total: number;
  limit: number;
  offset: number;
}

export interface Policy {
  id: string;
  business_id: string;
  policy_type: PolicyType;
  status: PolicyStatus;
  premium: Premium;
  coverage: Coverage;
  term: PolicyTerm;
  agreement_id?: string;
  invoices?: string[];
  endorsements?: Endorsement[];
  cancellation?: {
    reason: CancellationReason;
    effective_date: string;
  };
  renewed_from?: string;
  created_at: string;
  updated_at?: string;
}

export interface PolicyList {
  policies: Policy[];
  total: number;
  limit: number;
  offset: number;
}

export interface PolicyChange {
  type: PolicyChangeType;
  field?: string;
  old_value?: string | null;
  new_value?: string | null;
  action?: PolicyChangeAction;
  code?: string;
}

export interface Endorsement {
  id: string;
  policy_id: string;
  changes: PolicyChange[];
  effective_date: string;
  status: EndorsementStatus;
  reason?: string;
  agreement_id?: string;
  created_at: string;
}

export interface EndorsementRequest {
  changes: PolicyChange[];
  effective_date: string;
  reason?: string;
}

export interface Signatory {
  recipient_id?: string;
  role: SignatoryRole;
  email: string;
  name?: string;
  status: SignatoryStatus;
  signed_at?: string | null;
}

export interface Agreement {
  id: string;
  policy_id?: string;
  endorsement_id?: string;
  envelope_id?: string;
  status: AgreementStatus;
  document_url: string;
  template_version: string;
  signatories: Signatory[];
  created_at: string;
  signed_at?: string | null;
}

export interface AgreementVersion {
  version: string;
  created_at: string;
  changes: string[];
}

export interface AgreementRequest {
  policy_id: string;
  template_id: string;
  language: Language;
  variables?: Record<string, unknown>;
  endorsement_id?: string;
}

export interface SigningRequest {
  signature_request_id: string;
  signing_url: string;
  expires_at: string;
  signatory_email: string;
}

export interface SignatureStatus {
  agreement_id: string;
  signatories: Signatory[];
  all_signed: boolean;
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  address?: Address;
}

export interface Claimant {
  type: ClaimantType;
  business_id?: string;
  employee_id?: string;
  contact: Contact;
}

export interface Incident {
  type: IncidentType;
  date: string;
  description: string;
  location?: string;
  estimated_loss?: number;
  actual_loss?: number | null;
}

export interface DocumentReference {
  type: DocumentType;
  url: string;
  description?: string;
}

export interface ClaimRequest {
  policy_id: string;
  claimant: Claimant;
  incident: Incident;
  documents?: DocumentReference[];
  notes?: string;
}

export interface ClaimNote {
  content: string;
  created_at: string;
  author: string;
  is_internal?: boolean;
}

export interface Claim {
  id: string;
  policy_id: string;
  claim_number?: string;
  claimant: Claimant;
  incident: Incident;
  status: ClaimStatus;
  assigned_adjuster?: string | null;
  estimated_loss?: number;
  actual_loss?: number | null;
  documents?: Document[];
  notes?: ClaimNote[];
  adjudication?: Adjudication;
  created_at: string;
  updated_at?: string;
  closed_at?: string | null;
}

export interface ClaimList {
  claims: Claim[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClaimUpdate {
  status?: ClaimStatus;
  estimated_loss?: number;
  actual_loss?: number;
  notes?: string;
  documents?: DocumentReference[];
}

export interface ClaimHistoryEntry {
  action: ClaimHistoryAction;
  timestamp: string;
  user_id: string;
  details?: Record<string, unknown>;
}

export interface AdjudicationRequest {
  decision: AdjudicationDecision;
  payout_amount?: number;
  currency?: Currency;
  deductible_applied?: number;
  reason: string;
  exclusions?: string[];
  conditions?: string[];
  adjudicator_id: string;
  notes?: string;
}

export interface Adjudication {
  id: string;
  claim_id: string;
  decision: AdjudicationDecision;
  payout_amount?: number | null;
  currency?: Currency;
  deductible_applied?: number | null;
  reason: string;
  exclusions?: string[];
  conditions?: string[];
  adjudicator_id: string;
  timestamp: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  tax_rate: number;
}

export interface InvoiceRequest {
  policy_id: string;
  type: PaymentType;
  amount: number;
  currency: Currency;
  due_date: string;
  items: InvoiceItem[];
  billing_address: Address;
  payment_method_id?: string;
}

export interface Invoice {
  id: string;
  policy_id: string;
  status: InvoiceStatus;
  amount: number;
  currency: Currency;
  due_date: string;
  paid_at?: string | null;
  items: InvoiceItem[];
  billing_address: Address;
  pdf_url?: string;
  payment_link?: string;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceList {
  invoices: Invoice[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaymentRequest {
  payment_method_id: string;
  amount: number;
  currency: Currency;
  metadata?: {
    psd2_sca?: boolean;
    sepa_mandate_id?: string;
    reference?: string;
  };
}

export interface Payment {
  id: string;
  invoice_id: string;
  payment_method_id?: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  gateway: Gateway;
  gateway_transaction_id?: string;
  receipt_url?: string;
  created_at: string;
  completed_at?: string | null;
}

export interface PaymentMethodDetails {
  holder_name: string;
  iban?: string;
  bic?: string;
}

export interface PaymentMethodRequest {
  business_id: string;
  type: PaymentMethodType;
  details: PaymentMethodDetails;
  email?: string;
  redirect_url?: string;
  is_default?: boolean;
}

export interface PaymentMethod {
  id: string;
  business_id: string;
  type: PaymentMethodType;
  details: {
    holder_name: string;
    masked_iban?: string;
    masked_card?: string;
    card_brand?: CardBrand;
  };
  status: PaymentMethodStatus;
  checkout_url?: string;
  mollie_customer_id: string;
  mollie_mandate_id?: string;
  mollie_payment_id?: string;
  is_default: boolean;
  created_at: string;
}

export interface Refund {
  id: string;
  invoice_id: string;
  amount: number;
  currency: Currency;
  reason: RefundReason;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payment_method_id?: string;
  mollie_refunds: Array<{ id: string; payment_id: string; amount: number; status: string }>;
  created_at: string;
  completed_at?: string | null;
}

export interface Recipient {
  type: RecipientType;
  name: string;
  iban: string;
  bic: string;
  address: Address;
  tax_id?: string;
}

export interface PayoutRequest {
  claim_id: string;
  amount: number;
  currency: Currency;
  recipient: Recipient;
  purpose: PayoutPurpose;
  metadata?: {
    tax_withholding?: number;
    compliance_checks?: {
      aml?: boolean;
      kyc?: boolean;
      sanctions?: boolean;
    };
    reference?: string;
  };
}

export interface Payout {
  id: string;
  claim_id: string;
  amount: number;
  currency: Currency;
  recipient: Recipient;
  status: PayoutStatus;
  bank_reference?: string;
  purpose?: string;
  estimated_arrival?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export interface PayoutList {
  payouts: Payout[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnderwritingRequest {
  policy_type: PolicyType;
  business_id: string;
  data: Record<string, unknown>;
  country?: string;
}

export interface PremiumAdjustment {
  factor: PremiumAdjustmentFactor;
  multiplier: number;
  reason: string;
}

export interface UnderwritingResponse {
  assessment_id?: string;
  risk_score: number;
  premium_base: number;
  premium_adjustments?: PremiumAdjustment[];
  final_premium: number;
  requirements: UnderwritingRequirement[];
  exclusions?: string[];
  recommendations?: string[];
}

export interface QuoteUnderwriting {
  quote_id: string;
  status: QuoteStatus;
  premium: Premium;
  risk_score?: number;
  requirements: UnderwritingRequirement[];
  exclusions: Exclusion[];
}

export interface QuoteUnderwritingUpdate {
  net_premium?: number;
  risk_score?: number;
  requirements?: UnderwritingRequirement[];
  exclusions?: Exclusion[];
  reason: string;
}

export interface AuditLogEntry {
  action_id?: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  user_id: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  country?: string;
  gdpr_consent?: boolean;
}

export interface Document {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  type: DocumentType;
  file_name: string;
  mime_type: MimeType;
  size: number;
  url: string;
  checksum?: string;
  storage_location?: StorageLocation;
  retention_policy?: RetentionPolicy;
  created_at: string;
}

export interface Error {
  code: ErrorCode;
  message: string;
  details?: Array<{ field: string; message: string }>;
  trace_id?: string;
}

export interface BindQuoteRequest {
  effective_date?: string;
  notes?: string;
}

export interface RenewPolicyRequest {
  term?: PolicyTerm;
  changes?: PolicyChange[];
}

export interface CancelPolicyRequest {
  reason: CancellationReason;
  effective_date?: string;
}

export interface InitiateSigningRequest {
  signatory_email: string;
  redirect_url?: string;
  signatory_role?: SignatoryRole;
}

export interface VoidAgreementRequest {
  reason: string;
}

export interface RefundRequest {
  amount: number;
  reason: RefundReason;
  payment_method_id?: string;
}

export interface AssignClaimRequest {
  adjuster_id: string;
  notes?: string;
}

export interface InvestigationRequest {
  investigator_id?: string;
  scope?: SigningScope[];
  notes?: string;
}

export interface AppealRequest {
  reason: string;
  documents?: Array<{ type: string; url: string }>;
}

export interface ErasureRequest {
  entity_type: ErasureEntityType;
  entity_id: string;
  requester_email: string;
  reason?: string;
}

export interface DocumentUploadRequest {
  entity_type: EntityType;
  entity_id: string;
  type: DocumentType;
  retention_policy?: RetentionPolicy;
}

export interface DocumentRedactRequest {
  fields: string[];
}

export interface DunningRequest {
}

export interface QueryParams {
  business_id?: string;
  policy_id?: string;
  policy_type?: PolicyType;
  status?: string;
  limit?: number;
  offset?: number;
  format?: 'pdf' | 'html' | 'json';
  period?: Period;
  year?: number;
}

export interface PathParams {
  quote_id?: string;
  policy_id?: string;
  agreement_id?: string;
  invoice_id?: string;
  claim_id?: string;
  payout_id?: string;
  document_id?: string;
  action_id?: string;
  country?: string;
}


export interface RatingProfile {
  country: string;
  industry?: Industry;
  revenue?: number;
  employee_count?: number;
  cyber?: CyberRiskFactors;
  dno?: DNORiskFactors;
  surety?: SuretyRiskFactors;
  workers_comp?: WorkersCompRiskFactors;
}
