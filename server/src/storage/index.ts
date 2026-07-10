import {
  AuditLogEntry,
  Quote,
  Policy,
  Agreement,
  Invoice,
  Payment,
  PaymentMethod,
  Claim,
  Payout,
  Document,
  Refund,
  RatingProfile,
} from '../types';
import { generateId } from '../utils/idGenerator';
import { Collection, StorageBackend } from './backend';
import { MemoryBackend } from './memory';
import { MySqlBackend } from './mysql';

export function createBackend(env: NodeJS.ProcessEnv = process.env): StorageBackend {
  const driver = env.STORAGE || 'memory';
  if (driver === 'memory') return new MemoryBackend();
  if (driver === 'mysql') {
    if (!env.DATABASE_URL) throw new Error('STORAGE=mysql requires DATABASE_URL');
    return MySqlBackend.fromUrl(env.DATABASE_URL);
  }
  throw new Error(`Unknown STORAGE "${driver}"; use "memory" or "mysql"`);
}

let backend: StorageBackend = createBackend();

export function useBackend(next: StorageBackend): void {
  backend = next;
}

function collection<T extends { id: string }>(name: Collection) {
  return {
    create: async (item: T): Promise<T> => {
      await backend.put(name, item.id, item);
      return item;
    },
    get: (id: string): Promise<T | undefined> => backend.get<T>(name, id),
    list: (): Promise<T[]> => backend.list<T>(name),
    update: async (id: string, data: Partial<T>): Promise<T | null> => {
      const current = await backend.get<T>(name, id);
      if (!current) return null;
      const updated = { ...current, ...data };
      await backend.put(name, id, updated);
      return updated;
    },
    remove: async (id: string): Promise<T | null> => {
      const current = await backend.get<T>(name, id);
      if (!current) return null;
      await backend.remove(name, id);
      return current;
    },
  };
}

const quotes = collection<Quote>('quotes');
const policies = collection<Policy>('policies');
const agreements = collection<Agreement>('agreements');
const invoices = collection<Invoice>('invoices');
const payments = collection<Payment>('payments');
const paymentMethods = collection<PaymentMethod>('payment_methods');
const claims = collection<Claim>('claims');
const payouts = collection<Payout>('payouts');
const documents = collection<Document>('documents');
const refunds = collection<Refund>('refunds');

export const storage = {
  init: () => backend.init(),
  close: () => backend.close(),

  createQuote: quotes.create,
  getQuote: quotes.get,
  listQuotes: quotes.list,
  updateQuote: quotes.update,

  createPolicy: policies.create,
  getPolicy: policies.get,
  listPolicies: policies.list,
  updatePolicy: policies.update,

  createAgreement: agreements.create,
  getAgreement: agreements.get,
  listAgreements: agreements.list,
  updateAgreement: agreements.update,

  createInvoice: invoices.create,
  getInvoice: invoices.get,
  listInvoices: invoices.list,
  updateInvoice: invoices.update,

  createPayment: payments.create,
  getPayment: payments.get,
  listPayments: payments.list,
  updatePayment: payments.update,

  createRefund: refunds.create,
  listRefunds: refunds.list,
  updateRefund: refunds.update,

  createPaymentMethod: paymentMethods.create,
  getPaymentMethod: paymentMethods.get,
  listPaymentMethods: paymentMethods.list,
  updatePaymentMethod: paymentMethods.update,

  createClaim: claims.create,
  getClaim: claims.get,
  listClaims: claims.list,
  updateClaim: claims.update,

  createPayout: payouts.create,
  getPayout: payouts.get,
  listPayouts: payouts.list,
  updatePayout: payouts.update,

  createDocument: async (doc: Document, content?: Buffer): Promise<Document> => {
    if (content) await backend.putContent(doc.id, content);
    return documents.create(doc);
  },
  getDocument: documents.get,
  listDocuments: documents.list,
  getDocumentContent: (id: string): Promise<Buffer | undefined> => backend.getContent(id),
  deleteDocument: async (id: string): Promise<Document | null> => {
    await backend.removeContent(id);
    return documents.remove(id);
  },

  getDunning: async (invoiceId: string) =>
    (await backend.get<{ level: number; last_sent_at: string }>('dunning', invoiceId)),
  setDunning: async (invoiceId: string, state: { level: number; last_sent_at: string }) => {
    await backend.put('dunning', invoiceId, state);
    return state;
  },

  getRatingProfile: (id: string): Promise<RatingProfile | undefined> => backend.get<RatingProfile>('rating_profiles', id),
  setRatingProfile: async (id: string, profile: RatingProfile): Promise<RatingProfile> => {
    await backend.put('rating_profiles', id, profile);
    return profile;
  },

  getMollieCustomerId: async (businessId: string): Promise<string | undefined> =>
    (await backend.get<{ customer_id: string }>('mollie_customers', businessId))?.customer_id,
  setMollieCustomerId: (businessId: string, customerId: string): Promise<void> =>
    backend.put('mollie_customers', businessId, { customer_id: customerId }),

  createAuditLog: async (log: AuditLogEntry): Promise<AuditLogEntry> => {
    const entry: AuditLogEntry = { ...log, action_id: generateId('audit') };
    await backend.put('audit_logs', entry.action_id!, entry);
    return entry;
  },
  getAuditLog: (id: string): Promise<AuditLogEntry | undefined> => backend.get<AuditLogEntry>('audit_logs', id),
  listAuditLogs: (): Promise<AuditLogEntry[]> => backend.list<AuditLogEntry>('audit_logs'),

  clear: () => backend.clear(),
};

export default storage;
