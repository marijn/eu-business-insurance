import { DataTypes, Includeable, Model, ModelStatic, Op, Sequelize, Transaction } from 'sequelize';
import { Collection, StorageBackend } from './backend';
import {
  Agreement, AuditLogEntry, Claim, Document, Invoice, Payment, PaymentMethod, Payout, Policy, Quote, RatingProfile, Refund,
} from '../types';

const { STRING, TEXT, DECIMAL, DOUBLE, INTEGER, BIGINT, BOOLEAN, DATEONLY, DATE, BLOB } = DataTypes;
const options = { timestamps: false, freezeTableName: true };

function defineModels(sequelize: Sequelize) {
  const Business = sequelize.define('businesses', {
    id: { type: STRING(64), primaryKey: true },
    mollie_customer_id: { type: STRING(64), unique: true },
  }, options);

  const RatingProfile = sequelize.define('rating_profiles', {
    owner_id: { type: STRING(64), primaryKey: true },
    country: { type: STRING(2), allowNull: false },
    industry: STRING(32),
    revenue: DECIMAL(15, 2),
    employee_count: INTEGER,
  }, options);
  const CyberRiskFactors = sequelize.define('rating_profile_cyber', {
    owner_id: { type: STRING(64), primaryKey: true },
    has_mfa: BOOLEAN,
    has_encryption: BOOLEAN,
    cloud_provider: STRING(32),
  }, options);
  RatingProfile.hasOne(CyberRiskFactors, { as: 'cyber', foreignKey: 'owner_id', onDelete: 'CASCADE' });
  const RatingProfileIncident = sequelize.define('rating_profile_incidents', {
    owner_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    date: { type: DATEONLY, allowNull: false },
    severity: { type: STRING(16), allowNull: false },
    description: { type: TEXT, allowNull: false },
  }, options);
  CyberRiskFactors.hasMany(RatingProfileIncident, { as: 'incident_history', foreignKey: 'owner_id', onDelete: 'CASCADE' });
  const DnoRiskFactors = sequelize.define('rating_profile_dno', {
    owner_id: { type: STRING(64), primaryKey: true },
    governance_score: DOUBLE,
    past_litigation: BOOLEAN,
    board_size: INTEGER,
  }, options);
  RatingProfile.hasOne(DnoRiskFactors, { as: 'dno', foreignKey: 'owner_id', onDelete: 'CASCADE' });
  const SuretyRiskFactors = sequelize.define('rating_profile_surety', {
    owner_id: { type: STRING(64), primaryKey: true },
    financial_strength: STRING(16),
    project_size: DECIMAL(15, 2),
    past_defaults: INTEGER,
  }, options);
  RatingProfile.hasOne(SuretyRiskFactors, { as: 'surety', foreignKey: 'owner_id', onDelete: 'CASCADE' });
  const WorkersCompRiskFactors = sequelize.define('rating_profile_workers_comp', {
    owner_id: { type: STRING(64), primaryKey: true },
    safety_training: BOOLEAN,
    industry_risk_level: STRING(16),
    past_claims: INTEGER,
  }, options);
  RatingProfile.hasOne(WorkersCompRiskFactors, { as: 'workers_comp', foreignKey: 'owner_id', onDelete: 'CASCADE' });

  const Quote = sequelize.define('quotes', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    business_id: STRING(64),
    policy_type: STRING(32),
    status: { type: STRING(16), allowNull: false },
    premium_gross: { type: DECIMAL(15, 2), allowNull: false },
    premium_net: { type: DECIMAL(15, 2), allowNull: false },
    currency: { type: STRING(3), allowNull: false },
    per_claim_limit: { type: DECIMAL(15, 2), allowNull: false },
    aggregate_limit: DECIMAL(15, 2),
    deductible: { type: DECIMAL(15, 2), allowNull: false },
    risk_score: DOUBLE,
    term_start: DATEONLY,
    term_end: DATEONLY,
    expiry_date: { type: DATE(3), allowNull: false },
    created_at: { type: DATE(3), allowNull: false },
  }, { ...options, indexes: [{ fields: ['business_id'] }, { fields: ['status'] }] });
  Quote.belongsTo(Business, { foreignKey: 'business_id' });
  const QuoteTax = sequelize.define('quote_taxes', {
    quote_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    type: { type: STRING(16), allowNull: false },
    rate: { type: DECIMAL(6, 4), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
  }, options);
  Quote.hasMany(QuoteTax, { as: 'taxes', foreignKey: 'quote_id', onDelete: 'CASCADE' });
  const [QuoteAddOn, QuoteExclusion, QuoteRequirement, QuoteUnderwritingExclusion] = [
    'quote_add_ons', 'quote_exclusions', 'quote_requirements', 'quote_underwriting_exclusions',
  ].map((table) => sequelize.define(table, {
    quote_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    code: { type: STRING(64), allowNull: false },
  }, options));
  Quote.hasMany(QuoteAddOn, { as: 'add_ons', foreignKey: 'quote_id', onDelete: 'CASCADE' });
  Quote.hasMany(QuoteExclusion, { as: 'exclusions', foreignKey: 'quote_id', onDelete: 'CASCADE' });
  Quote.hasMany(QuoteRequirement, { as: 'requirements', foreignKey: 'quote_id', onDelete: 'CASCADE' });
  Quote.hasMany(QuoteUnderwritingExclusion, { as: 'underwriting_exclusions', foreignKey: 'quote_id', onDelete: 'CASCADE' });

  const Policy = sequelize.define('policies', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    business_id: { type: STRING(64), allowNull: false },
    policy_type: { type: STRING(32), allowNull: false },
    status: { type: STRING(16), allowNull: false },
    premium_gross: { type: DECIMAL(15, 2), allowNull: false },
    premium_net: { type: DECIMAL(15, 2), allowNull: false },
    currency: { type: STRING(3), allowNull: false },
    per_claim_limit: { type: DECIMAL(15, 2), allowNull: false },
    aggregate_limit: DECIMAL(15, 2),
    deductible: { type: DECIMAL(15, 2), allowNull: false },
    term_start: { type: DATEONLY, allowNull: false },
    term_end: { type: DATEONLY, allowNull: false },
    agreement_id: STRING(64),
    cancellation_reason: STRING(32),
    cancellation_effective_date: DATEONLY,
    renewed_from: STRING(64),
    created_at: { type: DATE(3), allowNull: false },
    updated_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['business_id'] }, { fields: ['status'] }] });
  Policy.belongsTo(Business, { foreignKey: 'business_id' });
  Policy.belongsTo(Policy, { as: 'renewed', foreignKey: 'renewed_from' });
  const PolicyTax = sequelize.define('policy_taxes', {
    policy_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    type: { type: STRING(16), allowNull: false },
    rate: { type: DECIMAL(6, 4), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
  }, options);
  Policy.hasMany(PolicyTax, { as: 'taxes', foreignKey: 'policy_id', onDelete: 'CASCADE' });
  const [PolicyAddOn, PolicyExclusion] = ['policy_add_ons', 'policy_exclusions'].map((table) => sequelize.define(table, {
    policy_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    code: { type: STRING(64), allowNull: false },
  }, options));
  Policy.hasMany(PolicyAddOn, { as: 'add_ons', foreignKey: 'policy_id', onDelete: 'CASCADE' });
  Policy.hasMany(PolicyExclusion, { as: 'exclusions', foreignKey: 'policy_id', onDelete: 'CASCADE' });

  const Endorsement = sequelize.define('endorsements', {
    id: { type: STRING(64), primaryKey: true },
    policy_id: { type: STRING(64), allowNull: false },
    position: { type: INTEGER, allowNull: false },
    effective_date: { type: DATEONLY, allowNull: false },
    status: { type: STRING(16), allowNull: false },
    reason: TEXT,
    agreement_id: STRING(64),
    created_at: { type: DATE(3), allowNull: false },
  }, options);
  Policy.hasMany(Endorsement, { as: 'endorsements', foreignKey: 'policy_id', onDelete: 'CASCADE' });
  const EndorsementChange = sequelize.define('endorsement_changes', {
    endorsement_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    type: { type: STRING(32), allowNull: false },
    field: STRING(64),
    old_value: TEXT,
    new_value: TEXT,
    action: STRING(16),
    code: STRING(64),
  }, options);
  Endorsement.hasMany(EndorsementChange, { as: 'changes', foreignKey: 'endorsement_id', onDelete: 'CASCADE' });

  const Agreement = sequelize.define('agreements', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    policy_id: STRING(64),
    endorsement_id: STRING(64),
    envelope_id: STRING(64),
    status: { type: STRING(32), allowNull: false },
    document_url: { type: STRING(512), allowNull: false },
    template_version: { type: STRING(128), allowNull: false },
    created_at: { type: DATE(3), allowNull: false },
    signed_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['policy_id'] }, { fields: ['envelope_id'] }] });
  Agreement.belongsTo(Policy, { foreignKey: 'policy_id' });
  Agreement.belongsTo(Endorsement, { foreignKey: 'endorsement_id' });
  Policy.belongsTo(Agreement, { as: 'agreement', foreignKey: 'agreement_id', constraints: false });
  Endorsement.belongsTo(Agreement, { as: 'agreement', foreignKey: 'agreement_id', constraints: false });
  const AgreementSignatory = sequelize.define('agreement_signatories', {
    agreement_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    recipient_id: STRING(16),
    role: { type: STRING(16), allowNull: false },
    email: { type: STRING(255), allowNull: false },
    name: STRING(255),
    status: { type: STRING(16), allowNull: false },
    signed_at: DATE(3),
  }, options);
  Agreement.hasMany(AgreementSignatory, { as: 'signatories', foreignKey: 'agreement_id', onDelete: 'CASCADE' });

  const Invoice = sequelize.define('invoices', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    policy_id: { type: STRING(64), allowNull: false },
    status: { type: STRING(16), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
    currency: { type: STRING(3), allowNull: false },
    due_date: { type: DATEONLY, allowNull: false },
    paid_at: DATE(3),
    billing_street: { type: STRING(255), allowNull: false },
    billing_city: { type: STRING(255), allowNull: false },
    billing_postal_code: { type: STRING(32), allowNull: false },
    billing_country: { type: STRING(2), allowNull: false },
    billing_vat_id: STRING(32),
    pdf_url: STRING(512),
    payment_link: STRING(512),
    created_at: { type: DATE(3), allowNull: false },
    updated_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['policy_id'] }, { fields: ['status'] }] });
  Invoice.belongsTo(Policy, { foreignKey: 'policy_id' });
  Policy.hasMany(Invoice, { as: 'invoices', foreignKey: 'policy_id' });
  const InvoiceItem = sequelize.define('invoice_items', {
    invoice_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    description: { type: STRING(512), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
    tax_rate: { type: DECIMAL(6, 4), allowNull: false },
  }, options);
  Invoice.hasMany(InvoiceItem, { as: 'items', foreignKey: 'invoice_id', onDelete: 'CASCADE' });
  const InvoiceDunning = sequelize.define('invoice_dunning', {
    invoice_id: { type: STRING(64), primaryKey: true },
    level: { type: INTEGER, allowNull: false },
    last_sent_at: { type: DATE(3), allowNull: false },
  }, options);
  InvoiceDunning.belongsTo(Invoice, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });

  const PaymentMethod = sequelize.define('payment_methods', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    business_id: { type: STRING(64), allowNull: false },
    type: { type: STRING(16), allowNull: false },
    holder_name: { type: STRING(255), allowNull: false },
    masked_iban: STRING(34),
    masked_card: STRING(32),
    card_brand: STRING(16),
    status: { type: STRING(16), allowNull: false },
    checkout_url: STRING(512),
    mollie_mandate_id: STRING(64),
    mollie_payment_id: STRING(64),
    is_default: { type: BOOLEAN, allowNull: false },
    created_at: { type: DATE(3), allowNull: false },
  }, { ...options, indexes: [{ fields: ['business_id'] }, { fields: ['mollie_payment_id'] }] });
  PaymentMethod.belongsTo(Business, { as: 'business', foreignKey: 'business_id' });

  const Payment = sequelize.define('payments', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    invoice_id: { type: STRING(64), allowNull: false },
    payment_method_id: STRING(64),
    amount: { type: DECIMAL(15, 2), allowNull: false },
    currency: { type: STRING(3), allowNull: false },
    status: { type: STRING(16), allowNull: false },
    gateway: { type: STRING(16), allowNull: false },
    gateway_transaction_id: STRING(64),
    receipt_url: STRING(512),
    created_at: { type: DATE(3), allowNull: false },
    completed_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['invoice_id'] }, { fields: ['gateway_transaction_id'] }] });
  Payment.belongsTo(Invoice, { foreignKey: 'invoice_id' });
  Payment.belongsTo(PaymentMethod, { foreignKey: 'payment_method_id' });

  const Refund = sequelize.define('refunds', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    invoice_id: { type: STRING(64), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
    currency: { type: STRING(3), allowNull: false },
    reason: { type: STRING(32), allowNull: false },
    status: { type: STRING(16), allowNull: false },
    payment_method_id: STRING(64),
    created_at: { type: DATE(3), allowNull: false },
    completed_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['invoice_id'] }] });
  Refund.belongsTo(Invoice, { foreignKey: 'invoice_id' });
  Refund.belongsTo(PaymentMethod, { foreignKey: 'payment_method_id' });
  const RefundMollieRefund = sequelize.define('refund_mollie_refunds', {
    refund_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    mollie_refund_id: { type: STRING(64), allowNull: false },
    mollie_payment_id: { type: STRING(64), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
    status: { type: STRING(16), allowNull: false },
  }, { ...options, indexes: [{ fields: ['mollie_payment_id'] }] });
  Refund.hasMany(RefundMollieRefund, { as: 'mollie_refunds', foreignKey: 'refund_id', onDelete: 'CASCADE' });

  const Claim = sequelize.define('claims', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    policy_id: { type: STRING(64), allowNull: false },
    claim_number: STRING(32),
    status: { type: STRING(32), allowNull: false },
    assigned_adjuster: STRING(64),
    estimated_loss: DECIMAL(15, 2),
    actual_loss: DECIMAL(15, 2),
    claimant_type: { type: STRING(16), allowNull: false },
    claimant_business_id: STRING(64),
    claimant_employee_id: STRING(64),
    contact_name: { type: STRING(255), allowNull: false },
    contact_email: { type: STRING(255), allowNull: false },
    contact_phone: STRING(32),
    contact_street: STRING(255),
    contact_city: STRING(255),
    contact_postal_code: STRING(32),
    contact_country: STRING(2),
    contact_vat_id: STRING(32),
    incident_type: { type: STRING(32), allowNull: false },
    incident_date: { type: DATE(3), allowNull: false },
    incident_description: { type: TEXT, allowNull: false },
    incident_location: STRING(255),
    incident_estimated_loss: DECIMAL(15, 2),
    incident_actual_loss: DECIMAL(15, 2),
    created_at: { type: DATE(3), allowNull: false },
    updated_at: DATE(3),
    closed_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['policy_id'] }, { fields: ['status'] }, { fields: ['claimant_employee_id'] }] });
  Claim.belongsTo(Policy, { foreignKey: 'policy_id' });
  const ClaimNote = sequelize.define('claim_notes', {
    claim_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    content: { type: TEXT, allowNull: false },
    created_at: { type: DATE(3), allowNull: false },
    author: { type: STRING(64), allowNull: false },
    is_internal: BOOLEAN,
  }, options);
  Claim.hasMany(ClaimNote, { as: 'notes', foreignKey: 'claim_id', onDelete: 'CASCADE' });
  const Adjudication = sequelize.define('claim_adjudications', {
    id: { type: STRING(64), primaryKey: true },
    claim_id: { type: STRING(64), allowNull: false, unique: true },
    decision: { type: STRING(16), allowNull: false },
    payout_amount: DECIMAL(15, 2),
    currency: STRING(3),
    deductible_applied: DECIMAL(15, 2),
    reason: { type: TEXT, allowNull: false },
    adjudicator_id: { type: STRING(64), allowNull: false },
    timestamp: { type: DATE(3), allowNull: false },
  }, options);
  Claim.hasOne(Adjudication, { as: 'adjudication', foreignKey: 'claim_id', onDelete: 'CASCADE' });
  const AdjudicationExclusion = sequelize.define('adjudication_exclusions', {
    adjudication_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    code: { type: STRING(255), allowNull: false },
  }, options);
  Adjudication.hasMany(AdjudicationExclusion, { as: 'exclusions', foreignKey: 'adjudication_id', onDelete: 'CASCADE' });
  const AdjudicationCondition = sequelize.define('adjudication_conditions', {
    adjudication_id: { type: STRING(64), primaryKey: true },
    position: { type: INTEGER, primaryKey: true },
    text: { type: TEXT, allowNull: false },
  }, options);
  Adjudication.hasMany(AdjudicationCondition, { as: 'conditions', foreignKey: 'adjudication_id', onDelete: 'CASCADE' });

  const Payout = sequelize.define('payouts', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    claim_id: { type: STRING(64), allowNull: false },
    amount: { type: DECIMAL(15, 2), allowNull: false },
    currency: { type: STRING(3), allowNull: false },
    status: { type: STRING(16), allowNull: false },
    recipient_type: { type: STRING(16), allowNull: false },
    recipient_name: { type: STRING(255), allowNull: false },
    recipient_iban: { type: STRING(34), allowNull: false },
    recipient_bic: { type: STRING(11), allowNull: false },
    recipient_street: { type: STRING(255), allowNull: false },
    recipient_city: { type: STRING(255), allowNull: false },
    recipient_postal_code: { type: STRING(32), allowNull: false },
    recipient_country: { type: STRING(2), allowNull: false },
    recipient_vat_id: STRING(32),
    recipient_tax_id: STRING(64),
    bank_reference: STRING(64),
    purpose: STRING(32),
    estimated_arrival: DATE(3),
    created_at: { type: DATE(3), allowNull: false },
    updated_at: DATE(3),
    completed_at: DATE(3),
  }, { ...options, indexes: [{ fields: ['claim_id'] }, { fields: ['status'] }] });
  Payout.belongsTo(Claim, { foreignKey: 'claim_id' });

  const Document = sequelize.define('documents', {
    id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    entity_type: { type: STRING(16), allowNull: false },
    entity_id: { type: STRING(64), allowNull: false },
    type: { type: STRING(32), allowNull: false },
    file_name: { type: STRING(255), allowNull: false },
    mime_type: { type: STRING(64), allowNull: false },
    size: { type: INTEGER, allowNull: false },
    url: { type: STRING(512), allowNull: false },
    checksum: STRING(80),
    storage_location: STRING(32),
    retention_policy: STRING(16),
    created_at: { type: DATE(3), allowNull: false },
  }, { ...options, indexes: [{ fields: ['entity_type', 'entity_id'] }] });
  Claim.hasMany(Document, { as: 'documents', foreignKey: 'entity_id', scope: { entity_type: 'CLAIM' }, constraints: false });
  const DocumentContent = sequelize.define('document_contents', {
    document_id: { type: STRING(64), primaryKey: true },
    content: { type: BLOB('long'), allowNull: false },
  }, options);
  DocumentContent.belongsTo(Document, { foreignKey: 'document_id', constraints: false });

  const AuditLog = sequelize.define('audit_logs', {
    action_id: { type: STRING(64), primaryKey: true },
    seq: { type: BIGINT, autoIncrement: true, unique: true, allowNull: false },
    action: { type: STRING(64), allowNull: false },
    entity_type: { type: STRING(32), allowNull: false },
    entity_id: { type: STRING(64), allowNull: false },
    user_id: { type: STRING(64), allowNull: false },
    timestamp: { type: DATE(3), allowNull: false },
    metadata: DataTypes.JSON,
    ip_address: STRING(45),
    user_agent: STRING(512),
    country: STRING(16),
    gdpr_consent: BOOLEAN,
  }, { ...options, indexes: [{ fields: ['entity_type', 'entity_id'] }, { fields: ['action'] }, { fields: ['timestamp'] }] });

  const OutboxEntry = sequelize.define('outbox_entries', {
    id: { type: INTEGER, autoIncrement: true, primaryKey: true },
    payload: { type: DataTypes.JSON, allowNull: false },
    publishingStatus: {
      type: DataTypes.ENUM('pending', 'published'), allowNull: false, defaultValue: 'pending', field: 'publishing_status',
    },
  }, options);

  return {
    OutboxEntry, Business, RatingProfile, CyberRiskFactors, RatingProfileIncident, DnoRiskFactors, SuretyRiskFactors, WorkersCompRiskFactors,
    Quote, QuoteTax, QuoteAddOn, QuoteExclusion, QuoteRequirement, QuoteUnderwritingExclusion,
    Policy, PolicyTax, PolicyAddOn, PolicyExclusion, Endorsement, EndorsementChange,
    Agreement, AgreementSignatory, Invoice, InvoiceItem, InvoiceDunning, PaymentMethod, Payment, Refund, RefundMollieRefund,
    Claim, ClaimNote, Adjudication, AdjudicationExclusion, AdjudicationCondition, Payout, Document, DocumentContent, AuditLog,
  };
}

