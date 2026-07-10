export type PolicyType = 'CYBER' | 'DNO' | 'SURETY' | 'WORKERS_COMP';

export type QuoteStatus = 'DRAFT' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED';
export type PolicyStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'RENEWED';
export type ClaimStatus = 'SUBMITTED' | 'ASSIGNED' | 'INVESTIGATING' | 'ADJUDICATING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED' | 'PAID' | 'CLOSED' | 'APPEALED';
export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AdjudicationDecision = 'APPROVE' | 'DENY' | 'PARTIAL_APPROVE';
export type EndorsementStatus = 'PENDING' | 'ACTIVE' | 'CANCELLED';
export type AgreementStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'DECLINED' | 'VOIDED';
export type SignatoryStatus = 'PENDING' | 'SIGNED' | 'REJECTED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type PaymentMethodType = 'SEPA' | 'CARD';
export type PaymentMethodStatus = 'PENDING' | 'ACTIVE' | 'INVALID';
export type PaymentGateway = 'MOLLIE';

export type ClaimantType = 'INSURED' | 'EMPLOYEE' | 'THIRD_PARTY' | 'BENEFICIARY';

export type IncidentType = 
  | 'CYBER_BREACH'
  | 'DATA_LOSS'
  | 'DNO_CLAIM'
  | 'SURETY_DEFAULT'
  | 'WORK_INJURY'
  | 'WORK_ILLNESS'
  | 'PROPERTY_DAMAGE'
  | 'OTHER';

export type AddOnType = 
  | 'DATA_BREACH_RESPONSE'
  | 'REGULATORY_FINES'
  | 'CRISIS_MANAGEMENT'
  | 'LEGAL_DEFENSE'
  | 'BUSINESS_INTERRUPTION';

export type ExclusionType = 
  | 'ACTS_OF_WAR'
  | 'TERRORISM'
  | 'FRAUD'
  | 'INTENTIONAL_DAMAGE'
  | 'OTHER';

export type IndustryType = 
  | 'TECHNOLOGY'
  | 'FINANCE'
  | 'HEALTHCARE'
  | 'CONSTRUCTION'
  | 'MANUFACTURING'
  | 'RETAIL'
  | 'OTHER';

export type CloudProvider = 'AWS' | 'AZURE' | 'GCP' | 'ON_PREMISE' | 'OTHER';

export type FinancialStrength = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export type IndustryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export type Currency = 'EUR' | 'USD' | 'GBP';

export type TaxType = 'VAT' | 'STAMP_DUTY' | 'OTHER';

export type DocumentType = 
  | 'INCIDENT_REPORT'
  | 'POLICE_REPORT'
  | 'CONTRACT'
  | 'POLICY_DOCUMENT'
  | 'ENDORSEMENT'
  | 'CLAIM_FORM'
  | 'MEDICAL_REPORT'
  | 'INVOICE'
  | 'OTHER';

export type DocumentReferenceType = 
  | 'INCIDENT_REPORT'
  | 'MEDICAL_REPORT'
  | 'POLICE_REPORT'
  | 'INVOICE'
  | 'CONTRACT'
  | 'OTHER';

export type EntityType = 'POLICY' | 'CLAIM' | 'INVOICE' | 'AGREEMENT' | 'BUSINESS';

export type RetentionPolicy = '1_YEAR' | '7_YEARS' | 'PERMANENT';

export type StorageLocation = 'EU_CENTRAL' | 'EU_WEST' | 'EU_NORTH';

export type RecipientType = 'BUSINESS' | 'INDIVIDUAL' | 'LAW_FIRM' | 'OTHER';

export type PurposeType = 
  | 'CYBER_CLAIM'
  | 'DNO_CLAIM'
  | 'SURETY_CLAIM'
  | 'WORKERS_COMP_CLAIM'
  | 'REFUND';

export type PayoutPurpose = PurposeType;

export type SignatoryRole = 'INSURED' | 'INSURER' | 'BROKER' | 'WITNESS';

export type UnderwritingRequirement = 
  | 'ANNUAL_AUDIT'
  | 'CYBER_TRAINING'
  | 'SAFETY_INSPECTION'
  | 'FINANCIAL_STATEMENTS'
  | 'OTHER';

