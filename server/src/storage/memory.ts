import { Collection, StorageBackend } from './backend';

export class MemoryBackend implements StorageBackend {
  private tables = new Map<Collection, Map<string, unknown>>();
  private contents = new Map<string, Buffer>();
  private outboxEntryId = 0;

  private table(collection: Collection): Map<string, unknown> {
    let table = this.tables.get(collection);
    if (!table) {
      table = new Map();
      this.tables.set(collection, table);
    }
    return table;
  }

  async init(): Promise<void> {}

  async put(collection: Collection, id: string, value: unknown): Promise<void> {
    if (collection !== 'quotes' || typeof value !== 'object' || value === null || !('recordedEvents' in value)) {
      this.table(collection).set(id, structuredClone(value));
      return;
    }
    const { recordedEvents, ...quote } = value;
    if (!Array.isArray(recordedEvents)) throw new TypeError('recordedEvents must be a list of events');
    const payloads = recordedEvents.map((event) => JSON.parse(JSON.stringify(event)));
    this.table('quotes').set(id, structuredClone(quote));
    payloads.forEach((payload, index) => {
      const entryId = this.outboxEntryId + index + 1;
      this.table('outbox_entries').set(String(entryId), { id: entryId, payload, publishingStatus: 'pending' });
    });
    this.outboxEntryId += payloads.length;
  }

  async get<T>(collection: Collection, id: string): Promise<T | undefined> {
    const value = this.table(collection).get(id);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  async list<T>(collection: Collection): Promise<T[]> {
    return [...this.table(collection).values()].map((value) => structuredClone(value) as T);
  }

  async remove(collection: Collection, id: string): Promise<void> {
    this.table(collection).delete(id);
  }

  async putContent(id: string, content: Buffer): Promise<void> {
    this.contents.set(id, Buffer.from(content));
  }

  async getContent(id: string): Promise<Buffer | undefined> {
    return this.contents.get(id);
  }

  async removeContent(id: string): Promise<void> {
    this.contents.delete(id);
  }

  async clear(): Promise<void> {
    this.tables.clear();
    this.contents.clear();
  }

  async close(): Promise<void> {}
}
