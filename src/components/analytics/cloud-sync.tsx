import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { AutoSync, type SyncState } from "@/lib/auto-sync";
import { createCloudBackend } from "@/lib/cloud-workspace";
import { clientsStore } from "@/lib/clients-store";
import { goalsStore } from "@/lib/goals-store";
import { tasksStore } from "@/lib/tasks-store";
import {
  exportWorkspaceBackup,
  restoreWorkspaceBackup,
  type WorkspaceSnapshot,
} from "@/lib/workspace-backup";
import { Button } from "@/components/ui/button";
let state: SyncState = "loading";
let active: AutoSync | undefined;
const listeners = new Set<() => void>();
const labels: Record<SyncState, string> = {
  loading: "Načítám uložená data…",
  saved: "Uloženo v cloudu",
  pending: "Čeká na uložení…",
  saving: "Ukládám…",
  offline: "Čeká na připojení. Změny jsou v tomto zařízení.",
  error: "Místní zálohu se nepodařilo uložit. Nezavírejte stránku.",
  conflict: "Data se změnila na jiném zařízení. Vaše změny jsou zachované.",
  local: "Místní režim — pro cloud se přihlaste.",
};
function report(next: SyncState) {
  state = next;
  listeners.forEach((l) => l());
}
const useCloudSyncState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => "loading" as SyncState,
  );
export function CloudSyncStatus({ details = false }: { details?: boolean }) {
  const status = useCloudSyncState();
  return (
    <div className="cloud-sync-status" data-state={status} role="status">
      <span>{labels[status]}</span>
      {details && ["offline", "error", "conflict"].includes(status) && (
        <>
          <Button size="sm" variant="outline" onClick={() => void active?.retry()}>
            Zkusit znovu
          </Button>
          {status === "conflict" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    "Načíst verzi z cloudu? Místní změny budou uchovány v oddělené záloze tohoto účtu.",
                  )
                )
                  void active?.reloadRemote();
              }}
            >
              Načíst cloudovou verzi
            </Button>
          )}
        </>
      )}
    </div>
  );
}
function snapshot(): WorkspaceSnapshot {
  const clients = clientsStore.get();
  const names = new Set(clients.map((c) => c.name));
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    clients,
    goals: Object.fromEntries(Object.entries(goalsStore.get()).filter(([name]) => names.has(name))),
    tasks: tasksStore.get().filter((t) => t.clientName && names.has(t.clientName)),
  };
}
export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useCloudSyncState();
  useEffect(() => {
    let disposed = false;
    let applying = false;
    let userId: string | null | undefined;
    let backend: ReturnType<typeof createCloudBackend> | undefined;
    let engine: AutoSync | undefined;
    const apply = (s: WorkspaceSnapshot) => {
      if (disposed) return;
      applying = true;
      try {
        restoreWorkspaceBackup(s);
        clientsStore.replace(s.clients);
        goalsStore.reset(s.goals);
        tasksStore.reset(s.tasks);
      } finally {
        applying = false;
      }
    };
    const archiveLegacy = () => {
      if (!localStorage.getItem("avqix-legacy-snapshot-v1")) {
        const previous = exportWorkspaceBackup();
        if (previous.clients.length || previous.tasks.length || Object.keys(previous.goals).length)
          localStorage.setItem("avqix-legacy-snapshot-v1", JSON.stringify(previous));
      }
    };
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return;
      const nextId = session?.user.id ?? null;
      if (userId === nextId) {
        if (session) backend?.updateToken(session.access_token);
        return;
      }
      userId = nextId;
      engine?.stop();
      active = undefined;
      engine = undefined;
      setReady(false);
      try {
        archiveLegacy();
      } catch {
        report("error");
        return;
      }
      if (!session) {
        apply({ version: 1, savedAt: new Date().toISOString(), clients: [], goals: {}, tasks: [] });
        report("local");
        setReady(true);
        return;
      }
      backend = createCloudBackend(session.access_token);
      const boundUser = session.user.id;
      engine = new AutoSync(
        boundUser,
        backend,
        localStorage,
        (next) => {
          if (disposed || userId !== boundUser) return;
          report(next);
          setReady(engine?.isReady() ?? false);
        },
        (s) => {
          if (userId === boundUser) apply(s);
        },
      );
      active = engine;
      void engine.start();
    }).data.subscription;
    const changed = () => {
      if (!applying) engine?.change(snapshot());
    };
    const unsubscribe = [
      clientsStore.subscribe(changed),
      goalsStore.subscribe(changed),
      tasksStore.subscribe(changed),
    ];
    const online = () => {
      void engine?.retry();
    };
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (["pending", "saving", "offline", "error", "conflict"].includes(state)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", preventLoss);
    return () => {
      disposed = true;
      engine?.stop();
      active = undefined;
      subscription.unsubscribe();
      unsubscribe.forEach((fn) => fn());
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", preventLoss);
    };
  }, []);
  if (!ready)
    return (
      <main className="page-content">
        <h1>AVQIX</h1>
        <CloudSyncStatus details />
      </main>
    );
  return <>{children}</>;
}
