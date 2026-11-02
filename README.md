# dsh-archive-cleaner

A DeepSeek Harness bundle that adds one row to **Settings → General** and lets you
clean up **archived conversations** — the ones you cannot delete from the UI.

Archiving in DSH only hides a session. Its log is kept forever under
`$DSH_HOME/sessions/<workspace>/<session-id>/`, and the sidebar offers no delete action
at all. On a profile that has been in use for a while this quietly becomes hundreds of
megabytes of conversations nobody will ever open again.

This bundle lists them, shows how much each one costs, and moves the ones you select
into a quarantine folder.

<sub>中文说明见文末。</sub>

## What it does

| Step | Result |
|---|---|
| Open **Settings → General** | One extra row: *Clean archived workspaces* |
| Click **Open** | A dialog lists every archived session: workspace, creation time, size, checkbox |
| Select some (or all), then **Next** | A confirmation page repeats the count, the total size and the quarantine directory |
| Confirm | Selected sessions are **moved** to `$DSH_HOME/.session-trash/<timestamp>/`, with a `restore-map.json` next to them |
| Tick **Delete the files instead of quarantining them** | Same flow, but the directories are removed outright — no quarantine copy, no restore map |
| Restart DSH | The sidebar no longer lists them; in quarantine mode every byte is still on disk |

By default nothing is deleted. To restore, move a directory from
`.session-trash/<timestamp>/<id>` back to the path recorded in `restore-map.json`, then
restart DSH. The opt-in delete mode exists for people who already emptied their
quarantine and want the disk space back in one step; it is irreversible.

A row marked **(no longer on disk)** has an archived registry entry but no files left —
usually because it was moved by hand or by an older cleanup. Selecting it drops the stale
entry without moving anything, which is how the sidebar finally forgets it.

## Install

```bash
dsh plugin add github:dongfangxy/dsh-archive-cleaner
```

The same string works in the app: **Settings → Plugins → Add plugin** (the field accepts a
package name, a Git address, a tarball, or an absolute local path). The installer records a
real dependency and applies the bundle patch, so later `pnpm install` runs keep it.

From a local checkout, declare a link dependency instead of copying the folder into
`node_modules` (a copied folder is pruned by the next install):

```json
"dependencies": {
  "dsh-archive-cleaner": "link:<absolute path to this checkout>"
}
```

then `pnpm install --dir <profile>` and restart DSH.

## How it works

A cordis bundle with a host half and a client half:

| File | Role |
|---|---|
| `cordis.patch.yml` | inserts one loader row named `archive-cleaner` into the profile |
| `index.js` | host: `GET /archive-cleaner/list`, `POST /archive-cleaner/clean`; all filesystem work happens here |
| `client.js` | client: registers the Settings → General row (`settings.general.item`) and renders the dialog |
| `package.json` | `dsh.bundle.patch` and `dsh.client` declarations |

The Host resolves the profile from `$DSH_HOME` (falling back to `~/.dsh`), reads
`storages/workspace.json` for `global.archivedSessionIds`, and measures each session
directory on disk. Cleaning is `rename()` into the quarantine folder, then pruning the
moved ids from `workspace.json` and `session_projcache.json` (both backed up first).

## Safety

- **Only archived ids can be cleaned.** A request naming a live session, a malformed id,
  or a path that escapes `$DSH_HOME/sessions/` is skipped, and the response says why.
- **Quarantine by default.** Every byte stays in `.session-trash/<timestamp>/`; the
  procedure is reversible by hand.
- **Deleting is a separate, explicit choice.** `mode: 'purge'` is only sent when the
  confirmation page's checkbox is ticked, the confirm button changes label to
  *Delete permanently*, and the page repeats that nothing can be restored. Unknown modes
  are rejected before any file is touched.
- **Registry edits are backed up** as `workspace.json.bak-<timestamp>` before writing.
- **No path comes from the client.** The dialog sends session ids and a mode; the host
  resolves and validates every directory itself.
- A session whose directory already disappeared is listed as `missing` and cannot be
  selected.

## Known limitations

- The entry lives in **Settings → General**, not in the sidebar account menu: that menu is
  compiled into `@deepseek-ai/dsh-client-ui-settings-account` and exposes no slot.
- Sessions moved while DSH is running disappear from the sidebar only after a restart.
- The plugin reads the profile registry directly. If a future DSH version changes
  `workspace.json`, the list will come back empty rather than guess.
- Windows, macOS and Linux all work; the tests run on any platform.

## Development

```bash
npm test          # node --test "test/*.test.mjs"
```

The tests build a throwaway profile under the OS temp directory and cover listing,
quarantine, registry pruning, malformed ids, and path traversal.

`client.js` is loaded by the Host's module loader and may `require('react')`,
`require('react-dom')` and `require('@deepseek-ai/dsh-client-ui-primitives')`.

## License

MIT © Chengxi Zhang

---

## 中文说明

DSH 的「归档」只是隐藏：会话日志永远留在 `$DSH_HOME/sessions/<工作区>/<会话 id>/`，
界面上没有任何删除入口。用久了就是几百 MB 没人会再打开的对话。

这个 bundle 在 **设置 → 通用** 里加一行「清理已归档工作区」：

1. 点这一行的「开始清理」→ 弹窗列出每个已归档会话（工作区、创建时间、占用大小、勾选框）；
2. 勾选后点「下一步」进入**确认页**：显示条数、合计大小、隔离目录，以及一个选项
   **「直接删除文件（不保留隔离区）」**——不勾就只是移动（默认），勾了按钮会变成
   「彻底删除」并提示无法恢复；
3. 确认 → 所选会话被**移动**到 `$DSH_HOME/.session-trash/<时间戳>/`（勾了删除则直接删掉），
   隔离模式下旁边生成 `restore-map.json` 记录原来的位置；
4. 重启 DSH → 侧栏不再列出它们。

**默认没有任何删除动作**。要恢复：把 `.session-trash/<时间戳>/<会话 id>` 搬回
`restore-map.json` 里记录的路径，重启即可。勾了「直接删除」的那批无法恢复。

安装：

```bash
dsh plugin add github:dongfangxy/dsh-archive-cleaner
```

或在应用里 **设置 → 插件 → Add plugin** 填同一串。

安全设计：只有「已归档」的 id 能被清理；非法 id、越界路径、已消失的目录一律跳过并说明原因；
注册表改写前自动备份；客户端从不提供路径，只发 id，路径由宿主自己解析校验。

已知限制：入口在设置按钮**旁边**而不是账号菜单里——那个菜单编译在官方包里，没有留给第三方的插槽；
运行中清理的会话要重启后才会从侧栏消失。
