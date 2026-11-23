import type { WorkspaceSnapshot } from "./workspace-backup";
export type CloudVersion = { revision: number; snapshot: WorkspaceSnapshot };
export type SyncState =
  "loading" | "saved" | "pending" | "saving" | "offline" | "error" | "conflict" | "local";
export type SyncBackend = {
  read(): Promise<CloudVersion>;
  save(snapshot: WorkspaceSnapshot, revision: number): Promise<number>;
};
export type SyncStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
export function fingerprint(s: WorkspaceSnapshot) {
  return JSON.stringify([
    [...s.clients]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((c) => [c.slug, c.name, c.model, c.googleId ?? "", c.metaId ?? ""]),
    Object.entries(s.goals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, g]) => [
        name,
        g.business,
        g.marketing,
        g.kpis.map((k) => [k.id, k.metric, k.target, k.periodDays, k.channel]),
      ]),
    [...s.tasks]
      .sort((a, b) =>
        (a.clientName + ":" + a.sourceKey).localeCompare(b.clientName + ":" + b.sourceKey),
      )
      .map((t) => [
        t.clientName,
        t.sourceKey,
        t.title,
        t.action,
        t.source,
        t.recipient,
        t.impact,
        t.priority,
        t.owner,
        t.status,
      ]),
  ]);
}
/** One owner, one serialized writer; failed snapshots survive reload in that owner's outbox. */
export class AutoSync {
  private revision = 0;
  private latest: WorkspaceSnapshot | null = null;
  private confirmed = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private starting = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private stopped = false;
  private blocked = false;
  private ready = false;
  private generation = 0;
  readonly outboxKey: string;
  readonly cacheKey: string;
  constructor(
    private owner: string,
    private backend: SyncBackend,
    private storage: SyncStorage,
    private report: (state: SyncState) => void,
    private apply: (s: WorkspaceSnapshot) => void,
  ) {
    this.outboxKey = "avqix-outbox-v1:" + owner;
    this.cacheKey = "avqix-cache-v1:" + owner;
  }
  private scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(
      () => {
        void this.retry();
      },
      Math.min(30000, 3000 * 2 ** this.retryAttempt++),
    );
  }
  private persist() {
    this.storage.setItem(
      this.outboxKey,
      JSON.stringify({ revision: this.revision, snapshot: this.latest }),
    );
  }
  async start() {
    if (this.stopped || this.starting) return;
    this.starting = true;
    clearTimeout(this.retryTimer);
    this.blocked = true;
    clearTimeout(this.timer);
    this.report("loading");
    try {
      const remote = await this.backend.read();
      if (this.stopped) return;
      const raw = this.storage.getItem(this.outboxKey);
      const pending: CloudVersion | null = raw ? JSON.parse(raw) : null;
      this.blocked = false;
      this.revision = remote.revision;
      this.confirmed = fingerprint(remote.snapshot);
      this.storage.setItem(this.cacheKey, JSON.stringify(remote));
      if (pending && fingerprint(pending.snapshot) !== this.confirmed) {
        this.latest = pending.snapshot;
        this.apply(pending.snapshot);
        this.ready = true;
        if (pending.revision !== remote.revision) {
          this.blocked = true;
          this.report("conflict");
          return;
        }
        this.persist();
        this.report("pending");
        await this.flush();
      } else {
        this.storage.removeItem(this.outboxKey);
        this.latest = remote.snapshot;
        this.apply(remote.snapshot);
        this.ready = true;
        this.report("saved");
      }
    } catch {
      if (this.stopped) return;
      // Only owner-scoped data may be used offline, never another account's legacy workspace.
      try {
        const raw = this.storage.getItem(this.outboxKey) ?? this.storage.getItem(this.cacheKey);
        if (raw) {
          const cached: CloudVersion = JSON.parse(raw);
          this.revision = cached.revision;
          this.latest = cached.snapshot;
          this.apply(cached.snapshot);
          this.ready = true;
          // The remote revision must be checked before replaying an offline-start cache.
          this.blocked = true;
        }
      } catch {
        /* keep workspace gated if local data is unreadable */
      }
      this.report("offline");
      this.scheduleRetry();
    } finally {
      this.starting = false;
    }
  }
  isReady() {
    return this.ready;
  }
  change(snapshot: WorkspaceSnapshot) {
    if (this.stopped || !this.ready) return;
    if (this.latest && fingerprint(snapshot) === fingerprint(this.latest)) return;
    this.latest = snapshot;
    this.generation++;
    try {
      this.persist();
    } catch {
      this.report("error");
      return;
    }
    if (this.blocked) return;
    this.report("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 600);
  }
  async flush() {
    if (this.stopped || !this.ready || this.running || this.blocked || !this.latest) return;
    const snapshot = this.latest;
    if (fingerprint(snapshot) === this.confirmed) {
      this.storage.removeItem(this.outboxKey);
      this.report("saved");
      return;
    }
    this.running = true;
    const generation = this.generation;
    this.report("saving");
    try {
      const revision = await this.backend.save(snapshot, this.revision);
      if (this.stopped) return;
      this.retryAttempt = 0;
      this.revision = revision;
      this.confirmed = fingerprint(snapshot);
      this.storage.setItem(this.cacheKey, JSON.stringify({ revision, snapshot }));
      if (generation === this.generation) {
        this.storage.removeItem(this.outboxKey);
        this.report("saved");
      } else {
        this.persist();
        this.report("pending");
      }
    } catch (error) {
      if (this.stopped) return;
      const conflict = error instanceof Error && error.message.includes("WORKSPACE_CONFLICT");
      this.blocked = conflict;
      this.report(conflict ? "conflict" : "offline");
      if (!conflict) this.scheduleRetry();
    } finally {
      this.running = false;
      if (!this.stopped && !this.blocked && generation !== this.generation) void this.flush();
    }
  }
  async retry() {
    if (this.stopped || this.running) return;
    // start checks pending revision and handles an acknowledged write whose response was lost.
    await this.start();
  }
  async reloadRemote() {
    // Preserve the outbox before the user explicitly chooses the remote version.
    const pending = this.storage.getItem(this.outboxKey);
    if (pending)
      this.storage.setItem("avqix-conflict-backup:" + this.owner + ":" + Date.now(), pending);
    this.storage.removeItem(this.outboxKey);
    this.blocked = false;
    await this.start();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
  }
}
