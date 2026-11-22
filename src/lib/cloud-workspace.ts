import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { validateWorkspaceSnapshot, type WorkspaceSnapshot } from "./workspace-backup";
import type { SyncBackend, CloudVersion } from "./auto-sync";
const url = "https://ccwbyffhpljmmrnkakwu.supabase.co";
const key = "sb_publishable_Lxn20p0I5NsiAPnIPExDqA_rMG95ucE";
export function validateCloudSnapshot(snapshot: WorkspaceSnapshot) {
  const data = validateWorkspaceSnapshot(snapshot);
  if (data.tasks.some((t) => !t.clientName || !data.clients.some((c) => c.name === t.clientName)))
    throw new Error("Některé úkoly nemají přiřazeného vlastního klienta.");
  return data;
}
async function read(client: SupabaseClient): Promise<CloudVersion> {
  const { data, error } = await client.rpc("avqix_read_workspace");
  if (error) throw new Error(error.message);
  if (!data || !Number.isSafeInteger(data.revision)) throw new Error("Neplatná odpověď databáze.");
  return { revision: data.revision, snapshot: validateCloudSnapshot(data.snapshot) };
}
async function save(client: SupabaseClient, snapshot: WorkspaceSnapshot, revision: number) {
  validateCloudSnapshot(snapshot);
  const { data, error } = await client.rpc("avqix_save_workspace", {
    p_snapshot: snapshot,
    p_expected_revision: revision,
  });
  if (error) throw new Error(error.message);
  if (!Number.isSafeInteger(data)) throw new Error("Neplatná verze dat.");
  return data as number;
}
// Each synchronizer is bound to one account's token; switching accounts cannot redirect queued writes.
export function createCloudBackend(
  initialToken: string,
): SyncBackend & { updateToken(token: string): void } {
  let token = initialToken;
  const client = createClient(url, key, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    read: () => read(client),
    save: (s, r) => save(client, s, r),
    updateToken: (next) => {
      token = next;
    },
  };
}
export async function uploadWorkspace(snapshot: WorkspaceSnapshot) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Nejdříve se přihlaste.");
  validateCloudSnapshot(snapshot);
  const current = await read(supabase);
  await save(supabase, snapshot, current.revision);
}
export async function downloadWorkspace() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Nejdříve se přihlaste.");
  return (await read(supabase)).snapshot;
}
