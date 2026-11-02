/**
 * dsh-archive-cleaner — host half.
 *
 * Archiving a conversation in DSH only hides it: the session log stays on disk
 * forever and the sidebar keeps no way to remove it. This plugin lists those
 * archived sessions and moves the selected ones into a quarantine folder
 * (`$DSH_HOME/.session-trash/<stamp>/`), then drops their ids from the profile
 * registry so they stop being listed.
 *
 * The Client half renders the footer action; every mutation happens here, in the
 * host process, because only the host knows where the profile actually lives.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

export const inject = ['webServer'];

const SESSION_ID = /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TRASH_DIR = '.session-trash';
const REGISTRY = ['storages', 'workspace.json'];
const PROJ_CACHE = ['storages', 'session_projcache.json'];

/** The harness home this process uses: `$DSH_HOME`, else `~/.dsh`. */
export function resolveDshHome(env = process.env, home = homedir()) {
  const configured = String(env.DSH_HOME ?? '').trim();
  return configured === '' ? join(home, '.dsh') : resolve(configured);
}

/** Read a JSON file, returning `fallback` when it is absent or unreadable. */
function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Write JSON atomically, keeping one timestamped backup of the previous bytes. */
function writeJsonWithBackup(file, value, stamp) {
  const backup = `${file}.bak-${stamp}`;
  try {
    copyFileSync(file, backup);
  } catch {
    // A missing original needs no backup; the write below creates it.
  }
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, file);
  return backup;
}

/** Total bytes of a directory tree; unreadable entries count as zero. */
export function directoryBytes(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) stack.push(next);
      else if (entry.isFile()) {
        try {
          total += statSync(next).size;
        } catch {
          // A file removed mid-walk simply does not count.
        }
      }
    }
  }
  return total;
}

