import { supabase } from "./supabase";
import { validateWorkspaceSnapshot, type WorkspaceSnapshot } from "./workspace-backup";

// Each operation is checked by RLS. This explicit upload does not delete remote rows.
export async function uploadWorkspace(snapshot: WorkspaceSnapshot) {
  const data = validateWorkspaceSnapshot(snapshot);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Nejdříve se přihlaste.");
  if (data.tasks.some((t) => !t.clientName || !data.clients.some((c) => c.name === t.clientName))) {
    throw new Error(
      "Některé úkoly nemají přiřazeného vlastního klienta. Přenos byl zastaven před zápisem; nejdříve je zálohujte a vyřešte přiřazení.",
    );
  }
  for (const client of data.clients) {
    const { data: row, error } = await supabase
      .from("avqix_clients")
      .upsert(
        {
          owner_id: auth.user.id,
          name: client.name,
          slug: client.slug,
          business_model: client.model,
          google_ads_id: client.googleId ?? null,
          meta_ads_id: client.metaId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,slug" },
      )
      .select("id")
      .single();
    if (error) throw error;
    const goal = data.goals[client.name];
    if (goal) {
      const { error } = await supabase.from("avqix_goals").upsert(
        {
          owner_id: auth.user.id,
          client_id: row.id,
          business_goal: goal.business,
          marketing_goal: goal.marketing,
          kpis: goal.kpis,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,client_id" },
      );
      if (error) throw error;
    }
    for (const task of data.tasks.filter((t) => t.clientName === client.name)) {
      const { error } = await supabase.from("avqix_tasks").upsert(
        {
          owner_id: auth.user.id,
          client_id: row.id,
          source_key: task.sourceKey,
          title: task.title,
          action: task.action,
          source: task.source,
          recipient: task.recipient,
          impact: task.impact,
          priority: task.priority,
          assignee: task.owner,
          status: task.status,
          created_at: task.createdAt,
        },
        { onConflict: "owner_id,client_id,source_key" },
      );
      if (error) throw error;
    }
  }
}

export async function downloadWorkspace(): Promise<WorkspaceSnapshot> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Nejdříve se přihlaste.");
  const [clients, goals, tasks] = await Promise.all([
    supabase.from("avqix_clients").select("*"),
    supabase.from("avqix_goals").select("*"),
    supabase.from("avqix_tasks").select("*"),
  ]);
  for (const result of [clients, goals, tasks]) if (result.error) throw result.error;
  const names = new Map(clients.data!.map((c) => [c.id, c.name]));
  return validateWorkspaceSnapshot({
    version: 1,
    savedAt: new Date().toISOString(),
    clients: clients.data!.map((c) => ({
      name: c.name,
      slug: c.slug,
      model: c.business_model,
      googleId: c.google_ads_id ?? undefined,
      metaId: c.meta_ads_id ?? undefined,
    })),
    goals: Object.fromEntries(
      goals.data!.map((g) => [
        names.get(g.client_id),
        {
          business: g.business_goal,
          marketing: g.marketing_goal,
          kpis: g.kpis,
          updatedAt: g.updated_at,
        },
      ]),
    ),
    tasks: tasks.data!.map((t) => ({
      id: t.id,
      clientName: names.get(t.client_id),
      sourceKey: t.source_key,
      title: t.title,
      action: t.action,
      source: t.source,
      recipient: t.recipient,
      impact: t.impact,
      priority: t.priority,
      owner: t.assignee,
      status: t.status,
      createdAt: t.created_at,
    })),
  });
}
