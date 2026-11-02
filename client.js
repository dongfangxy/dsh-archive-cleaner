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

    // Dictionary values stay plain strings: `t(key)` returns the string, so
    // sentences containing numbers are composed in code.
    const zh = {
      action: '工具',
      menuTitle: '工具',
      menuClean: '清理已归档工作区…',
      menuCleanHint: '把已归档会话移到隔离区，并从侧栏移除',
      menuEmpty: '没有可清理的归档会话',
      dialogTitle: '清理已归档工作区',
      dialogIntro: '归档只是隐藏：会话文件仍完整保留在磁盘上。勾选后会被移到隔离区（不删除），随时可以搬回来。',
      loading: '正在读取已归档会话…',
      empty: '没有已归档会话，侧栏已经很干净了。',
      missing: '（磁盘上已不存在，选中只清登记）',
      unknownWorkspace: '（未记录工作区）',
      selectAll: '全选',
      clearAll: '清空',
      cancel: '取消',
      close: '关闭',
      next: '下一步',
      back: '返回',
      confirmTitle: '确认清理',
      confirmLead: '即将清理',
      confirmTarget: '隔离目录',
      confirmNote: '不会删除任何文件。会话被移动到隔离区后，随时可以按 restore-map.json 搬回原路径。',
      confirmBusy: '正在处理…',
      confirmNow: '确认清理',
      confirmDelete: '彻底删除',
      purgeLabel: '直接删除文件（不保留隔离区）',
      purgeHint: '勾选后文件被彻底删除，无法恢复',
      purgeNote: '文件将被彻底删除：没有隔离区，也没有 restore-map.json，删除后无法找回。',
      deletedVerb: '已删除',
      purgeFailed: '删除失败',
      retry: '重试',
      emptySelection: '请先勾选要清理的会话',
      movedVerb: '已清理',
      unit: '个会话',
      skippedWord: '跳过',
      entriesDropped: '条空登记',
      restartHint: '重启 DSH 后侧栏不再列出。',
      loadFailed: '读取失败',
      cleanFailed: '清理失败',
    };

    const en = {
      action: 'Tools',
      menuTitle: 'Tools',
      menuClean: 'Clean archived workspaces…',
      menuCleanHint: 'Move archived sessions to a quarantine folder and drop them from the sidebar',
      menuEmpty: 'Nothing to clean',
      dialogTitle: 'Clean archived workspaces',
      dialogIntro:
        'Archiving only hides a session: its log stays on disk. Selected sessions are moved to a quarantine folder (not deleted) and can be restored later.',
      loading: 'Reading archived sessions…',
      empty: 'No archived sessions — the sidebar is already clean.',
      missing: '(no files left — removes the registry entry only)',
      unknownWorkspace: '(workspace unknown)',
      selectAll: 'Select all',
      clearAll: 'Clear',
      cancel: 'Cancel',
      close: 'Close',
      next: 'Next',
      back: 'Back',
      confirmTitle: 'Confirm cleanup',
      confirmLead: 'About to clean',
      confirmTarget: 'Quarantine folder',
      confirmNote:
        'No file is deleted. Once moved, a session can be restored by following restore-map.json.',
      confirmBusy: 'Working…',
      confirmNow: 'Confirm cleanup',
      confirmDelete: 'Delete permanently',
      purgeLabel: 'Delete the files instead of quarantining them',
      purgeHint: 'The directories are removed and cannot be restored',
      purgeNote:
        'The directories will be deleted outright: no quarantine folder, no restore-map.json, no way back.',
      deletedVerb: 'Deleted',
      purgeFailed: 'Delete failed',
      retry: 'Retry',
      emptySelection: 'Select at least one session first',
      movedVerb: 'Cleaned',
      unit: 'session(s)',
      skippedWord: 'skipped',
      entriesDropped: 'stale entrie(s)',
      restartHint: 'Restart DSH to drop them from the sidebar.',
      loadFailed: 'Could not read the list',
      cleanFailed: 'Cleanup failed',
    };

    const tokens = {
      label: 'var(--dsw-alias-label-primary, inherit)',
      secondary: 'var(--dsw-alias-label-secondary, rgba(128,128,128,0.9))',
      tertiary: 'var(--dsw-alias-label-tertiary, rgba(128,128,128,0.7))',
      border: 'var(--dsw-alias-border-l2, rgba(128,128,128,0.24))',
      // The menu token is translucent by design (it relies on a backdrop blur), so
      // a full dialog painted with it lets the page behind show through. Dialogs
      // and rows use opaque layer tokens instead.
      menuSurface: 'var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-2, #1f1f1f))',
      surface: 'var(--dsw-alias-bg-layer-1, #17181c)',
      raised: 'var(--dsw-alias-bg-layer-2, #202127)',
      hover: 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))',
      dangerHover: 'var(--dsw-alias-interactive-bg-hover-danger, rgba(220,80,80,0.16))',
      accent: 'var(--dsw-alias-button-primary-fill, #4d6bfe)',
      shadow: 'var(--dsw-specific-menu, 0 10px 30px rgba(0,0,0,0.35))',
      radius: 'var(--dsw-radius-md, 10px)',
      warn: 'var(--dsw-alias-state-warn-label, #ffb454)',
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

    async function clean(ids, mode) {
      const response = await fetch('/archive-cleaner/clean', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, mode }),
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
        minWidth: '264px',
        maxWidth: '320px',
        padding: '6px',
        borderRadius: tokens.radius,
        background: tokens.menuSurface,
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
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(2px)',
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
        overflow: 'hidden',
        isolation: 'isolate',
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
      summary: { padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' },
      summaryLead: { margin: 0, fontSize: '13px', color: tokens.label },
      summaryValue: { margin: 0, fontSize: '20px', fontWeight: 600 },
      summaryRow: { display: 'grid', gridTemplateColumns: '96px 1fr', gap: '10px', fontSize: '12px' },
      summaryKey: { color: tokens.tertiary },
      summaryPath: { color: tokens.secondary, wordBreak: 'break-all' },
      summaryNote: {
        margin: 0,
        padding: '8px 10px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        background: tokens.hover,
        fontSize: '12px',
        lineHeight: '18px',
        color: tokens.secondary,
      },
      summaryWarn: {
        margin: 0,
        padding: '8px 10px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        background: tokens.dangerHover,
        fontSize: '12px',
        lineHeight: '18px',
        color: tokens.warn,
      },
      purgeRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '8px 10px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: `1px solid ${tokens.border}`,
        cursor: 'pointer',
      },
      purgeLabel: { display: 'block', fontSize: '13px', color: tokens.label },
      purgeHint: { display: 'block', fontSize: '11px', color: tokens.tertiary, marginTop: '2px' },
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
      danger: {
        padding: '7px 14px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid transparent',
        background: 'var(--dsw-alias-state-warn-fill, #b8541f)',
        color: '#fff',
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
        color: kind === 'error' ? tokens.warn : tokens.secondary,
        background: kind === 'error' ? tokens.dangerHover : tokens.hover,
      }),
    };

    function CleanerDialog({ t, onClose }) {
      const [state, setState] = React.useState('loading');
      const [data, setData] = React.useState(null);
      const [error, setError] = React.useState('');
      const [selected, setSelected] = React.useState(() => new Set());
      const [phase, setPhase] = React.useState('select');
      // Second switch of the confirm step: quarantine (default) or delete outright.
      const [purge, setPurge] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState(null);

      const load = React.useCallback(() => {
        setState('loading');
        setError('');
        readList()
          .then((body) => {
            setData(body);
            setSelected(new Set());
            setPhase('select');
            setPurge(false);
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
          if (event.key === 'Escape' && !busy) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [busy, onClose]);

      const sessions = data?.sessions ?? [];
      const picked = sessions.filter((row) => selected.has(row.id));
      const pickedWithFiles = picked.filter((row) => row.dir !== null);
      const pickedStale = picked.filter((row) => row.dir === null);
      const pickedBytes = picked.reduce((sum, row) => sum + row.bytes, 0);

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
          previous.size === sessions.length && sessions.length > 0
            ? new Set()
            : new Set(sessions.map((row) => row.id)),
        );
      };

      const submit = async () => {
        setBusy(true);
        setNotice(null);
        const mode = purge ? 'purge' : 'quarantine';
        try {
          const result = await clean([...selected], mode);
          const skipped = result.skipped?.length ?? 0;
          const verb = result.mode === 'purge' ? t('deletedVerb') : t('movedVerb');
          const affected = result.mode === 'purge' ? result.deleted.length : result.moved.length;
          const pruned = result.pruned?.length ?? 0;
          const size = formatBytes(result.bytesFreed ?? 0);
          const parts = [`${verb} ${affected} ${t('unit')}${affected > 0 ? ` (${size})` : ''}`];
          if (pruned > 0) parts.push(`${pruned} ${t('entriesDropped')}`);
          if (skipped > 0) parts.push(`${t('skippedWord')} ${skipped}`);
          if (result.trashDir) parts.push(`→ ${result.trashDir}`);
          setNotice({ kind: 'ok', text: `${parts.join(' · ')}. ${t('restartHint')}` });
          load();
        } catch (cause) {
          const failed = mode === 'purge' ? t('purgeFailed') : t('cleanFailed');
          setNotice({ kind: 'error', text: `${failed}: ${String((cause && cause.message) || cause)}` });
        } finally {
          setBusy(false);
        }
      };

      const body =
        state === 'loading'
          ? h('div', { style: styles.notice('ok') }, t('loading'))
          : state === 'failed'
            ? h(
                'div',
                { style: styles.notice('error') },
                `${t('loadFailed')}: ${error} `,
                h('button', { type: 'button', style: styles.linkButton, onClick: load }, t('retry')),
              )
            : sessions.length === 0
              ? h('div', { style: styles.notice('ok') }, t('empty'))
              : phase === 'confirm'
                ? h(
                    'div',
                    { style: styles.summary },
                    h('p', { style: styles.summaryLead }, t('confirmLead')),
                    h('p', { style: styles.summaryValue }, `${picked.length} · ${formatBytes(pickedBytes)}`),
                    pickedStale.length > 0
                      ? h(
                          'p',
                          { style: styles.summaryLead },
                          `${pickedWithFiles.length} ${t('unit')} · ${pickedStale.length} ${t('entriesDropped')}`,
                        )
                      : null,
                    purge
                      ? null
                      : h(
                          'div',
                          { style: styles.summaryRow },
                          h('span', { style: styles.summaryKey }, t('confirmTarget')),
                          h('span', { style: styles.summaryPath }, data?.trashRoot ?? ''),
                        ),
                    h(
                      'label',
                      { style: styles.purgeRow },
                      h('input', {
                        type: 'checkbox',
                        checked: purge,
                        disabled: busy,
                        onChange: () => setPurge(!purge),
                      }),
                      h(
                        'span',
                        null,
                        h('span', { style: styles.purgeLabel }, t('purgeLabel')),
                        h('span', { style: styles.purgeHint }, t('purgeHint')),
                      ),
                    ),
                    h('p', { style: purge ? styles.summaryWarn : styles.summaryNote }, purge ? t('purgeNote') : t('confirmNote')),
                  )
                : h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { style: styles.toolbar },
                      h(
                        'button',
                        { type: 'button', style: styles.linkButton, onClick: toggleAll },
                        selected.size === sessions.length && sessions.length > 0 ? t('clearAll') : t('selectAll'),
                      ),
                      h('span', { style: styles.counter }, `${selected.size} / ${sessions.length} · ${formatBytes(pickedBytes)}`),
                    ),
                    h(
                      'div',
                      { style: styles.list },
                      sessions.map((row) => {
                        const missing = row.dir === null;
                        const label = row.workspace || row.cwd || t('unknownWorkspace');
                        return h(
                          'label',
                          {
                            key: row.id,
                            style: { ...styles.row, opacity: missing ? 0.6 : 1, cursor: 'pointer' },
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
                            h('div', { style: styles.rowTitle, title: label }, `${label}${missing ? ` ${t('missing')}` : ''}`),
                            h('div', { style: styles.rowMeta }, [formatDate(row.createdAt), row.id].filter(Boolean).join(' · ')),
                          ),
                          h('span', { style: styles.rowSize }, formatBytes(row.bytes)),
                        );
                      }),
                    ),
                  );

      // Rendered outside the body branches: after a cleanup that empties the list,
      // the success line must stay visible above the "nothing left" message.
      const noticeNode = notice
        ? h('div', { style: styles.notice(notice.kind === 'error' ? 'error' : 'ok') }, notice.text)
        : null;

      const footer =
        state !== 'ready' || sessions.length === 0
          ? h(
              'div',
              { style: styles.footer },
              h(
                'button',
                { type: 'button', style: styles.button, onClick: onClose },
                sessions.length === 0 && state === 'ready' ? t('close') : t('cancel'),
              ),
            )
          : phase === 'confirm'
            ? h(
                'div',
                { style: styles.footer },
                h('button', { type: 'button', style: styles.button, onClick: () => setPhase('select'), disabled: busy }, t('back')),
                h(
                  'button',
                  {
                    type: 'button',
                    style: { ...styles.danger, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' },
                    disabled: busy,
                    onClick: submit,
                  },
                  busy ? t('confirmBusy') : purge ? t('confirmDelete') : t('confirmNow'),
                ),
              )
            : h(
                'div',
                { style: styles.footer },
                h('button', { type: 'button', style: styles.button, onClick: onClose }, t('cancel')),
                h(
                  'button',
                  {
                    type: 'button',
                    style: {
                      ...styles.primary,
                      opacity: selected.size === 0 ? 0.5 : 1,
                      cursor: selected.size === 0 ? 'default' : 'pointer',
                    },
                    disabled: selected.size === 0,
                    onClick: () => {
                      if (selected.size === 0) {
                        setNotice({ kind: 'error', text: t('emptySelection') });
                        return;
                      }
                      setNotice(null);
                      setPhase('confirm');
                    },
                  },
                  `${t('next')} (${selected.size})`,
                ),
              );

      return ReactDOM.createPortal(
        h(
          'div',
          {
            style: styles.backdrop,
            role: 'presentation',
            onMouseDown: (event) => {
              if (!busy && event.target === event.currentTarget) onClose();
            },
          },
          h(
            'div',
            { style: styles.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('dialogTitle') },
            h(
              'div',
              { style: styles.header },
              h('h2', { style: styles.title }, phase === 'confirm' ? t('confirmTitle') : t('dialogTitle')),
              h('p', { style: styles.intro }, t('dialogIntro')),
            ),
            body,
            noticeNode,
            footer,
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
      const menuRef = React.useRef(null);

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
          // The trigger and the menu are siblings, not nested: testing only the
          // trigger would close the menu on mousedown and swallow the item click.
          if (triggerRef.current?.contains(event.target)) return;
          if (menuRef.current?.contains(event.target)) return;
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
            left: `${Math.max(8, Math.min(anchor.left, window.innerWidth - 300))}px`,
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
        // Portalled: the sidebar footer may sit inside a transformed ancestor,
        // which would make `position: fixed` resolve against it and clip the menu.
        menuOpen
          ? ReactDOM.createPortal(
              h(
                'div',
                { ref: menuRef, style: menuStyle, role: 'menu', 'aria-label': t('menuTitle') },
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
                    h('span', { style: styles.menuHint }, count === 0 ? t('menuEmpty') : t('menuCleanHint')),
                  ),
                  count === null ? null : h('span', { style: styles.menuCount }, String(count)),
                ),
              ),
              document.body,
            )
          : null,
        dialogOpen ? h(CleanerDialog, { t, onClose: () => setDialogOpen(false) }) : null,
      );
    }

    /**
     * Secondary entry point in Settings → General. Kept because the sidebar
     * footer seat is newer than the settings row slot: when a host renders the
     * footer differently, this row still reaches the same dialog.
     */
    function SettingsRow({ t }) {
      const [open, setOpen] = React.useState(false);
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '16px 0',
            borderBottom: `1px solid ${tokens.border}`,
          },
        },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0px' } },
          h('div', { style: { fontSize: '14px', color: tokens.label } }, t('dialogTitle')),
          h('div', { style: { fontSize: '12px', color: tokens.secondary } }, t('menuCleanHint')),
        ),
        h(
          'button',
          {
            type: 'button',
            style: {
              flex: '0 0 auto',
              padding: '6px 14px',
              fontSize: '13px',
              borderRadius: 'var(--dsw-radius-sm, 8px)',
              border: `1px solid ${tokens.border}`,
              background: 'transparent',
              color: tokens.label,
              cursor: 'pointer',
            },
            onClick: () => setOpen(true),
          },
          t('action'),
        ),
        open ? h(CleanerDialog, { t, onClose: () => setOpen(false) }) : null,
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

      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          { name: 'settings.general.item', id: 'archive-cleaner', order: 45 },
          (props) => h(SettingsRow, { ...props, t }),
        ),
      );
    }

    return { inject, apply };
  },
});