/** All session directories under `<home>/sessions/<workspace>/`, keyed by id. */
function sessionDirectories(home) {
  const root = join(home, 'sessions');
  const found = new Map();
  let workspaces;
  try {
    workspaces = readdirSync(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue;
    let sessions;
    try {
      sessions = readdirSync(join(root, workspace.name), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (!session.isDirectory() || !SESSION_ID.test(session.name)) continue;
      found.set(session.name, join(root, workspace.name, session.name));
    }
  }
  return found;
}

/**
 * Describe every archived session of this profile.
 *
 * Only ids the registry calls archived are reported: a session directory on disk
 * that the profile never archived is not this plugin's business.
 */
export function listArchivedSessions({ home = resolveDshHome(), now = Date.now() } = {}) {
  const registryFile = join(home, ...REGISTRY);
  const registry = readJson(registryFile);
  if (registry === null) {
    return { ok: false, error: `找不到 profile 注册表：${registryFile}`, home, sessions: [] };
  }
  const archived = Array.isArray(registry.global?.archivedSessionIds)
    ? registry.global.archivedSessionIds
    : [];
  const pinned = new Set(Array.isArray(registry.global?.pinnedSessionIds) ? registry.global.pinnedSessionIds : []);

  const workspaceOf = new Map();
  const workspaces = registry.tables?.workspaces ?? {};
  for (const [workspaceId, workspace] of Object.entries(workspaces)) {
    const label = workspace?.path || workspace?.title || workspaceId;
    for (const sessionId of workspace?.sessionIds ?? []) workspaceOf.set(sessionId, label);
  }

  const identityOf = new Map();
  const cache = readJson(join(home, ...PROJ_CACHE));
  for (const [sessionId, row] of Object.entries(cache?.tables?.sessions ?? {})) {
    identityOf.set(sessionId, row?.identity ?? {});
  }

  const onDisk = sessionDirectories(home);
  const sessions = archived.map((id) => {
    const dir = onDisk.get(id) ?? null;
    const identity = identityOf.get(id) ?? {};
    return {
      id,
      dir,
      bytes: dir === null ? 0 : directoryBytes(dir),
      workspace: workspaceOf.get(id) ?? '',
      cwd: identity.cwd ?? '',
      createdAt: typeof identity.createdAt === 'number' ? identity.createdAt : null,
      pinned: pinned.has(id),
    };
  });
  sessions.sort((a, b) => b.bytes - a.bytes || String(a.id).localeCompare(String(b.id)));

  return {
    ok: true,
    home,
    generatedAt: now,
    trashRoot: join(home, TRASH_DIR),
    sessions,
    totals: {
      count: sessions.length,
      bytes: sessions.reduce((sum, row) => sum + row.bytes, 0),
      missing: sessions.filter((row) => row.dir === null).length,
    },
  };
}

/** Keep only ids that are archived, and resolve their directory when it exists. */
function selectTargets(home, ids) {
  const wanted = new Set(ids);
  const onDisk = sessionDirectories(home);
  const registry = readJson(join(home, ...REGISTRY));
  const archived = new Set(registry?.global?.archivedSessionIds ?? []);
  const targets = [];
  const skipped = [];
  for (const id of wanted) {
    if (!SESSION_ID.test(String(id)) || !archived.has(id)) {
      skipped.push({ id, reason: 'not-archived' });
      continue;
    }
    const dir = onDisk.get(id);
    if (dir === undefined) {
      // Archived, but its files were already moved away: only the registry entry
      // is left, so cleaning means dropping that entry instead of moving bytes.
      targets.push({ id, dir: null });
      continue;
    }
    // Defence in depth: the directory must still live under `<home>/sessions/`.
    const root = resolve(home, 'sessions') + sep;
    if (!resolve(dir).startsWith(root)) {
      skipped.push({ id, reason: 'escapes-sessions-root' });
      continue;
    }
    targets.push({ id, dir });
  }
  return { targets, skipped };
}

/**
 * Move the given archived sessions into `.session-trash/<stamp>/` and prune the
 * registry entries that would otherwise keep listing them.
 *
 * Nothing is deleted: the quarantine directory keeps every byte, and a
 * `restore-map.json` records where each session came from.
 */
export function cleanArchivedSessions({ home = resolveDshHome(), ids = [], now = Date.now() } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: '没有选中任何会话', moved: [], pruned: [], skipped: [] };
  }
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  const { targets, skipped } = selectTargets(home, ids);
  if (targets.length === 0) {
    return { ok: false, error: '没有可清理的会话（可能已被移走或未归档）', moved: [], pruned: [], skipped, trashDir: null };
  }

  const movable = targets.filter((target) => target.dir !== null);
  const pruneOnly = targets.filter((target) => target.dir === null).map((target) => target.id);
  const trashDir = join(home, TRASH_DIR, stamp);
  if (movable.length > 0) mkdirSync(trashDir, { recursive: true });

  const moved = [];
  const restore = {};
  for (const target of movable) {
    const destination = join(trashDir, target.id);
    try {
      renameSync(target.dir, destination);
    } catch (error) {
      skipped.push({ id: target.id, reason: `move-failed: ${error.code ?? error.message}` });
      continue;
    }
    moved.push({ id: target.id, from: target.dir, to: destination });
    restore[target.id] = { from: target.dir, workspace: basename(dirname(target.dir)) };
  }
  if (moved.length === 0 && pruneOnly.length === 0) {
    return { ok: false, error: '所有会话都移动失败', moved, pruned: [], skipped, trashDir: null };
  }
  if (moved.length > 0) {
    writeFileSync(join(trashDir, 'restore-map.json'), `${JSON.stringify(restore, null, 2)}\n`, 'utf8');
  }

  const movedIds = new Set([...moved.map((row) => row.id), ...pruneOnly]);
  const backups = [];
  const registryFile = join(home, ...REGISTRY);
  const registry = readJson(registryFile);
  if (registry !== null) {
    if (Array.isArray(registry.global?.archivedSessionIds)) {
      registry.global.archivedSessionIds = registry.global.archivedSessionIds.filter((id) => !movedIds.has(id));
    }
    if (Array.isArray(registry.global?.pinnedSessionIds)) {
      registry.global.pinnedSessionIds = registry.global.pinnedSessionIds.filter((id) => !movedIds.has(id));
    }
    for (const workspace of Object.values(registry.tables?.workspaces ?? {})) {
      if (Array.isArray(workspace?.sessionIds)) {
        workspace.sessionIds = workspace.sessionIds.filter((id) => !movedIds.has(id));
      }
    }
    backups.push(writeJsonWithBackup(registryFile, registry, stamp));
  }

  const cacheFile = join(home, ...PROJ_CACHE);
  const cache = readJson(cacheFile);
  if (cache !== null) {
    let changed = false;
    for (const id of movedIds) {
      if (cache.tables?.sessions && id in cache.tables.sessions) {
        delete cache.tables.sessions[id];
        changed = true;
      }
    }
    if (changed) backups.push(writeJsonWithBackup(cacheFile, cache, stamp));
  }

  return {
    ok: true,
    moved,
    pruned: pruneOnly,
    skipped,
    trashDir: moved.length > 0 ? trashDir : null,
    backups,
    bytesFreed: moved.reduce((sum, row) => sum + directoryBytes(row.to), 0),
  };
}

/** JSON helper shared by both routes. */
function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

/** Read a small JSON request body, rejecting anything over 64 KiB. */
function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        rejectBody(new Error('请求体过大'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) return resolveBody({});
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        rejectBody(new Error('请求体不是合法 JSON'));
      }
    });
    request.on('error', rejectBody);
  });
}

/** Register the two routes the footer dialog talks to. */
export function apply(ctx) {
  const home = resolveDshHome();

  ctx.webServer.register({
    kind: 'exact',
    path: '/archive-cleaner/list',
    handler: (request, response) => {
      try {
        sendJson(response, 200, listArchivedSessions({ home }));
      } catch (error) {
        sendJson(response, 500, { ok: false, error: String(error?.message ?? error), sessions: [] });
      }
    },
  });

  ctx.webServer.register({
    kind: 'exact',
    path: '/archive-cleaner/clean',
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: '只接受 POST' });
        return;
      }
      try {
        const body = await readBody(request);
        const ids = Array.isArray(body?.ids) ? body.ids.slice(0, 500).map(String) : [];
        sendJson(response, 200, cleanArchivedSessions({ home, ids }));
      } catch (error) {
        sendJson(response, 400, { ok: false, error: String(error?.message ?? error), moved: [] });
      }
    },
  });
}
