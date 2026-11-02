# Changelog

## 0.1.3 — 2026-11-02

- The empty state is explicit: with no archived sessions the dialog says so and offers
  only Close, and the Tools menu item labels itself `没有可清理的归档会话`.
- Keep the result line visible when a cleanup empties the list (it used to be replaced by
  the empty state before the user could read it).
- Test: an empty archive set reports `totals: 0` instead of an error.

## 0.1.2 — 2026-11-02

- Fix: the dialog was translucent because it reused `--dsw-menu-surface-fill`, a
  menu token that expects a backdrop blur. Dialogs now paint with the opaque
  `--dsw-alias-bg-layer-1`; the popover menu keeps the translucent menu surface.
- Darken and blur the scrim so the page behind cannot compete with the list.

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
