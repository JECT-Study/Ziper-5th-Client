import { failure, type Result } from '@ziper/bridge/contract';

type Entry = { fingerprint: string; promise: Promise<Result<unknown>>; settledAt: number | null };

// Per-screen, non-auth results only. Pending entries are never evicted/re-executed.
export class OperationLedger {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly limit = 64,
    private readonly ttl = 120_000,
    private readonly now = Date.now,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || ttl <= 0) throw new Error('Invalid ledger bounds');
  }

  get size() {
    return this.entries.size;
  }

  run<T>(id: string, fingerprint: string, action: () => Promise<Result<T>>): Promise<Result<T>> {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.settledAt !== null && now - entry.settledAt >= this.ttl) this.entries.delete(key);
    }
    const existing = this.entries.get(id);
    if (existing)
      return existing.fingerprint === fingerprint
        ? (existing.promise as Promise<Result<T>>)
        : Promise.resolve(failure('INVALID_REQUEST'));
    if (this.entries.size >= this.limit) {
      const oldest = [...this.entries].find(([, entry]) => entry.settledAt !== null);
      if (!oldest) return Promise.resolve(failure('PERMISSION_DENIED'));
      this.entries.delete(oldest[0]);
    }
    const entry: Entry = {
      fingerprint,
      settledAt: null,
      promise: Promise.resolve(failure('INTERNAL')),
    };
    this.entries.set(id, entry);
    entry.promise = Promise.resolve()
      .then(action)
      .catch(() => failure('INTERNAL'))
      .then((result) => {
        entry.settledAt = this.now();
        return result;
      });
    return entry.promise as Promise<Result<T>>;
  }

  clear() {
    this.entries.clear();
  }
}
