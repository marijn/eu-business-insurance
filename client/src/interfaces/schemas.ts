import type {
  PolicyType,
  QuoteStatus,
  PolicyStatus,
  ClaimStatus,
  InvoiceStatus,
  PayoutStatus,
  AdjudicationDecision,
  EndorsementStatus,
  AgreementStatus,
  SignatoryStatus,
  PaymentStatus,
  RefundStatus,
  PaymentMethodType,
  PaymentMethodStatus,
  PaymentGateway,
  ClaimantType,
  IncidentType,
  AddOnType,
  ExclusionType,
  IndustryType,
  CloudProvider,
  FinancialStrength,
  IndustryRiskLevel,
  Severity,
  Currency,
  TaxType,
  DocumentType,
  DocumentReferenceType,
  EntityType,
  RetentionPolicy,
  StorageLocation,
  RecipientType,
  PayoutPurpose,
  SignatoryRole,
  UnderwritingRequirement,
  AdjustmentFactor,
  PolicyChangeType,
  ChangeAction,
  InvoiceType,
  RefundReason,
  CancellationReason,
  PayoutCancellationReason,
  InvestigationScope,
  AuditAction,
  AuditEntityType,
  ClaimHistoryAction,
  Language,
  CardBrand,
  ErrorCode,
  Period,
  GDPREntityType,
  ErasureStatus,
} from './enums';

export type {
  PolicyType,
  QuoteStatus,
  PolicyStatus,
  ClaimStatus,
  InvoiceStatus,
  PayoutStatus,
  AdjudicationDecision,
  EndorsementStatus,
  AgreementStatus,
  SignatoryStatus,
  PaymentStatus,
  RefundStatus,
  PaymentMethodType,
  PaymentMethodStatus,
  PaymentGateway,
  ClaimantType,
  IncidentType,
  AddOnType,
  ExclusionType,
  IndustryType,
  CloudProvider,
  FinancialStrength,
  IndustryRiskLevel,
  Severity,
  Currency,
  TaxType,
  DocumentType,
  DocumentReferenceType,
  EntityType,
  RetentionPolicy,
  StorageLocation,
  RecipientType,
  PurposeType,
  PayoutPurpose,
  SignatoryRole,
  UnderwritingRequirement,
  AdjustmentFactor,
  PolicyChangeType,
  ChangeAction,
  InvoiceType,
  RefundReason,
  CancellationReason,
  PayoutCancellationReason,
  InvestigationScope,
  AuditAction,
  AuditEntityType,
  ClaimHistoryAction,
  Language,
  CardBrand,
  ErrorCode,
  Period,
  GDPREntityType,
  ErasureStatus,
} from './enums';

export interface QuoteRequest {
  business_id: string;
  policy_type: PolicyType;
  coverage_request: CoverageRequest;
  business_details: BusinessDetails;
  term: PolicyTerm;
}

export interface CoverageRequest {
  limits: {
    per_claim: number;
    aggregate?: number;
  };
  deductible: number;
  add_ons?: AddOnType[];
}

