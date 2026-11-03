/**
 * Feedback tab. Verified members send a bug report / feature request / like /
 * feedback / dislike and see their own threads with the hub team's replies
 * (and can follow up). Admins get a second view with every thread: reply, set
 * a status, delete replies or whole threads. Server: polyvote/functions/src/wvw/feedback.ts.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Notice, PageHeader, Segmented, Skeleton } from '../components/ui';
import { useDocumentTitle, useTeamNames } from '../lib/hooks';
import { call, errorMessage } from '../firebase';
import { isAdmin, isVerified, useStore } from '../store';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, LIMITS, labelOf, type FeedbackKind, type FeedbackStatus } from '../shared/constants';
import type { AdminFeedbackRow, FeedbackMessage, FeedbackRow } from '../shared/types';
import { fmtDateTime, relative, team } from '../lib/format';
import { useT } from '../i18n';

const KIND_ICON: Record<FeedbackKind, string> = { bug: '🐞', feature: '💡', like: '👍', feedback: '💬', dislike: '👎' };
const STATUS_CHIP: Record<FeedbackStatus, string> = {
  open: 'chip-blue',
  acknowledged: '',
  planned: 'chip-gold',
  done: 'chip-green',
  declined: 'chip-red',
};

function Chips({ f }: { f: FeedbackRow }) {
  const t = useT();
  return (
    <>
      <span className="chip">
        {KIND_ICON[f.kind]} {t(labelOf(FEEDBACK_KINDS, f.kind))}
      </span>
      <span className={`chip ${STATUS_CHIP[f.status]}`}>{t(labelOf(FEEDBACK_STATUSES, f.status))}</span>
    </>
  );
}

/** Original message + replies. `onDeleteReply` (admins) removes one reply by index. */
function Thread({ f, onDeleteReply }: { f: FeedbackRow; onDeleteReply?: (index: number) => void }) {
  const t = useT();
  const tz = useStore((s) => s.displayTz);
  const msg = (m: FeedbackMessage, i: number) => (
    <li key={`${m.at}-${i}`} className={`rounded-lg px-3 py-2 text-sm ${m.by === 'admin' ? 'border border-[rgba(224,179,65,0.35)] bg-[rgba(224,179,65,0.07)]' : 'bg-[var(--bg-2)]'}`}>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
        <span className={m.by === 'admin' ? 'font-bold text-[var(--gold)]' : 'faint'}>{m.by === 'admin' ? `🛡️ ${t('WvW Hub team')}` : onDeleteReply ? t('Author') : t('You')}
</span>
        <span className="faint flex items-center gap-2">
          {fmtDateTime(m.at, tz)}
          {onDeleteReply && m.by === 'admin' && (
            <button type="button" className="text-red-300 hover:underline" onClick={() => onDeleteReply(i)}>
              {t('Delete')}
            </button>
          )}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{m.text}</p>
    </li>
  );
  return (
    <div className="grid gap-2">
      <p className="whitespace-pre-wrap text-sm">{f.text}</p>
      {f.thread.length > 0 && <ul className="grid gap-1.5">{f.thread.map(msg)}</ul>}
    </div>
  );
}

function ReplyBox({ onSend, placeholder, extra, busy }: { onSend: (text: string) => Promise<boolean>; placeholder: string; extra?: ReactNode; busy: boolean }) {
  const t = useT();
  const [text, setText] = useState('');
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSend(text.trim())) setText('');
      }}
    >
      <textarea className="textarea min-h-[4rem] text-sm" maxLength={LIMITS.feedbackMax} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {extra}
        <button className="btn btn-sm btn-gold" disabled={busy || (!text.trim() && !extra)}>
          {t('Send')}
        </button>
      </div>
    </form>
  );
}

