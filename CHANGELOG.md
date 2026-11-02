# Changelog

## 0.1.0 — 2026-11-02

First release.

- Tools entry registered into `sidebar.footer.action`, beside the Settings button.
- Dialog lists archived sessions with workspace, creation time and size; selection is
  per row, with select-all / clear.
- Cleaning moves the selected session directories into
  `$DSH_HOME/.session-trash/<timestamp>/` and writes `restore-map.json`.
- The moved ids are pruned from `workspace.json` (`archivedSessionIds`,
  `pinnedSessionIds`, every workspace's `sessionIds`) and `session_projcache.json`,
  each backed up as `.bak-<timestamp>` first.
- Host validates every id: archived, well formed, inside `$DSH_HOME/sessions/`.
- An archived id whose directory is already gone is still actionable: cleaning it drops
  the stale registry entry (reported as `pruned`) instead of failing.
- Tests cover listing, quarantine, registry pruning, malformed ids and path traversal.