export interface BusinessDetails {
  legal_name: string;
  country: string;
  industry: IndustryType;
  revenue: number;
  employee_count?: number;
  vat_id?: string;
  cyber_risk_factors?: CyberRiskFactors;
  dno_risk_factors?: DNORiskFactors;
  surety_risk_factors?: SuretyRiskFactors;
  workers_comp_risk_factors?: WorkersCompRiskFactors;
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

export interface PolicyTerm {
  start_date: string;
  end_date: string;
}

export interface Premium {
  gross: number;
  net: number;
  taxes: Tax[];
  currency: Currency;
}

export interface Tax {
  type: TaxType;
  rate: number;
  amount: number;
}

export interface Coverage {
  limits: {
    per_claim?: number;
    aggregate?: number;
  };
  deductible: number;
  add_ons: string[];
  exclusions?: ExclusionType[];
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
  total?: number;
  limit?: number;
  offset?: number;
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
  total?: number;
  limit?: number;
  offset?: number;
}

export interface Endorsement {
  id: string;
  policy_id: string;
  changes: PolicyChange[];
  effective_date: string;
  status: EndorsementStatus;
  reason?: string;
  agreement_id?: string;
  created_at?: string;
}

export interface PolicyChange {
  type: PolicyChangeType;
  field?: string;
  old_value?: string | null;
  new_value?: string | null;
  action?: ChangeAction;
  code?: string;
}

export interface EndorsementRequest {
  changes: PolicyChange[];
  effective_date: string;
  reason?: string;
}

export interface RenewPolicyRequest {
  term?: PolicyTerm;
  changes?: PolicyChange[];
}

export interface CancelPolicyRequest {
  reason: CancellationReason;
  effective_date?: string;
}

export interface AgreementRequest {
  policy_id: string;
  template_id: string;
  language: Language;
  variables?: Record<string, unknown>;
  endorsement_id?: string;
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
  created_at?: string;
  signed_at?: string | null;
}

export interface AgreementVersion {
  version: string;
  created_at: string;
  changes: string[];
}

export interface Signatory {
  recipient_id?: string;
  role: SignatoryRole;
  email: string;
  name?: string;
  status: SignatoryStatus;
  signed_at?: string | null;
}

export interface SigningRequest {
  signature_request_id: string;
  signing_url: string;
  expires_at: string;
  signatory_email?: string;
}

export interface SignatureStatus {
  agreement_id: string;
  signatories: Signatory[];
  all_signed: boolean;
}

export interface VoidAgreementRequest {
  reason: string;
}

export interface InvoiceRequest {
  policy_id: string;
  type: InvoiceType;
  amount: number;
  currency: Currency;
  due_date: string;
  items: InvoiceItem[];
  billing_address: Address;
  payment_method_id?: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  tax_rate: number;
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
  billing_address?: Address;
  pdf_url?: string;
  payment_link?: string;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceList {
  invoices: Invoice[];
  total?: number;
  limit?: number;
  offset?: number;
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
  gateway: PaymentGateway;
  gateway_transaction_id?: string;
  receipt_url?: string;
  created_at: string;
  completed_at?: string | null;
}

export interface Refund {
  id: string;
  invoice_id: string;
  amount: number;
  currency: Currency;
  reason: RefundReason;
  status: RefundStatus;
  payment_method_id?: string;
  mollie_refunds?: Array<{ id: string; payment_id: string; amount: number; status: string }>;
  created_at: string;
  completed_at?: string | null;
}

export interface RefundRequest {
  amount: number;
  reason: RefundReason;
  payment_method_id?: string;
}

export interface PaymentMethodRequest {
  business_id: string;
  type: PaymentMethodType;
  details: {
    holder_name: string;
    iban?: string;
    bic?: string;
  };
  email?: string;
  redirect_url?: string;
  is_default?: boolean;
}

export interface PaymentMethod {
  id: string;
  business_id: string;
  type: PaymentMethodType;
  details: {
    holder_name?: string;
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

export interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
  vat_id?: string;
}

export interface ClaimRequest {
  policy_id: string;
  claimant: Claimant;
  incident: Incident;
  documents?: DocumentReference[];
  notes?: string;
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
  type: DocumentReferenceType;
  url: string;
  description?: string;
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  address?: Address;
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
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ClaimUpdate {
  status?: ClaimStatus;
  estimated_loss?: number;
  actual_loss?: number;
  notes?: string;
  documents?: DocumentReference[];
}

export interface ClaimNote {
  content: string;
  created_at: string;
  author: string;
  is_internal?: boolean;
}

export interface ClaimHistoryEntry {
  action: ClaimHistoryAction;
  timestamp: string;
  user_id: string;
  details?: Record<string, unknown>;
}

export interface ClaimHistory {
  history: ClaimHistoryEntry[];
}

export interface AssignClaimRequest {
  adjuster_id: string;
  notes?: string;
}

export interface InvestigationRequest {
  investigator_id?: string;
  scope?: InvestigationScope[];
  notes?: string;
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

export interface AppealRequest {
  reason: string;
  documents?: Array<{ type: string; url: string }>;
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

export interface Recipient {
  type: RecipientType;
  name: string;
  iban: string;
  bic: string;
  address: Address;
  tax_id?: string;
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
  total?: number;
  limit?: number;
  offset?: number;
}

export interface CancelPayoutRequest {
  reason: PayoutCancellationReason;
}

export interface UnderwritingRequest {
  policy_type: PolicyType;
  business_id: string;
  data: Record<string, unknown>;
  country?: string;
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

export interface PremiumAdjustment {
  factor: AdjustmentFactor;
  multiplier: number;
  reason: string;
}

export interface UnderwritingRequirementsRequest {
  business_id: string;
  policy_type: PolicyType;
  country?: string;
}

export interface UnderwritingRequirementsResponse {
  requirements: UnderwritingRequirement[];
}

export interface UnderwritingRule {
  code: string;
  description: string;
  is_mandatory: boolean;
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

export interface GDPRErasureRequest {
  entity_type: GDPREntityType;
  entity_id: string;
  requester_email: string;
  reason?: string;
}

export interface GDPRErasureResponse {
  request_id: string;
  status: ErasureStatus;
  erased_records?: Record<string, number>;
}

export interface SolvencyIIReport {
  report_id: string;
  period: Period;
  year: number;
  period_start: string;
  period_end: string;
  data: {
    assets: number;
    liabilities: number;
    solvency_ratio: number | null;
  };
  generated_at: string;
}

export interface AuditLogList {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface Document {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  type: DocumentType;
  file_name: string;
  mime_type: string;
  size: number;
  url: string;
  checksum?: string;
  storage_location?: StorageLocation;
  retention_policy?: RetentionPolicy;
  created_at?: string;
}

export interface DocumentList {
  documents: Document[];
}

export interface UploadDocumentRequest {
  entity_type: EntityType;
  entity_id: string;
  type: DocumentType;
  retention_policy?: RetentionPolicy;
}

export interface RedactDocumentRequest {
  fields: string[];
}

export interface Error {
  code: ErrorCode;
  message: string;
  details?: Array<{ field?: string; message: string }>;
  trace_id?: string;
}

export interface QueryParams {
  business_id?: string;
  policy_id?: string;
  policy_type?: PolicyType;
  status?: string;
  limit?: number;
  offset?: number;
  format?: 'pdf' | 'html' | 'json';
  claim_id?: string;
  period?: Period;
  year?: number;
  country?: string;
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
}