function MyFeedback() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const tz = useStore((s) => s.displayTz);
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [kind, setKind] = useState<FeedbackKind>('feedback');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    call<{ feedback: FeedbackRow[] }>('listMyFeedback')
      .then((r) => setRows(r.feedback))
      .catch((e) => {
        setError(errorMessage(e));
        setRows([]);
      });
  }, []);
  useEffect(load, [load]);

  const send = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await call<{ feedback: FeedbackRow }>('submitFeedback', { kind, text: text.trim() });
      setRows([r.feedback, ...(rows ?? [])]);
      setText('');
      toast(t('Thanks! Your feedback was sent.'), 'ok');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const followUp = async (f: FeedbackRow, msg: string) => {
    if (!msg) return false;
    setBusy(true);
    try {
      const r = await call<{ feedback: FeedbackRow }>('replyMyFeedback', { id: f.id, text: msg });
      setRows((rows ?? []).map((x) => (x.id === f.id ? r.feedback : x)));
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: FeedbackRow) => {
    if (!confirm(t('Delete this feedback thread?'))) return;
    try {
      await call('deleteMyFeedback', { id: f.id });
      setRows((rows ?? []).filter((x) => x.id !== f.id));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="grid gap-5">
      <form onSubmit={send} className="card card-pad grid gap-3">
        <h2 className="font-bold">{t('Send feedback')}</h2>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('Kind')}>
          {FEEDBACK_KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="chip !px-3 !py-1.5 text-sm" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {KIND_ICON[k.id]} {t(k.label)}
            </button>
          ))}
        </div>
        <textarea
          className="textarea min-h-[8rem]"
          maxLength={LIMITS.feedbackMax}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('What happened, what would you like, what do you think? The more detail, the better.')}
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="faint text-xs">
            {text.length} / {LIMITS.feedbackMax} · {t('Only the hub admins read this.')}
          </span>
          <button className="btn btn-gold" disabled={busy || !text.trim()}>
            {busy ? t('Sending…') : t('Send')}
          </button>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </form>

      <section className="grid gap-3">
        <h2 className="font-bold">{t('Your feedback')}</h2>
        {rows === null ? (
          <Skeleton h={120} />
        ) : !rows.length ? (
          <Empty title={t('No feedback yet')}>{t('Your messages and the team’s replies show up here.')}</Empty>
        ) : (
          rows.map((f) => (
            <article key={f.id} className={`card card-pad grid gap-3 ${f.unread ? 'border-[var(--gold)]' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Chips f={f} />
                {f.unread && <span className="chip chip-gold">✉️ {t('new reply')}</span>}
                <span className="faint ml-auto text-xs" title={fmtDateTime(f.createdAt, tz)}>
                  {relative(f.createdAt)}
                </span>
              </div>
              <Thread f={f} />
              <details>
                <summary className="cursor-pointer text-sm font-semibold">{t('Reply')}</summary>
                <div className="mt-2">
                  <ReplyBox busy={busy} onSend={(m) => followUp(f, m)} placeholder={t('Add a follow-up…')} />
                </div>
              </details>
              <div className="flex justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => remove(f)}>
                  🗑 {t('Delete')}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function AllFeedback() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const tz = useStore((s) => s.displayTz);
  const names = useTeamNames();
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [kind, setKind] = useState<FeedbackKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminFeedbackRow[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState<Record<string, FeedbackStatus>>({});

  const load = useCallback(() => {
    call<{ feedback: AdminFeedbackRow[] }>('modListFeedback', { status: status === 'all' ? null : status })
      .then((r) => {
        setRows(r.feedback);
        setSel(new Set());
      })
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setRows([]);
      });
  }, [status, toast]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (f) =>
        (kind === 'all' || f.kind === kind) &&
        (!needle || [f.text, f.accountName ?? '', ...f.thread.map((m) => m.text)].some((x) => x.toLowerCase().includes(needle))),
    );
  }, [rows, kind, q]);

  const replace = (f: AdminFeedbackRow) => setRows((rows ?? []).map((x) => (x.id === f.id ? f : x)));
  const act = async <R,>(fn: () => Promise<R>, ok?: string): Promise<R | null> => {
    setBusy(true);
    try {
      const r = await fn();
      if (ok) toast(ok, 'ok');
      return r;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const reply = async (f: AdminFeedbackRow, text: string) => {
    const st = nextStatus[f.id];
    const r = await act(() => call<{ feedback: AdminFeedbackRow }>('modReplyFeedback', { id: f.id, text, status: st ?? null }), t('Saved.'));
    if (r) replace(r.feedback);
    return !!r;
  };
  const removeThreads = async (ids: string[]) => {
    if (!ids.length || !confirm(t('Delete {n} feedback thread(s)?', { n: ids.length }))) return;
    const r = await act(() => call('modDeleteFeedback', { ids }), t('Deleted.'));
    if (r) setRows((rows ?? []).filter((x) => !ids.includes(x.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
  };
  const unreadCount = (rows ?? []).filter((f) => f.unreadForAdmin).length;

  return (
    <div className="grid gap-4">
      <div className="card card-pad flex flex-wrap items-end gap-3">
        <label>
          <span className="label">{t('Status')}</span>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus | 'all')}>
            <option value="all">{t('All')}</option>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">{t('Kind')}</span>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind | 'all')}>
            <option value="all">{t('All')}</option>
            {FEEDBACK_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {KIND_ICON[k.id]} {t(k.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[14rem] flex-1">
          <span className="label">{t('Search')}</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Text or account…')} />
        </label>
        <button className="btn btn-sm" onClick={load} disabled={busy}>
          ↻ {t('Refresh')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="muted">
          {t(shown.length === 1 ? '{n} thread' : '{n} threads', { n: shown.length })} · {t('{n} unread', { n: unreadCount })}
        </span>
        {sel.size > 0 && (
          <>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeThreads([...sel])}>
              🗑 {t('Delete selected')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>
              {t('Clear selection')}
            </button>
          </>
        )}
      </div>

      {rows === null ? (
        <Skeleton h={200} />
      ) : !shown.length ? (
        <Empty title={t('No feedback matches')} />
      ) : (
        shown.map((f) => (
          <article key={f.id} className={`card card-pad grid gap-3 ${f.unreadForAdmin ? 'border-[var(--gold)]' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="checkbox" aria-label={t('Select')} checked={sel.has(f.id)} onChange={() => toggle(f.id)} />
              <Chips f={f} />
              {f.unreadForAdmin && <span className="chip chip-gold">● {t('unread')}</span>}
              <span className="font-mono text-xs">{f.accountName ?? '—'}</span>
              {f.teamId && <span className="faint text-xs">{team(f.teamId, names)}</span>}
              <span className="faint ml-auto text-xs" title={fmtDateTime(f.createdAt, tz)}>
                {relative(f.createdAt)}
              </span>
            </div>
            <Thread
              f={f}
              onDeleteReply={async (index) => {
                if (!confirm(t('Delete this reply?'))) return;
                const r = await act(() => call<{ feedback: AdminFeedbackRow }>('modDeleteFeedbackReply', { id: f.id, index }));
                if (r) replace(r.feedback);
              }}
            />
            <ReplyBox
              busy={busy}
              onSend={(text) => reply(f, text)}
              placeholder={t('Reply as the WvW Hub team (the author sees it on their Feedback tab)…')}
              extra={
                <select
                  className="select !w-auto !py-1 text-sm"
                  aria-label={t('Status')}
                  value={nextStatus[f.id] ?? f.status}
                  onChange={(e) => setNextStatus({ ...nextStatus, [f.id]: e.target.value as FeedbackStatus })}
                >
                  {FEEDBACK_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t(s.label)}
                    </option>
                  ))}
                </select>
              }
            />
            <div className="flex flex-wrap justify-end gap-2">
              {f.unreadForAdmin && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={async () => (await act(() => call('modMarkFeedbackRead', { id: f.id }))) && replace({ ...f, unreadForAdmin: false })}
                >
                  ✓ {t('Mark read')}
                </button>
              )}
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeThreads([f.id])}>
                🗑 {t('Delete thread')}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

export default function Feedback() {
  const t = useT();
  useDocumentTitle(t('Feedback'));
  const member = useStore((s) => s.member);
  const memberReady = useStore((s) => s.memberReady);
  const admin = isAdmin(member);
  const verified = isVerified(member);
  const [tab, setTab] = useState<'mine' | 'all'>(admin && !verified ? 'all' : 'mine');

  if (!memberReady) return <Skeleton h={300} />;
  if (!verified && !admin) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t('Feedback')} />
        <Notice tone="warn">
          {t('Feedback is open to members verified with a GW2 API key.')}{' '}
          <Link to="/account" className="underline">
            {t('Sign in →')}
          </Link>
        </Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('Feedback')} sub={t('Found a bug, missing a feature, or just want to tell us what you think? We read everything and reply here.')} />
      {admin && (
        <div className="mb-4">
          <Segmented
            options={[
              ...(verified ? [{ id: 'mine' as const, label: t('My feedback') }] : []),
              { id: 'all' as const, label: `🛡️ ${t('All feedback (admin)')}` },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      )}
      {tab === 'all' && admin ? <AllFeedback /> : <MyFeedback />}
    </div>
  );
}
