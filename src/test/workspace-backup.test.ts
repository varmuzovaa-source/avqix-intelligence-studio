import { describe, expect, it } from 'vitest';
import { validateWorkspaceSnapshot } from '@/lib/workspace-backup';

describe('workspace backup validation', () => {
  it('accepts a versioned empty backup', () => {
    const snapshot = validateWorkspaceSnapshot({ version: 1, savedAt: '2026-11-22T00:00:00.000Z', clients: [], goals: {}, tasks: [] });
    expect(snapshot.clients).toEqual([]);
  });
  it('rejects incompatible versions and unsupported client types', () => {
    expect(() => validateWorkspaceSnapshot({ version: 2, clients: [], goals: {}, tasks: [] })).toThrow();
    expect(() => validateWorkspaceSnapshot({ version: 1, clients: [{ name: 'A', slug: 'a', model: 'unknown' }], goals: {}, tasks: [] })).toThrow();
  });
  it('rejects malformed tasks and unsupported values', () => {
    expect(() => validateWorkspaceSnapshot({ version: 1, clients: [], goals: {}, tasks: [{ id: 'x', status: 'paid' }] })).toThrow();
  });
});
