import { Collection, StorageBackend } from './backend';

export class MemoryBackend implements StorageBackend {
  private tables = new Map<Collection, Map<string, unknown>>();
  private contents = new Map<string, Buffer>();

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
    this.table(collection).set(id, structuredClone(value));
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