type Models = ReturnType<typeof defineModels>;

type Row = Record<string, any>;

async function replaceRows(model: ModelStatic<Model>, owner: Row, rows: Row[], transaction: Transaction): Promise<void> {
  await model.destroy({ where: owner, transaction });
  await model.bulkCreate(rows.map((row, position) => ({ ...owner, position, ...row })), { transaction });
}

function ordered(association: string, include: Includeable[] = []): Includeable {
  return { association, include, separate: true, order: [['position', 'ASC']] };
}

function plain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
  }
  return value;
}

interface Entity<T> {
  model: ModelStatic<Model>;
  include: Includeable[];
  save(item: T, id: string, transaction: Transaction): Promise<void>;
  fromRow(row: Row): T;
}

function createEntities(models: Models) {
  const ratingProfiles: Entity<RatingProfile> = {
    model: models.RatingProfile,
    include: [
      { association: 'cyber', include: [ordered('incident_history')] },
      { association: 'dno' },
      { association: 'surety' },
      { association: 'workers_comp' },
    ],
    save: async (profile, ownerId, transaction) => {
      await models.RatingProfile.upsert({
        owner_id: ownerId,
        country: profile.country,
        industry: profile.industry ?? null,
        revenue: profile.revenue ?? null,
        employee_count: profile.employee_count ?? null,
      }, { transaction });
      if (profile.cyber) {
        await models.CyberRiskFactors.upsert({
          owner_id: ownerId,
          has_mfa: profile.cyber.has_mfa ?? null,
          has_encryption: profile.cyber.has_encryption ?? null,
          cloud_provider: profile.cyber.cloud_provider ?? null,
        }, { transaction });
        await replaceRows(models.RatingProfileIncident, { owner_id: ownerId }, (profile.cyber.incident_history || []).map((incident) => ({
          date: incident.date, severity: incident.severity, description: incident.description,
        })), transaction);
      } else {
        await models.CyberRiskFactors.destroy({ where: { owner_id: ownerId }, transaction });
      }
      if (profile.dno) {
        await models.DnoRiskFactors.upsert({
          owner_id: ownerId,
          governance_score: profile.dno.governance_score ?? null,
          past_litigation: profile.dno.past_litigation ?? null,
          board_size: profile.dno.board_size ?? null,
        }, { transaction });
      } else {
        await models.DnoRiskFactors.destroy({ where: { owner_id: ownerId }, transaction });
      }
      if (profile.surety) {
        await models.SuretyRiskFactors.upsert({
          owner_id: ownerId,
          financial_strength: profile.surety.financial_strength ?? null,
          project_size: profile.surety.project_size ?? null,
          past_defaults: profile.surety.past_defaults ?? null,
        }, { transaction });
      } else {
        await models.SuretyRiskFactors.destroy({ where: { owner_id: ownerId }, transaction });
      }
      if (profile.workers_comp) {
        await models.WorkersCompRiskFactors.upsert({
          owner_id: ownerId,
          safety_training: profile.workers_comp.safety_training ?? null,
          industry_risk_level: profile.workers_comp.industry_risk_level ?? null,
          past_claims: profile.workers_comp.past_claims ?? null,
        }, { transaction });
      } else {
        await models.WorkersCompRiskFactors.destroy({ where: { owner_id: ownerId }, transaction });
      }
    },
    fromRow: (row) => ({
      country: row.country,
      industry: row.industry ?? undefined,
      revenue: row.revenue ?? undefined,
      employee_count: row.employee_count ?? undefined,
      cyber: row.cyber ? {
        has_mfa: row.cyber.has_mfa ?? undefined,
        has_encryption: row.cyber.has_encryption ?? undefined,
        cloud_provider: row.cyber.cloud_provider ?? undefined,
        incident_history: row.cyber.incident_history.length
          ? row.cyber.incident_history.map((incident: Row) => ({
            date: incident.date, severity: incident.severity, description: incident.description,
          }))
          : undefined,
      } : undefined,
      dno: row.dno ? {
        governance_score: row.dno.governance_score ?? undefined,
        past_litigation: row.dno.past_litigation ?? undefined,
        board_size: row.dno.board_size ?? undefined,
      } : undefined,
      surety: row.surety ? {
        financial_strength: row.surety.financial_strength ?? undefined,
        project_size: row.surety.project_size ?? undefined,
        past_defaults: row.surety.past_defaults ?? undefined,
      } : undefined,
      workers_comp: row.workers_comp ? {
        safety_training: row.workers_comp.safety_training ?? undefined,
        industry_risk_level: row.workers_comp.industry_risk_level ?? undefined,
        past_claims: row.workers_comp.past_claims ?? undefined,
      } : undefined,
    }),
  };

  const quotes: Entity<Quote & { recordedEvents?: object[] }> = {
    model: models.Quote,
    include: [
      ordered('taxes'),
      ordered('add_ons'),
      ordered('exclusions'),
      ordered('requirements'),
      ordered('underwriting_exclusions'),
    ],
    save: async (quote, id, transaction) => {
      if (quote.business_id) await models.Business.findOrCreate({ where: { id: quote.business_id }, transaction });
      await models.Quote.upsert({
        id,
        business_id: quote.business_id ?? null,
        policy_type: quote.policy_type ?? null,
        status: quote.status,
        premium_gross: quote.premium.gross,
        premium_net: quote.premium.net,
        currency: quote.premium.currency,
        per_claim_limit: quote.coverage.limits.per_claim,
        aggregate_limit: quote.coverage.limits.aggregate ?? null,
        deductible: quote.coverage.deductible,
        risk_score: quote.underwriting.risk_score ?? null,
        term_start: quote.term?.start_date ?? null,
        term_end: quote.term?.end_date ?? null,
        expiry_date: quote.expiry_date,
        created_at: quote.created_at,
      }, { transaction });
      await replaceRows(models.QuoteTax, { quote_id: id }, quote.premium.taxes.map((tax) => ({
        type: tax.type,
        rate: tax.rate,
        amount: tax.amount,
      })), transaction);
      await replaceRows(models.QuoteAddOn, { quote_id: id }, quote.coverage.add_ons.map((code) => ({
        code,
      })), transaction);
      await replaceRows(models.QuoteExclusion, { quote_id: id }, (quote.coverage.exclusions || []).map((code) => ({
        code,
      })), transaction);
      await replaceRows(models.QuoteRequirement, { quote_id: id }, (quote.underwriting.requirements || []).map((code) => ({
        code,
      })), transaction);
      await replaceRows(models.QuoteUnderwritingExclusion, { quote_id: id }, (quote.underwriting.exclusions || []).map((code) => ({
        code,
      })), transaction);
      await models.OutboxEntry.bulkCreate((quote.recordedEvents || []).map((payload) => ({
        payload,
        publishingStatus: 'pending',
      })), { transaction });
    },
    fromRow: (row) => ({
      id: row.id,
      status: row.status,
      premium: {
        gross: row.premium_gross,
        net: row.premium_net,
        taxes: row.taxes.map((tax: Row) => ({ type: tax.type, rate: tax.rate, amount: tax.amount })),
        currency: row.currency,
      },
      coverage: {
        limits: { per_claim: row.per_claim_limit, aggregate: row.aggregate_limit ?? undefined },
        deductible: row.deductible,
        add_ons: row.add_ons.map((addOn: Row) => addOn.code),
        exclusions: row.exclusions.map((exclusion: Row) => exclusion.code),
      },
      underwriting: {
        risk_score: row.risk_score ?? undefined,
        requirements: row.requirements.map((requirement: Row) => requirement.code),
        exclusions: row.underwriting_exclusions.map((exclusion: Row) => exclusion.code),
      },
      expiry_date: row.expiry_date,
      created_at: row.created_at,
      business_id: row.business_id ?? undefined,
      policy_type: row.policy_type ?? undefined,
      term: row.term_start ? { start_date: row.term_start, end_date: row.term_end } : undefined,
    }),
  };

  const policies: Entity<Policy> = {
    model: models.Policy,
    include: [
      ordered('taxes'),
      ordered('add_ons'),
      ordered('exclusions'),
      ordered('endorsements', [ordered('changes')]),
      { association: 'invoices', attributes: ['id', 'policy_id'], separate: true, order: [['seq', 'ASC']] },
    ],
    save: async (policy, id, transaction) => {
      await models.Business.findOrCreate({ where: { id: policy.business_id }, transaction });
      await models.Policy.upsert({
        id,
        business_id: policy.business_id,
        policy_type: policy.policy_type,
        status: policy.status,
        premium_gross: policy.premium.gross,
        premium_net: policy.premium.net,
        currency: policy.premium.currency,
        per_claim_limit: policy.coverage.limits.per_claim,
        aggregate_limit: policy.coverage.limits.aggregate ?? null,
        deductible: policy.coverage.deductible,
        term_start: policy.term.start_date,
        term_end: policy.term.end_date,
        agreement_id: policy.agreement_id ?? null,
        cancellation_reason: policy.cancellation?.reason ?? null,
        cancellation_effective_date: policy.cancellation?.effective_date ?? null,
        renewed_from: policy.renewed_from ?? null,
        created_at: policy.created_at,
        updated_at: policy.updated_at ?? null,
      }, { transaction });
      await replaceRows(models.PolicyTax, { policy_id: id }, policy.premium.taxes.map((tax) => ({
        type: tax.type,
        rate: tax.rate,
        amount: tax.amount,
      })), transaction);
      await replaceRows(models.PolicyAddOn, { policy_id: id }, policy.coverage.add_ons.map((code) => ({
        code,
      })), transaction);
      await replaceRows(models.PolicyExclusion, { policy_id: id }, (policy.coverage.exclusions || []).map((code) => ({
        code,
      })), transaction);
      const endorsements = policy.endorsements || [];
      await models.Endorsement.destroy({
        where: { policy_id: id, id: { [Op.notIn]: endorsements.map((endorsement) => endorsement.id).concat('') } },
        transaction,
      });
      for (const [position, endorsement] of endorsements.entries()) {
        await models.Endorsement.upsert({
          id: endorsement.id,
          policy_id: id,
          position,
          effective_date: endorsement.effective_date,
          status: endorsement.status,
          reason: endorsement.reason ?? null,
          agreement_id: endorsement.agreement_id ?? null,
          created_at: endorsement.created_at,
        }, { transaction });
        await replaceRows(models.EndorsementChange, { endorsement_id: endorsement.id }, endorsement.changes.map((change) => ({
          type: change.type,
          field: change.field ?? null,
          old_value: change.old_value ?? null,
          new_value: change.new_value ?? null,
          action: change.action ?? null,
          code: change.code ?? null,
        })), transaction);
      }
    },
    fromRow: (row) => ({
      id: row.id,
      business_id: row.business_id,
      policy_type: row.policy_type,
      status: row.status,
      premium: {
        gross: row.premium_gross,
        net: row.premium_net,
        taxes: row.taxes.map((tax: Row) => ({ type: tax.type, rate: tax.rate, amount: tax.amount })),
        currency: row.currency,
      },
      coverage: {
        limits: { per_claim: row.per_claim_limit, aggregate: row.aggregate_limit ?? undefined },
        deductible: row.deductible,
        add_ons: row.add_ons.map((addOn: Row) => addOn.code),
        exclusions: row.exclusions.map((exclusion: Row) => exclusion.code),
      },
      term: { start_date: row.term_start, end_date: row.term_end },
      agreement_id: row.agreement_id ?? undefined,
      invoices: row.invoices.map((invoice: Row) => invoice.id),
      endorsements: row.endorsements.map((endorsement: Row) => ({
        id: endorsement.id,
        policy_id: endorsement.policy_id,
        changes: endorsement.changes.map((change: Row) => ({
          type: change.type,
          field: change.field ?? undefined,
          old_value: change.old_value ?? undefined,
          new_value: change.new_value ?? undefined,
          action: change.action ?? undefined,
          code: change.code ?? undefined,
        })),
        effective_date: endorsement.effective_date,
        status: endorsement.status,
        reason: endorsement.reason ?? undefined,
        agreement_id: endorsement.agreement_id ?? undefined,
        created_at: endorsement.created_at,
      })),
      cancellation: row.cancellation_reason
        ? { reason: row.cancellation_reason, effective_date: row.cancellation_effective_date }
        : undefined,
      renewed_from: row.renewed_from ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at ?? undefined,
    }),
  };

  const agreements: Entity<Agreement> = {
    model: models.Agreement,
    include: [ordered('signatories')],
    save: async (agreement, id, transaction) => {
      await models.Agreement.upsert({
        id,
        policy_id: agreement.policy_id ?? null,
        endorsement_id: agreement.endorsement_id ?? null,
        envelope_id: agreement.envelope_id ?? null,
        status: agreement.status,
        document_url: agreement.document_url,
        template_version: agreement.template_version,
        created_at: agreement.created_at,
        signed_at: agreement.signed_at ?? null,
      }, { transaction });
      await replaceRows(models.AgreementSignatory, { agreement_id: id }, agreement.signatories.map((signatory) => ({
        recipient_id: signatory.recipient_id ?? null,
        role: signatory.role,
        email: signatory.email,
        name: signatory.name ?? null,
        status: signatory.status,
        signed_at: signatory.signed_at ?? null,
      })), transaction);
    },
    fromRow: (row) => ({
      id: row.id,
      policy_id: row.policy_id ?? undefined,
      endorsement_id: row.endorsement_id ?? undefined,
      envelope_id: row.envelope_id ?? undefined,
      status: row.status,
      document_url: row.document_url,
      template_version: row.template_version,
      signatories: row.signatories.map((signatory: Row) => ({
        recipient_id: signatory.recipient_id ?? undefined,
        role: signatory.role,
        email: signatory.email,
        name: signatory.name ?? undefined,
        status: signatory.status,
        signed_at: signatory.signed_at,
      })),
      created_at: row.created_at,
      signed_at: row.signed_at ?? undefined,
    }),
  };

  const invoices: Entity<Invoice> = {
    model: models.Invoice,
    include: [ordered('items')],
    save: async (invoice, id, transaction) => {
      await models.Invoice.upsert({
        id,
        policy_id: invoice.policy_id,
        status: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
        due_date: invoice.due_date,
        paid_at: invoice.paid_at ?? null,
        billing_street: invoice.billing_address.street,
        billing_city: invoice.billing_address.city,
        billing_postal_code: invoice.billing_address.postal_code,
        billing_country: invoice.billing_address.country,
        billing_vat_id: invoice.billing_address.vat_id ?? null,
        pdf_url: invoice.pdf_url ?? null,
        payment_link: invoice.payment_link ?? null,
        created_at: invoice.created_at,
        updated_at: invoice.updated_at ?? null,
      }, { transaction });
      await replaceRows(models.InvoiceItem, { invoice_id: id }, invoice.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        tax_rate: item.tax_rate,
      })), transaction);
    },
    fromRow: (row) => ({
      id: row.id,
      policy_id: row.policy_id,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      due_date: row.due_date,
      paid_at: row.paid_at,
      items: row.items.map((item: Row) => ({ description: item.description, amount: item.amount, tax_rate: item.tax_rate })),
      billing_address: {
        street: row.billing_street,
        city: row.billing_city,
        postal_code: row.billing_postal_code,
        country: row.billing_country,
        vat_id: row.billing_vat_id ?? undefined,
      },
      pdf_url: row.pdf_url ?? undefined,
      payment_link: row.payment_link ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at ?? undefined,
    }),
  };

  const dunning: Entity<{ level: number; last_sent_at: string }> = {
    model: models.InvoiceDunning,
    include: [],
    save: async (state, invoiceId, transaction) => {
      await models.InvoiceDunning.upsert({ invoice_id: invoiceId, level: state.level, last_sent_at: state.last_sent_at }, { transaction });
    },
    fromRow: (row) => ({ level: row.level, last_sent_at: row.last_sent_at }),
  };

  const paymentMethods: Entity<PaymentMethod> = {
    model: models.PaymentMethod,
    include: [{ association: 'business', attributes: ['mollie_customer_id'] }],
    save: async (method, id, transaction) => {
      await models.Business.findOrCreate({ where: { id: method.business_id }, transaction });
      await models.PaymentMethod.upsert({
        id,
        business_id: method.business_id,
        type: method.type,
        holder_name: method.details.holder_name,
        masked_iban: method.details.masked_iban ?? null,
        masked_card: method.details.masked_card ?? null,
        card_brand: method.details.card_brand ?? null,
        status: method.status,
        checkout_url: method.checkout_url ?? null,
        mollie_mandate_id: method.mollie_mandate_id ?? null,
        mollie_payment_id: method.mollie_payment_id ?? null,
        is_default: method.is_default,
        created_at: method.created_at,
      }, { transaction });
    },
    fromRow: (row) => ({
      id: row.id,
      business_id: row.business_id,
      type: row.type,
      details: {
        holder_name: row.holder_name,
        masked_iban: row.masked_iban ?? undefined,
        masked_card: row.masked_card ?? undefined,
        card_brand: row.card_brand ?? undefined,
      },
      status: row.status,
      checkout_url: row.checkout_url ?? undefined,
      mollie_customer_id: row.business.mollie_customer_id,
      mollie_mandate_id: row.mollie_mandate_id ?? undefined,
      mollie_payment_id: row.mollie_payment_id ?? undefined,
      is_default: row.is_default,
      created_at: row.created_at,
    }),
  };

  const payments: Entity<Payment> = {
    model: models.Payment,
    include: [],
    save: async (payment, id, transaction) => {
      await models.Payment.upsert({
        id,
        invoice_id: payment.invoice_id,
        payment_method_id: payment.payment_method_id ?? null,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        gateway: payment.gateway,
        gateway_transaction_id: payment.gateway_transaction_id ?? null,
        receipt_url: payment.receipt_url ?? null,
        created_at: payment.created_at,
        completed_at: payment.completed_at ?? null,
      }, { transaction });
    },
    fromRow: (row) => ({
      id: row.id,
      invoice_id: row.invoice_id,
      payment_method_id: row.payment_method_id ?? undefined,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      gateway: row.gateway,
      gateway_transaction_id: row.gateway_transaction_id ?? undefined,
      receipt_url: row.receipt_url ?? undefined,
      created_at: row.created_at,
      completed_at: row.completed_at,
    }),
  };

  const refunds: Entity<Refund> = {
    model: models.Refund,
    include: [ordered('mollie_refunds')],
    save: async (refund, id, transaction) => {
      await models.Refund.upsert({
        id,
        invoice_id: refund.invoice_id,
        amount: refund.amount,
        currency: refund.currency,
        reason: refund.reason,
        status: refund.status,
        payment_method_id: refund.payment_method_id ?? null,
        created_at: refund.created_at,
        completed_at: refund.completed_at ?? null,
      }, { transaction });
      await replaceRows(models.RefundMollieRefund, { refund_id: id }, refund.mollie_refunds.map((mollieRefund) => ({
        mollie_refund_id: mollieRefund.id,
        mollie_payment_id: mollieRefund.payment_id,
        amount: mollieRefund.amount,
        status: mollieRefund.status,
      })), transaction);
    },
    fromRow: (row) => ({
      id: row.id,
      invoice_id: row.invoice_id,
      amount: row.amount,
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      payment_method_id: row.payment_method_id ?? undefined,
      mollie_refunds: row.mollie_refunds.map((mollieRefund: Row) => ({
        id: mollieRefund.mollie_refund_id,
        payment_id: mollieRefund.mollie_payment_id,
        amount: mollieRefund.amount,
        status: mollieRefund.status,
      })),
      created_at: row.created_at,
      completed_at: row.completed_at,
    }),
  };

  const documents: Entity<Document> = {
    model: models.Document,
    include: [],
    save: async (document, id, transaction) => {
      await models.Document.upsert({
        id,
        entity_type: document.entity_type,
        entity_id: document.entity_id,
        type: document.type,
        file_name: document.file_name,
        mime_type: document.mime_type,
        size: document.size,
        url: document.url,
        checksum: document.checksum ?? null,
        storage_location: document.storage_location ?? null,
        retention_policy: document.retention_policy ?? null,
        created_at: document.created_at,
      }, { transaction });
    },
    fromRow: (row) => ({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      type: row.type,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size: row.size,
      url: row.url,
      checksum: row.checksum ?? undefined,
      storage_location: row.storage_location ?? undefined,
      retention_policy: row.retention_policy ?? undefined,
      created_at: row.created_at,
    }),
  };

  const claims: Entity<Claim> = {
    model: models.Claim,
    include: [
      ordered('notes'),
      {
        association: 'adjudication',
        include: [
          ordered('exclusions'),
          ordered('conditions'),
        ],
      },
      { association: 'documents', separate: true, order: [['seq', 'ASC']] },
    ],
    save: async (claim, id, transaction) => {
      const { claimant, incident, adjudication } = claim;
      await models.Claim.upsert({
        id,
        policy_id: claim.policy_id,
        claim_number: claim.claim_number ?? null,
        status: claim.status,
        assigned_adjuster: claim.assigned_adjuster ?? null,
        estimated_loss: claim.estimated_loss ?? null,
        actual_loss: claim.actual_loss ?? null,
        claimant_type: claimant.type,
        claimant_business_id: claimant.business_id ?? null,
        claimant_employee_id: claimant.employee_id ?? null,
        contact_name: claimant.contact.name,
        contact_email: claimant.contact.email,
        contact_phone: claimant.contact.phone ?? null,
        contact_street: claimant.contact.address?.street ?? null,
        contact_city: claimant.contact.address?.city ?? null,
        contact_postal_code: claimant.contact.address?.postal_code ?? null,
        contact_country: claimant.contact.address?.country ?? null,
        contact_vat_id: claimant.contact.address?.vat_id ?? null,
        incident_type: incident.type,
        incident_date: incident.date,
        incident_description: incident.description,
        incident_location: incident.location ?? null,
        incident_estimated_loss: incident.estimated_loss ?? null,
        incident_actual_loss: incident.actual_loss ?? null,
        created_at: claim.created_at,
        updated_at: claim.updated_at ?? null,
        closed_at: claim.closed_at ?? null,
      }, { transaction });
      await replaceRows(models.ClaimNote, { claim_id: id }, (claim.notes || []).map((note) => ({
        content: note.content,
        created_at: note.created_at,
        author: note.author,
        is_internal: note.is_internal ?? null,
      })), transaction);
      await models.Adjudication.destroy({
        where: { claim_id: id, id: { [Op.ne]: adjudication?.id ?? '' } },
        transaction,
      });
      if (adjudication) {
        await models.Adjudication.upsert({
          id: adjudication.id,
          claim_id: id,
          decision: adjudication.decision,
          payout_amount: adjudication.payout_amount ?? null,
          currency: adjudication.currency ?? null,
          deductible_applied: adjudication.deductible_applied ?? null,
          reason: adjudication.reason,
          adjudicator_id: adjudication.adjudicator_id,
          timestamp: adjudication.timestamp,
        }, { transaction });
        await replaceRows(models.AdjudicationExclusion, { adjudication_id: adjudication.id }, (adjudication.exclusions || []).map((code) => ({
          code,
        })), transaction);
        await replaceRows(models.AdjudicationCondition, { adjudication_id: adjudication.id }, (adjudication.conditions || []).map((text) => ({
          text,
        })), transaction);
      }
    },
    fromRow: (row) => ({
      id: row.id,
      policy_id: row.policy_id,
      claim_number: row.claim_number ?? undefined,
      claimant: {
        type: row.claimant_type,
        business_id: row.claimant_business_id ?? undefined,
        employee_id: row.claimant_employee_id ?? undefined,
        contact: {
          name: row.contact_name,
          email: row.contact_email,
          phone: row.contact_phone ?? undefined,
          address: row.contact_street === null ? undefined : {
            street: row.contact_street,
            city: row.contact_city,
            postal_code: row.contact_postal_code,
            country: row.contact_country,
            vat_id: row.contact_vat_id ?? undefined,
          },
        },
      },
      incident: {
        type: row.incident_type,
        date: row.incident_date,
        description: row.incident_description,
        location: row.incident_location ?? undefined,
        estimated_loss: row.incident_estimated_loss ?? undefined,
        actual_loss: row.incident_actual_loss ?? undefined,
      },
      status: row.status,
      assigned_adjuster: row.assigned_adjuster,
      estimated_loss: row.estimated_loss ?? undefined,
      actual_loss: row.actual_loss,
      documents: row.documents.map(documents.fromRow),
      notes: row.notes.map((note: Row) => ({
        content: note.content,
        created_at: note.created_at,
        author: note.author,
        is_internal: note.is_internal ?? undefined,
      })),
      adjudication: row.adjudication ? {
        id: row.adjudication.id,
        claim_id: row.adjudication.claim_id,
        decision: row.adjudication.decision,
        payout_amount: row.adjudication.payout_amount,
        currency: row.adjudication.currency ?? undefined,
        deductible_applied: row.adjudication.deductible_applied,
        reason: row.adjudication.reason,
        exclusions: row.adjudication.exclusions.length ? row.adjudication.exclusions.map((exclusion: Row) => exclusion.code) : undefined,
        conditions: row.adjudication.conditions.length ? row.adjudication.conditions.map((condition: Row) => condition.text) : undefined,
        adjudicator_id: row.adjudication.adjudicator_id,
        timestamp: row.adjudication.timestamp,
      } : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at ?? undefined,
      closed_at: row.closed_at,
    }),
  };

  const payouts: Entity<Payout> = {
    model: models.Payout,
    include: [],
    save: async (payout, id, transaction) => {
      const { recipient } = payout;
      await models.Payout.upsert({
        id,
        claim_id: payout.claim_id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        recipient_type: recipient.type,
        recipient_name: recipient.name,
        recipient_iban: recipient.iban,
        recipient_bic: recipient.bic,
        recipient_street: recipient.address.street,
        recipient_city: recipient.address.city,
        recipient_postal_code: recipient.address.postal_code,
        recipient_country: recipient.address.country,
        recipient_vat_id: recipient.address.vat_id ?? null,
        recipient_tax_id: recipient.tax_id ?? null,
        bank_reference: payout.bank_reference ?? null,
        purpose: payout.purpose ?? null,
        estimated_arrival: payout.estimated_arrival ?? null,
        created_at: payout.created_at,
        updated_at: payout.updated_at ?? null,
        completed_at: payout.completed_at ?? null,
      }, { transaction });
    },
    fromRow: (row) => ({
      id: row.id,
      claim_id: row.claim_id,
      amount: row.amount,
      currency: row.currency,
      recipient: {
        type: row.recipient_type,
        name: row.recipient_name,
        iban: row.recipient_iban,
        bic: row.recipient_bic,
        address: {
          street: row.recipient_street,
          city: row.recipient_city,
          postal_code: row.recipient_postal_code,
          country: row.recipient_country,
          vat_id: row.recipient_vat_id ?? undefined,
        },
        tax_id: row.recipient_tax_id ?? undefined,
      },
      status: row.status,
      bank_reference: row.bank_reference ?? undefined,
      purpose: row.purpose ?? undefined,
      estimated_arrival: row.estimated_arrival ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at ?? undefined,
      completed_at: row.completed_at,
    }),
  };

  const outboxEntries: Entity<{ id: number; payload: object; publishingStatus: 'pending' | 'published' }> = {
    model: models.OutboxEntry,
    include: [],
    save: async (entry, id, transaction) => {
      await models.OutboxEntry.upsert({
        id: Number(id), payload: entry.payload, publishingStatus: entry.publishingStatus,
      }, { transaction });
    },
    fromRow: (row) => ({ id: row.id, payload: row.payload, publishingStatus: row.publishingStatus }),
  };

  const auditLogs: Entity<AuditLogEntry> = {
    model: models.AuditLog,
    include: [],
    save: async (entry, id, transaction) => {
      await models.AuditLog.upsert({
        action_id: id,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        user_id: entry.user_id,
        timestamp: entry.timestamp,
        metadata: entry.metadata ?? null,
        ip_address: entry.ip_address ?? null,
        user_agent: entry.user_agent ?? null,
        country: entry.country ?? null,
        gdpr_consent: entry.gdpr_consent ?? null,
      }, { transaction });
    },
    fromRow: (row) => ({
      action_id: row.action_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      user_id: row.user_id,
      timestamp: row.timestamp,
      metadata: row.metadata ?? undefined,
      ip_address: row.ip_address ?? undefined,
      user_agent: row.user_agent ?? undefined,
      country: row.country ?? undefined,
      gdpr_consent: row.gdpr_consent ?? undefined,
    }),
  };

  return {
    rating_profiles: ratingProfiles,
    quotes,
    policies,
    agreements,
    invoices,
    dunning,
    payment_methods: paymentMethods,
    payments,
    refunds,
    claims,
    payouts,
    documents,
    audit_logs: auditLogs,
    outbox_entries: outboxEntries,
  };
}

