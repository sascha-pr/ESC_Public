/**
 * Merkt sich serverseitig die Werte vor einem „War heute da“, damit „Rückgängig“ nicht dem Client vertrauen muss.
 */
export interface UndoEntry {
  /** Tag (YYYY-MM-DD), an dem „War heute da“ getippt wurde – Rückgängig geht nur am selben Tag. */
  day: string;
  prevCount: number;
  prevLast: string | null;
  prevFirst: string | null;
}

export interface UndoStore {
  get(kidId: string): Promise<UndoEntry | null>;
  put(kidId: string, entry: UndoEntry): Promise<void>;
  delete(kidId: string): Promise<void>;
}

/** Workers KV; Einträge verfallen nach 24 h von selbst. */
export class KvUndoStore implements UndoStore {
  constructor(private readonly kv: KVNamespace) {}

  get(kidId: string): Promise<UndoEntry | null> {
    return this.kv.get<UndoEntry>(`undo:${kidId}`, "json");
  }
  put(kidId: string, entry: UndoEntry): Promise<void> {
    return this.kv.put(`undo:${kidId}`, JSON.stringify(entry), { expirationTtl: 86_400 });
  }
  delete(kidId: string): Promise<void> {
    return this.kv.delete(`undo:${kidId}`);
  }
}

export class MemoryUndoStore implements UndoStore {
  readonly entries = new Map<string, UndoEntry>();
  async get(kidId: string) {
    return this.entries.get(kidId) ?? null;
  }
  async put(kidId: string, entry: UndoEntry) {
    this.entries.set(kidId, entry);
  }
  async delete(kidId: string) {
    this.entries.delete(kidId);
  }
}
