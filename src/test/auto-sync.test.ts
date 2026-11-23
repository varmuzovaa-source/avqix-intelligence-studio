import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AutoSync, fingerprint, type SyncBackend, type SyncState } from "@/lib/auto-sync";
import type { WorkspaceSnapshot } from "@/lib/workspace-backup";
const empty = (): WorkspaceSnapshot => ({
  version: 1,
  savedAt: "2026-11-22T00:00:00Z",
  clients: [],
  goals: {},
  tasks: [],
});
const withClient = (name: string): WorkspaceSnapshot => ({
  ...empty(),
  clients: [{ name, slug: name.toLowerCase(), model: "services" }],
});
let states: SyncState[];
let apply: ReturnType<typeof vi.fn<(s: WorkspaceSnapshot) => void>>;
beforeEach(() => {
  localStorage.clear();
  states = [];
  apply = vi.fn();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
const create = (backend: SyncBackend, owner = "A") =>
  new AutoSync(owner, backend, localStorage, (s) => states.push(s), apply);
it("debounces changes and saves the latest snapshot", async () => {
  const backend = {
    read: vi.fn().mockResolvedValue({ revision: 0, snapshot: empty() }),
    save: vi.fn().mockResolvedValue(1),
  };
  const sync = create(backend);
  await sync.start();
  sync.change(withClient("First"));
  sync.change(withClient("Latest"));
  await vi.advanceTimersByTimeAsync(700);
  expect(backend.save).toHaveBeenCalledTimes(1);
  expect(backend.save).toHaveBeenCalledWith(withClient("Latest"), 0);
  expect(states.at(-1)).toBe("saved");
  expect(localStorage.getItem(sync.outboxKey)).toBeNull();
  sync.stop();
});
it("retains failed changes on reload and replays only the owning account outbox", async () => {
  const fail = {
    read: vi.fn().mockResolvedValue({ revision: 0, snapshot: empty() }),
    save: vi.fn().mockRejectedValue(new Error("network")),
  };
  const first = create(fail);
  await first.start();
  first.change(withClient("Offline"));
  await vi.advanceTimersByTimeAsync(700);
  first.stop();
  expect(localStorage.getItem(first.outboxKey)).not.toBeNull();
  const backend = {
    read: vi.fn().mockResolvedValue({ revision: 0, snapshot: empty() }),
    save: vi.fn().mockResolvedValue(1),
  };
  const other = create(backend, "B");
  await other.start();
  expect(backend.save).not.toHaveBeenCalled();
  other.stop();
  const restored = create(backend);
  await restored.start();
  expect(backend.save).toHaveBeenCalledWith(withClient("Offline"), 0);
  restored.stop();
});
it("does not overwrite a remote revision changed by another device", async () => {
  localStorage.setItem(
    "avqix-outbox-v1:A",
    JSON.stringify({ revision: 0, snapshot: withClient("Local") }),
  );
  const backend = {
    read: vi.fn().mockResolvedValue({ revision: 2, snapshot: withClient("Remote") }),
    save: vi.fn(),
  };
  const sync = create(backend);
  await sync.start();
  expect(states.at(-1)).toBe("conflict");
  expect(backend.save).not.toHaveBeenCalled();
  expect(apply).toHaveBeenCalledWith(withClient("Local"));
  sync.stop();
});
it("recognizes a committed write whose response was lost", async () => {
  localStorage.setItem(
    "avqix-outbox-v1:A",
    JSON.stringify({ revision: 0, snapshot: withClient("Saved") }),
  );
  const backend = {
    read: vi.fn().mockResolvedValue({ revision: 1, snapshot: withClient("Saved") }),
    save: vi.fn(),
  };
  const sync = create(backend);
  await sync.start();
  expect(states.at(-1)).toBe("saved");
  expect(backend.save).not.toHaveBeenCalled();
  sync.stop();
});
it("compares content independently of server object-key order and timestamps", () => {
  const local = withClient("Same");
  const remote = {
    ...local,
    savedAt: "2026-11-23T00:00:00Z",
    clients: [{ model: "services" as const, slug: "same", name: "Same" }],
  };
  expect(fingerprint(local)).toBe(fingerprint(remote));
});
it("serializes in-flight saves and keeps edits made during the first request", async () => {
  let resolve!: (revision: number) => void;
  const backend = {
    read: vi.fn().mockResolvedValue({ revision: 0, snapshot: empty() }),
    save: vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue(2),
  };
  const sync = create(backend);
  await sync.start();
  sync.change(withClient("First"));
  await vi.advanceTimersByTimeAsync(700);
  sync.change(withClient("Second"));
  resolve(1);
  await vi.advanceTimersByTimeAsync(700);
  expect(backend.save.mock.calls.map((c) => c[1])).toEqual([0, 1]);
  expect(states.at(-1)).toBe("saved");
  sync.stop();
});
