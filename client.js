window.__ModuleLoader__.load({
  id: 'dsh-archive-cleaner',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;

    const TrashIcon = primitives.IconTrashOutlineRegular;
    const ChevronIcon = primitives.IconChevronRightOutlineRegular;

    const NS = 'archive-cleaner';

    // Dictionary values stay plain strings: the host's `t()` returns the string
    // for a key, so sentences with numbers are composed in code instead.
    const zh = {
      action: '工具',
      menuTitle: '工具',
      menuClean: '清理已归档工作区…',
      menuCleanHint: '把已归档会话移到隔离区，并从侧栏移除',
      dialogTitle: '清理已归档工作区',
      dialogIntro: '归档只是隐藏：会话文件仍完整保留在磁盘上。勾选后会被移到隔离区（不删除），随时可以搬回来。',
      loading: '正在读取已归档会话…',
      empty: '没有已归档会话，侧栏已经很干净了。',
      missing: '（磁盘上已不存在）',
      unknownWorkspace: '（未记录工作区）',
      selectAll: '全选',
      clearAll: '清空',
      cancel: '取消',
      close: '关闭',
      confirm: '移到隔离区',
      confirmBusy: '正在移动…',
      retry: '重试',
      emptySelection: '请先勾选要清理的会话',
      movedVerb: '已清理',
      unit: '个会话',
      skippedWord: '跳过',
      entriesDropped: '条空登记（文件已不在）',
      restartHint: '重启 DSH 后侧栏不再列出。',
      loadFailed: '读取失败',
      cleanFailed: '清理失败',
    };

    const en = {
      action: 'Tools',
      menuTitle: 'Tools',
      menuClean: 'Clean archived workspaces…',
      menuCleanHint: 'Move archived sessions to a quarantine folder and drop them from the sidebar',
      dialogTitle: 'Clean archived workspaces',
      dialogIntro:
        'Archiving only hides a session: its log stays on disk. Selected sessions are moved to a quarantine folder (not deleted) and can be restored later.',
      loading: 'Reading archived sessions…',
      empty: 'No archived sessions — the sidebar is already clean.',
      missing: '(no longer on disk)',
      unknownWorkspace: '(workspace unknown)',
      selectAll: 'Select all',
      clearAll: 'Clear',
      cancel: 'Cancel',
      close: 'Close',
      confirm: 'Move to quarantine',
      confirmBusy: 'Moving…',
      retry: 'Retry',
      emptySelection: 'Select at least one session first',
      movedVerb: 'Cleaned',
      unit: 'session(s)',
      skippedWord: 'skipped',
      entriesDropped: 'stale registry entrie(s)',
      restartHint: 'Restart DSH to drop them from the sidebar.',
      loadFailed: 'Could not read the list',
      cleanFailed: 'Cleanup failed',
    };

    const tokens = {
      label: 'var(--dsw-alias-label-primary, inherit)',
      secondary: 'var(--dsw-alias-label-secondary, rgba(128,128,128,0.9))',
      tertiary: 'var(--dsw-alias-label-tertiary, rgba(128,128,128,0.7))',
      border: 'var(--dsw-alias-border-l2, rgba(128,128,128,0.24))',
      surface: 'var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-2, #1f1f1f))',
      hover: 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))',
      dangerHover: 'var(--dsw-alias-interactive-bg-hover-danger, rgba(220,80,80,0.16))',
      accent: 'var(--dsw-alias-button-primary-fill, #4d6bfe)',
      shadow: 'var(--dsw-specific-menu, 0 10px 30px rgba(0,0,0,0.35))',
      radius: 'var(--dsw-radius-md, 10px)',
    };

    /** "12.3 MB" — one decimal is enough for a size column. */
    function formatBytes(bytes) {
      const value = Number(bytes);
      if (!Number.isFinite(value) || value <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = value;
      let unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
      }
      return unit === 0 ? `${Math.round(size)} B` : `${size.toFixed(1)} ${units[unit]}`;
    }

    function formatDate(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
      const date = new Date(ms);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    async function readList() {
      const response = await fetch('/archive-cleaner/list', { headers: { accept: 'application/json' } });
      const body = await response.json().catch(() => null);
      if (!response.ok || body === null || body.ok !== true) {
        throw new Error((body && body.error) || `HTTP ${response.status}`);
      }
      return body;
    }

    async function clean(ids) {
      const response = await fetch('/archive-cleaner/clean', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const body = await response.json().catch(() => null);
      if (body === null) throw new Error(`HTTP ${response.status}`);
      if (body.ok !== true) throw new Error(body.error || `HTTP ${response.status}`);
      return body;
    }

    const styles = {
      trigger: (wide) => ({
        display: 'flex',
        alignItems: 'center',
        gap: wide ? '10px' : '0px',
        justifyContent: wide ? 'flex-start' : 'center',
        width: '100%',
        height: '36px',
        padding: wide ? '0 10px' : '0px',
        border: 0,
        borderRadius: tokens.radius,
        background: 'transparent',
        color: tokens.secondary,
        font: 'inherit',
        fontSize: '13px',
        cursor: 'pointer',
      }),
      menu: {
        position: 'fixed',
        zIndex: 2147483000,
        minWidth: '260px',
        padding: '6px',
        borderRadius: tokens.radius,
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        boxShadow: tokens.shadow,
        backdropFilter: 'var(--dsw-menu-backdrop-filter, none)',
      },
      menuTitle: {
        padding: '6px 10px 4px',
        fontSize: '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: tokens.tertiary,
      },
      menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 10px',
        border: 0,
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        background: 'transparent',
        color: tokens.label,
        font: 'inherit',
        fontSize: '13px',
        textAlign: 'left',
        cursor: 'pointer',
      },
      menuText: { display: 'flex', flexDirection: 'column', gap: '2px' },
      menuHint: { fontSize: '11px', color: tokens.tertiary },
      menuCount: {
        marginLeft: 'auto',
        fontSize: '11px',
        color: tokens.tertiary,
        fontVariantNumeric: 'tabular-nums',
      },
      backdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 2147483001,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      },
      dialog: {
        width: '680px',
        maxWidth: '100%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--dsw-radius-lg, 12px)',
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        boxShadow: tokens.shadow,
        color: tokens.label,
      },
      header: { padding: '18px 20px 10px' },
      title: { margin: 0, fontSize: '16px', fontWeight: 600 },
      intro: { margin: '8px 0 0', fontSize: '12px', lineHeight: '18px', color: tokens.secondary },
      toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 20px',
        borderTop: `1px solid ${tokens.border}`,
        borderBottom: `1px solid ${tokens.border}`,
      },
      linkButton: {
        padding: '2px 6px',
        border: 0,
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        background: 'transparent',
        color: tokens.secondary,
        font: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
      },
      counter: { fontSize: '12px', color: tokens.tertiary, fontVariantNumeric: 'tabular-nums' },
      list: { overflowY: 'auto', padding: '6px 12px', minHeight: '140px' },
      row: {
        display: 'grid',
        gridTemplateColumns: '20px 1fr auto',
        alignItems: 'center',
        gap: '10px',
        padding: '8px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
      },
      rowTitle: {
        fontSize: '13px',
        color: tokens.label,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      rowMeta: { fontSize: '11px', color: tokens.tertiary, marginTop: '2px' },
      rowSize: { fontSize: '11px', color: tokens.secondary, fontVariantNumeric: 'tabular-nums' },
      footer: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px' },
      button: {
        padding: '7px 14px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: `1px solid ${tokens.border}`,
        background: 'transparent',
        color: tokens.label,
        font: 'inherit',
        fontSize: '13px',
        cursor: 'pointer',
      },
      primary: {
        padding: '7px 14px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid transparent',
        background: tokens.accent,
        color: 'var(--dsw-alias-label-primary-foreground, #fff)',
        font: 'inherit',
        fontSize: '13px',
        cursor: 'pointer',
      },
      notice: (kind) => ({
        margin: '0 20px 8px',
        padding: '8px 10px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        fontSize: '12px',
        lineHeight: '18px',
        wordBreak: 'break-all',
        color: kind === 'error' ? 'var(--dsw-alias-state-warn-label, #ff8a8a)' : tokens.secondary,
        background: kind === 'error' ? tokens.dangerHover : tokens.hover,
      }),
    };

    function CleanerDialog({ t, onClose }) {
      const [state, setState] = React.useState('loading');
      const [data, setData] = React.useState(null);
      const [error, setError] = React.useState('');
      const [selected, setSelected] = React.useState(() => new Set());
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState(null);

      const load = React.useCallback(() => {
        setState('loading');
        setError('');
        readList()
          .then((body) => {
            setData(body);
            setSelected(new Set());
            setState('ready');
          })
          .catch((cause) => {
            setError(String((cause && cause.message) || cause));
            setState('failed');
          });
      }, []);

      React.useEffect(load, [load]);

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      const sessions = data?.sessions ?? [];
      const selectable = sessions;
      const selectedBytes = sessions
        .filter((row) => selected.has(row.id))
        .reduce((sum, row) => sum + row.bytes, 0);

      const toggle = (id) => {
        setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };

      const toggleAll = () => {
        setSelected((previous) =>
          previous.size === selectable.length && selectable.length > 0
            ? new Set()
            : new Set(selectable.map((row) => row.id)),
        );
      };

      const submit = async () => {
        if (selected.size === 0) {
          setNotice({ kind: 'error', text: t('emptySelection') });
          return;
        }
        setBusy(true);
        setNotice(null);
        try {
          const result = await clean([...selected]);
          const skipped = result.skipped?.length ?? 0;
          const movedCount = result.moved.length;
          const pruned = result.pruned?.length ?? 0;
          const size = formatBytes(result.bytesFreed ?? 0);
          const parts = [`${t('movedVerb')} ${movedCount} ${t('unit')}${movedCount > 0 ? ` (${size})` : ''}`];
          if (pruned > 0) parts.push(`${pruned} ${t('entriesDropped')}`);
          if (skipped > 0) parts.push(`${t('skippedWord')} ${skipped}`);
          if (result.trashDir) parts.push(`→ ${result.trashDir}`);
          setNotice({ kind: 'ok', text: `${parts.join(' · ')}. ${t('restartHint')}` });
          load();
        } catch (cause) {
          setNotice({ kind: 'error', text: `${t('cleanFailed')}: ${String((cause && cause.message) || cause)}` });
        } finally {
          setBusy(false);
        }
      };

      return ReactDOM.createPortal(
        h(
          'div',
          {
            style: styles.backdrop,
            role: 'presentation',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) onClose();
            },
          },
          h(
            'div',
            { style: styles.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('dialogTitle') },
            h(
              'div',
              { style: styles.header },
              h('h2', { style: styles.title }, t('dialogTitle')),
              h('p', { style: styles.intro }, t('dialogIntro')),
            ),
            state === 'failed'
              ? h(
                  'div',
                  { style: styles.notice('error') },
                  `${t('loadFailed')}: ${error} `,
                  h('button', { type: 'button', style: styles.linkButton, onClick: load }, t('retry')),
                )
              : null,
            state === 'loading' ? h('div', { style: styles.notice('ok') }, t('loading')) : null,
            state === 'ready' && sessions.length === 0
              ? h('div', { style: styles.notice('ok') }, t('empty'))
              : null,
            state === 'ready' && sessions.length > 0
              ? h(
                  'div',
                  { style: styles.toolbar },
                  h(
                    'button',
                    { type: 'button', style: styles.linkButton, onClick: toggleAll },
                    selected.size > 0 && selected.size === selectable.length ? t('clearAll') : t('selectAll'),
                  ),
                  h(
                    'span',
                    { style: styles.counter },
                    `${selected.size} / ${selectable.length} · ${formatBytes(selectedBytes)}`,
                  ),
                )
              : null,
            state === 'ready' && sessions.length > 0
              ? h(
                  'div',
                  { style: styles.list },
                  sessions.map((row) => {
                    const missing = row.dir === null;
                    const label = row.workspace || row.cwd || t('unknownWorkspace');
                    return h(
                      'label',
                      {
                        key: row.id,
                        style: { ...styles.row, opacity: missing ? 0.55 : 1, cursor: 'pointer' },
                        onMouseEnter: (event) => {
                          event.currentTarget.style.background = tokens.hover;
                        },
                        onMouseLeave: (event) => {
                          event.currentTarget.style.background = 'transparent';
                        },
                      },
                      h('input', {
                        type: 'checkbox',
                        checked: selected.has(row.id),
                        disabled: busy,
                        onChange: () => toggle(row.id),
                      }),
                      h(
                        'span',
                        { style: { minWidth: '0px' } },
                        h(
                          'div',
                          { style: styles.rowTitle, title: label },
                          `${label}${missing ? ` ${t('missing')}` : ''}`,
                        ),
                        h('div', { style: styles.rowMeta }, [formatDate(row.createdAt), row.id].filter(Boolean).join(' · ')),
                      ),
                      h('span', { style: styles.rowSize }, formatBytes(row.bytes)),
                    );
                  }),
                )
              : null,
            notice
              ? h('div', { style: styles.notice(notice.kind === 'error' ? 'error' : 'ok') }, notice.text)
              : null,
            h(
              'div',
              { style: styles.footer },
              h('button', { type: 'button', style: styles.button, onClick: onClose }, state === 'ready' ? t('close') : t('cancel')),
              state === 'ready' && sessions.length > 0
                ? h(
                    'button',
                    {
                      type: 'button',
                      style: { ...styles.primary, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' },
                      disabled: busy,
                      onClick: submit,
                    },
                    busy ? t('confirmBusy') : t('confirm'),
                  )
                : null,
            ),
          ),
        ),
        document.body,
      );
    }

    function ToolsAction({ wide, t }) {
      const [menuOpen, setMenuOpen] = React.useState(false);
      const [dialogOpen, setDialogOpen] = React.useState(false);
      const [count, setCount] = React.useState(null);
      const [anchor, setAnchor] = React.useState(null);
      const triggerRef = React.useRef(null);

      const openMenu = React.useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        setAnchor(rect ? { left: rect.left, top: rect.top } : null);
        setMenuOpen(true);
        readList()
          .then((body) => setCount(body.totals?.count ?? body.sessions?.length ?? 0))
          .catch(() => setCount(null));
      }, []);

      React.useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') setMenuOpen(false);
        };
        const onDown = (event) => {
          if (triggerRef.current?.contains(event.target)) return;
          setMenuOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('mousedown', onDown);
        };
      }, [menuOpen]);

      const menuStyle = anchor
        ? {
            ...styles.menu,
            left: `${Math.max(8, Math.min(anchor.left, window.innerWidth - 280))}px`,
            bottom: `${Math.max(8, window.innerHeight - anchor.top + 6)}px`,
          }
        : { ...styles.menu, left: '12px', bottom: '64px' };

      return h(
        React.Fragment,
        null,
        h(
          'button',
          {
            ref: triggerRef,
            type: 'button',
            style: styles.trigger(wide),
            title: t('action'),
            'aria-haspopup': 'menu',
            'aria-expanded': menuOpen,
            onClick: () => (menuOpen ? setMenuOpen(false) : openMenu()),
            onMouseEnter: (event) => {
              event.currentTarget.style.background = tokens.hover;
            },
            onMouseLeave: (event) => {
              event.currentTarget.style.background = 'transparent';
            },
          },
          h(TrashIcon, { size: 16 }),
          wide ? h('span', null, t('action')) : null,
          wide ? h('span', { style: { marginLeft: 'auto', opacity: 0.5 } }, h(ChevronIcon, { size: 14 })) : null,
        ),
        menuOpen
          ? h(
              'div',
              { style: menuStyle, role: 'menu', 'aria-label': t('menuTitle') },
              h('div', { style: styles.menuTitle }, t('menuTitle')),
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  style: styles.menuItem,
                  onMouseEnter: (event) => {
                    event.currentTarget.style.background = tokens.hover;
                  },
                  onMouseLeave: (event) => {
                    event.currentTarget.style.background = 'transparent';
                  },
                  onClick: () => {
                    setMenuOpen(false);
                    setDialogOpen(true);
                  },
                },
                h(
                  'span',
                  { style: styles.menuText },
                  h('span', null, t('menuClean')),
                  h('span', { style: styles.menuHint }, t('menuCleanHint')),
                ),
                count === null ? null : h('span', { style: styles.menuCount }, String(count)),
              ),
            )
          : null,
        dialogOpen ? h(CleanerDialog, { t, onClose: () => setDialogOpen(false) }) : null,
      );
    }

    const inject = ['slots', 'locale'];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'archive-cleaner: dictionaries');
      const t = ctx.locale.bind(NS);

      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          { name: 'sidebar.footer.action', id: 'archive-cleaner', order: 20, label: () => t('action') },
          (props) => h(ToolsAction, { ...props, t }),
        ),
      );
    }

    return { inject, apply };
  },
});
