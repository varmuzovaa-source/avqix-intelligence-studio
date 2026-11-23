import type { BusinessModel, CustomClient } from './analytics-data';
import type { ClientGoals } from './goals';
import type { Task } from './tasks-store';

const KEYS = {
  clients: 'avqix-clients-v1',
  goals: 'avqix-goals-v1',
  tasks: 'avqix-tasks-v1',
} as const;

export type WorkspaceSnapshot = {
  version: 1;
  savedAt: string;
  clients: CustomClient[];
  goals: Record<string, ClientGoals>;
  tasks: Task[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const models: BusinessModel[] = ['ecommerce', 'services', 'hybrid', 'b2b'];
const statuses = ['todo', 'doing', 'done'];
const priorities = ['Vysoká', 'Střední', 'Nízká'];

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Validate everything before reading or writing existing local data. */
export function validateWorkspaceSnapshot(input: unknown): WorkspaceSnapshot {
  ensure(isObject(input) && input['version'] === 1, 'Neplatná verze zálohy AVQIX.');
  ensure(typeof input['savedAt'] === 'string' && !Number.isNaN(Date.parse(input['savedAt'])), 'V záloze chybí platné datum.');
  ensure(Array.isArray(input['clients']) && input['clients'].length <= 500, 'Neplatný seznam klientů.');
  for (const client of input['clients']) {
    ensure(isObject(client) && typeof client['name'] === 'string' && client['name'].length >= 2 && client['name'].length <= 60, 'Neplatný klient v záloze.');
    ensure(typeof client['slug'] === 'string' && /^[a-z0-9-]+$/.test(client['slug']), 'Neplatný identifikátor klienta.');
    ensure(models.includes(client['model'] as BusinessModel), 'Neznámý typ podnikání.');
    ensure(client['googleId'] === undefined || typeof client['googleId'] === 'string', 'Neplatné Google Ads ID.');
    ensure(client['metaId'] === undefined || typeof client['metaId'] === 'string', 'Neplatné Meta Ads ID.');
  }
  ensure(isObject(input['goals']) && Object.keys(input['goals']).length <= 500, 'Neplatné cíle v záloze.');
  for (const goals of Object.values(input['goals'])) {
    ensure(isObject(goals) && typeof goals['business'] === 'string' && typeof goals['marketing'] === 'string' && Array.isArray(goals['kpis']) && goals['kpis'].length <= 100, 'Neplatné marketingové cíle.');
    for (const kpi of goals['kpis']) {
      ensure(isObject(kpi) && typeof kpi['id'] === 'string' && typeof kpi['metric'] === 'string' && typeof kpi['target'] === 'number' && Number.isFinite(kpi['target']), 'Neplatné KPI.');
    }
  }
  ensure(Array.isArray(input['tasks']) && input['tasks'].length <= 10000, 'Neplatný seznam úkolů.');
  for (const task of input['tasks']) {
    ensure(isObject(task) && typeof task['id'] === 'string' && typeof task['title'] === 'string' && typeof task['sourceKey'] === 'string', 'Neplatný úkol.');
    ensure(statuses.includes(task['status'] as string) && priorities.includes(task['priority'] as string), 'Neplatný stav úkolu.');
    for (const field of ['action', 'source', 'recipient', 'impact', 'owner', 'createdAt']) {
      ensure(typeof task[field] === 'string', 'Neplatná položka úkolu: ' + field);
    }
    ensure(task['dueDate'] === undefined || (typeof task['dueDate'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task['dueDate']) && !Number.isNaN(Date.parse(task['dueDate']))), 'Neplatný termín úkolu.');
  }
  return input as WorkspaceSnapshot;
}

function loadJson(key: string, fallback: unknown): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
  catch { throw new Error('Úložiště obsahuje poškozená data: ' + key); }
}

export function exportWorkspaceBackup(): WorkspaceSnapshot {
  return validateWorkspaceSnapshot({
    version: 1,
    savedAt: new Date().toISOString(),
    clients: loadJson(KEYS.clients, []),
    goals: loadJson(KEYS.goals, {}),
    tasks: loadJson(KEYS.tasks, []),
  });
}

/** Import is deliberately replace-only and requires explicit confirmation in UI.
 * It never sends data to a network or enables a paid service.
 */
export function restoreWorkspaceBackup(input: unknown): void {
  const data = validateWorkspaceSnapshot(input);
  const values = {
    [KEYS.clients]: JSON.stringify(data.clients),
    [KEYS.goals]: JSON.stringify(data.goals),
    [KEYS.tasks]: JSON.stringify(data.tasks),
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, localStorage.getItem(key)]));
  try {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  } catch {
    for (const [key, value] of Object.entries(previous)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw new Error('Nepodařilo se obnovit data. Původní úložiště zůstalo zachováno.');
  }
}
