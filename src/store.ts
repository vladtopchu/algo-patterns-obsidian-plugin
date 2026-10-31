import { Database, emptyDatabase, validateDatabase } from "./core";
export interface StoragePort {
  read(): Promise<string | null>;
  create(text: string): Promise<void>;
  replace(expected: string, next: string): Promise<void>;
}
export class Store {
  db = emptyDatabase();
  private raw = "";
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private port: StoragePort) {}
  async load() {
    const raw = await this.port.read();
    if (raw === null) {
      const db = emptyDatabase();
      const text = JSON.stringify(db, null, 2);
      await this.port.create(text);
      this.db = db;
      this.raw = text;
    } else {
      const db = validateDatabase(JSON.parse(raw));
      this.db = db;
      this.raw = raw;
    }
  }
  change(mutator: (draft: Database) => void): Promise<void> {
    return this.exclusive(async () => {
      const draft = structuredClone(this.db);
      mutator(draft);
      draft.revision = this.db.revision + 1;
      validateDatabase(draft);
      const next = JSON.stringify(draft, null, 2);
      await this.port.replace(this.raw, next);
      this.raw = next;
      this.db = draft;
    });
  }
  // Folder moves and other disk operations share the same queue as writes.
  exclusive<T>(action: () => Promise<T>): Promise<T> {
    const operation = this.queue.then(action);
    this.queue = operation.catch(() => {});
    return operation;
  }
  async reload() {
    await this.exclusive(() => this.load());
  }
}
