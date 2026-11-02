import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { cleanArchivedSessions, directoryBytes, listArchivedSessions, resolveDshHome } from '../index.js';

const SESSION_A = 'session-11111111-1111-4111-8111-111111111111';
const SESSION_B = 'session-22222222-2222-4222-8222-222222222222';
const SESSION_C = 'session-33333333-3333-4333-8333-333333333333';

/** Build a throwaway profile that looks like the real data directory. */
function profile() {
  const home = mkdtempSync(join(tmpdir(), 'archive-cleaner-'));
  mkdirSync(join(home, 'storages'), { recursive: true });
  const workspace = join(home, 'sessions', '--D-demo--');
  mkdirSync(join(workspace, SESSION_A), { recursive: true });
  mkdirSync(join(workspace, SESSION_B), { recursive: true });
  writeFileSync(join(workspace, SESSION_A, 'session.v4.jsonl.zstd'), Buffer.alloc(2048, 1));
  writeFileSync(join(workspace, SESSION_B, 'session.v4.jsonl.zstd'), Buffer.alloc(1024, 2));

  writeFileSync(
    join(home, 'storages', 'workspace.json'),
    JSON.stringify({
      unit: { name: 'workspace', version: 2 },
      global: { initialized: true, archivedSessionIds: [SESSION_A, SESSION_B], pinnedSessionIds: [SESSION_B] },
      tables: {
        workspaces: {
          'w-1': { path: 'D:\\demo', title: 'demo', sessionIds: [SESSION_A, SESSION_B, SESSION_C] },
        },
      },
    }),
  );
  writeFileSync(
    join(home, 'storages', 'session_projcache.json'),
    JSON.stringify({
      unit: { name: 'session_projcache', version: 1 },
      global: null,
      tables: { sessions: { [SESSION_A]: { identity: { createdAt: 1756000000000, cwd: 'D:\\demo' } } } },
    }),
  );
  return home;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

test('resolveDshHome honours DSH_HOME and falls back to ~/.dsh', () => {
  assert.equal(resolveDshHome({ DSH_HOME: 'D:\\data' }, 'C:\\Users\\x'), 'D:\\data');
  assert.equal(resolveDshHome({}, 'C:\\Users\\x'), join('C:\\Users\\x', '.dsh'));
  assert.equal(resolveDshHome({ DSH_HOME: '   ' }, 'C:\\Users\\x'), join('C:\\Users\\x', '.dsh'));
});

test('lists only archived sessions, with size and workspace', () => {
  const home = profile();
  try {
    const listing = listArchivedSessions({ home });
    assert.equal(listing.ok, true);
    assert.equal(listing.sessions.length, 2);
    assert.deepEqual(
      listing.sessions.map((row) => row.id).sort(),
      [SESSION_A, SESSION_B].sort(),
    );
    const a = listing.sessions.find((row) => row.id === SESSION_A);
    assert.equal(a.bytes, 2048);
    assert.equal(a.workspace, 'D:\\demo');
    assert.equal(a.cwd, 'D:\\demo');
    assert.equal(a.dir !== null, true);
    assert.equal(listing.totals.bytes, 3072);
    assert.equal(listing.totals.missing, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('an empty archive set is reported as empty, not as an error', () => {
  const home = profile();
  try {
    const registryFile = join(home, 'storages', 'workspace.json');
    const registry = readJson(registryFile);
    registry.global.archivedSessionIds = [];
    writeFileSync(registryFile, JSON.stringify(registry));
    const listing = listArchivedSessions({ home });
    assert.equal(listing.ok, true);
    assert.deepEqual(listing.sessions, []);
    assert.deepEqual(listing.totals, { count: 0, bytes: 0, missing: 0 });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('reports sessions whose directory is already gone instead of failing', () => {
  const home = profile();
  try {
    rmSync(join(home, 'sessions', '--D-demo--', SESSION_B), { recursive: true, force: true });
    const listing = listArchivedSessions({ home });
    const b = listing.sessions.find((row) => row.id === SESSION_B);
    assert.equal(b.dir, null);
    assert.equal(b.bytes, 0);
    assert.equal(listing.totals.missing, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('quarantines the selected sessions, prunes the registry and keeps the rest', () => {
  const home = profile();
  try {
    const result = cleanArchivedSessions({ home, ids: [SESSION_A], now: Date.UTC(2026, 0, 2, 3, 4, 5) });
    assert.equal(result.ok, true);
    assert.equal(result.moved.length, 1);
    assert.equal(result.moved[0].id, SESSION_A);
    assert.equal(result.bytesFreed, 2048);

    // Moved, not deleted.
    assert.equal(existsSync(join(home, 'sessions', '--D-demo--', SESSION_A)), false);
    assert.equal(existsSync(result.trashDir), true);
    assert.equal(existsSync(join(result.trashDir, SESSION_A, 'session.v4.jsonl.zstd')), true);

    // Restore map records where it came from.
    const restore = readJson(join(result.trashDir, 'restore-map.json'));
    assert.equal(restore[SESSION_A].from, join(home, 'sessions', '--D-demo--', SESSION_A));
    assert.equal(restore[SESSION_A].workspace, '--D-demo--');

    // Registry pruned for A only.
    const registry = readJson(join(home, 'storages', 'workspace.json'));
    assert.deepEqual(registry.global.archivedSessionIds, [SESSION_B]);
    assert.deepEqual(registry.global.pinnedSessionIds, [SESSION_B]);
    assert.deepEqual(registry.tables.workspaces['w-1'].sessionIds, [SESSION_B, SESSION_C]);

    const cache = readJson(join(home, 'storages', 'session_projcache.json'));
    assert.equal(SESSION_A in cache.tables.sessions, false);

    // The untouched session keeps working.
    const listing = listArchivedSessions({ home });
    assert.deepEqual(listing.sessions.map((row) => row.id), [SESSION_B]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('refuses ids that are not archived, malformed, or already gone', () => {
  const home = profile();
  try {
    const result = cleanArchivedSessions({
      home,
      ids: [SESSION_C, 'session-../../etc', '../../storages/workspace.json', 'nope'],
    });
    assert.equal(result.ok, false);
    assert.equal(result.moved.length, 0);
    const reasons = result.skipped.map((row) => row.reason);
    assert.equal(reasons.every((reason) => reason === 'not-archived'), true);
    // Nothing was moved or rewritten.
    assert.equal(existsSync(join(home, 'sessions', '--D-demo--', SESSION_A)), true);
    const registry = readJson(join(home, 'storages', 'workspace.json'));
    assert.equal(registry.global.archivedSessionIds.length, 2);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('an empty selection is a no-op, not a crash', () => {
  const home = profile();
  try {
    const result = cleanArchivedSessions({ home, ids: [] });
    assert.equal(result.ok, false);
    assert.equal(result.moved.length, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('an archived id whose directory is gone only loses its registry entry', () => {
  const home = profile();
  try {
    rmSync(join(home, 'sessions', '--D-demo--', SESSION_A), { recursive: true, force: true });
    const result = cleanArchivedSessions({ home, ids: [SESSION_A], now: Date.UTC(2026, 0, 2, 3, 4, 5) });
    assert.equal(result.ok, true);
    assert.equal(result.moved.length, 0);
    assert.deepEqual(result.pruned, [SESSION_A]);
    assert.equal(result.bytesFreed, 0);
    assert.equal(result.trashDir, null);

    const registry = readJson(join(home, 'storages', 'workspace.json'));
    assert.deepEqual(registry.global.archivedSessionIds, [SESSION_B]);
    assert.deepEqual(registry.tables.workspaces['w-1'].sessionIds, [SESSION_B, SESSION_C]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('purge mode deletes the directories instead of quarantining them', () => {
  const home = profile();
  try {
    const result = cleanArchivedSessions({ home, ids: [SESSION_A, SESSION_B], mode: 'purge', now: Date.UTC(2026, 0, 2, 3, 4, 5) });
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'purge');
    assert.equal(result.moved.length, 0);
    assert.equal(result.deleted.length, 2);
    assert.equal(result.trashDir, null);
    assert.equal(result.bytesFreed, 3072);
    assert.equal(existsSync(join(home, 'sessions', '--D-demo--', SESSION_A)), false);
    assert.equal(existsSync(join(home, 'sessions', '--D-demo--', SESSION_B)), false);
    assert.equal(existsSync(join(home, '.session-trash')), false);

    const registry = readJson(join(home, 'storages', 'workspace.json'));
    assert.deepEqual(registry.global.archivedSessionIds, []);
    assert.deepEqual(registry.tables.workspaces['w-1'].sessionIds, [SESSION_C]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('an unknown cleanup mode is rejected before touching anything', () => {
  const home = profile();
  try {
    const result = cleanArchivedSessions({ home, ids: [SESSION_A], mode: 'shred' });
    assert.equal(result.ok, false);
    assert.match(result.error, /未知的清理模式/);
    assert.equal(existsSync(join(home, 'sessions', '--D-demo--', SESSION_A)), true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('directoryBytes sums nested files and ignores missing paths', () => {
  const home = profile();
  try {
    assert.equal(directoryBytes(join(home, 'sessions', '--D-demo--')), 3072);
    assert.equal(directoryBytes(join(home, 'sessions', 'nope')), 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