export class MySqlBackend implements StorageBackend {
  private readonly models: Models;
  private readonly entities: Record<Exclude<Collection, 'mollie_customers'>, Entity<unknown>>;

  constructor(private readonly sequelize: Sequelize) {
    this.models = defineModels(sequelize);
    this.entities = createEntities(this.models);
  }

  static fromUrl(url: string): MySqlBackend {
    return new MySqlBackend(new Sequelize(url, {
      dialect: 'mysql', logging: false, timezone: '+00:00', dialectOptions: { decimalNumbers: true },
    }));
  }

  async init(): Promise<void> {
    await this.sequelize.sync();
  }

  async put(collection: Collection, id: string, value: unknown): Promise<void> {
    if (collection === 'mollie_customers') {
      await this.models.Business.upsert({ id, mollie_customer_id: (value as { customer_id: string }).customer_id });
      return;
    }
    const entity = this.entities[collection];
    await this.sequelize.transaction((transaction) => entity.save(value, id, transaction));
  }

  async get<T>(collection: Collection, id: string): Promise<T | undefined> {
    if (collection === 'mollie_customers') {
      const customerId = (await this.models.Business.findByPk(id))?.get('mollie_customer_id');
      return customerId ? { customer_id: customerId } as T : undefined;
    }
    const { model, include, fromRow } = this.entities[collection];
    const row = await model.findByPk(id, { include });
    return row ? fromRow(plain(row.get({ plain: true })) as Row) as T : undefined;
  }

