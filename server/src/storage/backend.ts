export const COLLECTIONS = [
  'quotes',
  'policies',
  'agreements',
  'invoices',
  'payments',
  'payment_methods',
  'refunds',
  'claims',
  'payouts',
  'documents',
  'dunning',
  'rating_profiles',
  'mollie_customers',
  'audit_logs',
  'outbox_entries',
] as const;

export type Collection = typeof COLLECTIONS[number];

export interface StorageBackend {
  init(): Promise<void>;
  put(collection: Collection, id: string, value: unknown): Promise<void>;
  get<T>(collection: Collection, id: string): Promise<T | undefined>;
  list<T>(collection: Collection): Promise<T[]>;
  remove(collection: Collection, id: string): Promise<void>;
  putContent(id: string, content: Buffer): Promise<void>;
  getContent(id: string): Promise<Buffer | undefined>;
  removeContent(id: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
