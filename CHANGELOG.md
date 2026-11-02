# Changelog

## 0.1.1 — 2026-11-02

- Fix: clicking the menu item did nothing. The outside-click handler only ignored
  the trigger, so `mousedown` on the item closed the menu before `click` landed.
- Fix: the menu is portalled to `document.body`; inside the sidebar footer a
  transformed ancestor makes `position: fixed` resolve against itself and clip it.
- Add the confirmation step: selecting rows only enables **Next**; the second page
  repeats the count, the total size and the quarantine directory before cleaning.
- Add a secondary entry under **Settings → General** for hosts that render the
  sidebar footer differently.

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