  async list<T>(collection: Collection): Promise<T[]> {
    if (collection === 'mollie_customers') {
      const businesses = await this.models.Business.findAll({ where: { mollie_customer_id: { [Op.ne]: null } } });
      return businesses.map((business) => ({ customer_id: business.get('mollie_customer_id') }) as T);
    }
    const { model, include, fromRow } = this.entities[collection];
    const rows = await model.findAll({
      include,
      order: [['seq' in model.getAttributes() ? 'seq' : model.primaryKeyAttribute, 'ASC']],
    });
    return rows.map((row) => fromRow(plain(row.get({ plain: true })) as Row) as T);
  }

  async remove(collection: Collection, id: string): Promise<void> {
    if (collection === 'mollie_customers') {
      await this.models.Business.update({ mollie_customer_id: null }, { where: { id } });
      return;
    }
    const { model } = this.entities[collection];
    await model.destroy({ where: { [model.primaryKeyAttribute]: id } });
  }

  async putContent(id: string, content: Buffer): Promise<void> {
    await this.models.DocumentContent.upsert({ document_id: id, content });
  }

  async getContent(id: string): Promise<Buffer | undefined> {
    return (await this.models.DocumentContent.findByPk(id))?.get('content') as Buffer | undefined;
  }

  async removeContent(id: string): Promise<void> {
    await this.models.DocumentContent.destroy({ where: { document_id: id } });
  }

  async clear(): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
      for (const model of Object.values(this.sequelize.models)) {
        await model.destroy({ where: {}, transaction });
      }
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
    });
  }

  async close(): Promise<void> {
    await this.sequelize.close();
  }
}