export type AdjustmentFactor = 
  | 'INDUSTRY'
  | 'REVENUE'
  | 'EMPLOYEE_COUNT'
  | 'SECURITY'
  | 'GOVERNANCE'
  | 'SAFETY'
  | 'OTHER';

export type PolicyChangeType = 
  | 'COVERAGE_LIMIT'
  | 'DEDUCTIBLE'
  | 'ADD_ON'
  | 'EXCLUSION'
  | 'TERM'
  | 'ADDRESS';

export type ChangeAction = 'ADD' | 'REMOVE' | 'UPDATE';

export type InvoiceType = 'PREMIUM' | 'FEE' | 'ADJUSTMENT' | 'REFUND';

export type RefundReason = 'DUPLICATE' | 'ERROR' | 'CANCELLATION' | 'OTHER';

export type CancellationReason = 
  | 'CUSTOMER_REQUEST'
  | 'NON_PAYMENT'
  | 'RISK_CHANGE'
  | 'FRAUD'
  | 'OTHER';

export type PayoutCancellationReason = 'FRAUD' | 'ERROR' | 'DUPLICATE' | 'OTHER';

export type InvestigationScope = 
  | 'FRAUD'
  | 'LIABILITY'
  | 'COVERAGE'
  | 'DAMAGE_ASSESSMENT';

export type AuditAction =
  | 'QUOTE_CREATED'
  | 'POLICY_BOUND'
  | 'POLICY_ENDORSED'
  | 'POLICY_RENEWED'
  | 'POLICY_CANCELLED'
  | 'AGREEMENT_GENERATED'
  | 'AGREEMENT_SIGNING_INITIATED'
  | 'AGREEMENT_SIGNATORY_SIGNED'
  | 'AGREEMENT_SIGNATORY_DECLINED'
  | 'AGREEMENT_SIGNED'
  | 'AGREEMENT_DECLINED'
  | 'AGREEMENT_VOIDED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_PROCESSED'
  | 'PAYMENT_UPDATED'
  | 'REFUND_ISSUED'
  | 'REFUND_UPDATED'
  | 'PAYMENT_METHOD_ADDED'
  | 'PAYMENT_METHOD_UPDATED'
  | 'DUNNING_TRIGGERED'
  | 'CLAIM_SUBMITTED'
  | 'CLAIM_UPDATED'
  | 'CLAIM_DOCUMENT_ADDED'
  | 'CLAIM_ASSIGNED'
  | 'CLAIM_INVESTIGATION_REQUESTED'
  | 'CLAIM_ADJUDICATED'
  | 'CLAIM_APPEALED'
  | 'CLAIM_PAID'
  | 'CLAIM_CLOSED'
  | 'PAYOUT_INITIATED'
  | 'PAYOUT_CANCELLED'
  | 'PAYOUT_COMPLETED'
  | 'UNDERWRITING_ASSESSED'
  | 'UNDERWRITING_ADJUSTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_REDACTED'
  | 'GDPR_ERASURE_COMPLETED'
  | 'SOLVENCY_REPORT_GENERATED';

export type AuditEntityType = 
  | 'QUOTE'
  | 'POLICY'
  | 'CLAIM'
  | 'INVOICE'
  | 'PAYOUT'
  | 'AGREEMENT'
  | 'PAYMENT'
  | 'DOCUMENT'
  | 'UNDERWRITING'
  | 'PAYMENT_METHOD'
  | 'REFUND'
  | 'GDPR_REQUEST'
  | 'REPORT';

export type ClaimHistoryAction =
  | 'SUBMITTED'
  | 'UPDATED'
  | 'DOCUMENT_ADDED'
  | 'ASSIGNED'
  | 'INVESTIGATED'
  | 'ADJUDICATED'
  | 'APPEALED'
  | 'PAID'
  | 'CLOSED';

export type Language = 'en' | 'de' | 'fr' | 'es' | 'it';

export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTHER';

export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type Period = 'QUARTERLY' | 'ANNUAL';

export type GDPREntityType = 'BUSINESS' | 'USER' | 'POLICY' | 'CLAIM';

export type ErasureStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED';
