import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { countdownParts, team } from '../lib/format';
import { useNow, useTeamNames } from '../lib/hooks';
import type { Color } from '../shared/types';
import type { Region } from '../shared/teams';
import { useT } from '../i18n';

export function Spinner({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 muted text-sm" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
      {label ?? t('Loading…')}
    </div>
  );
}

export function Skeleton({ h = 18, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card card-pad text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="muted mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
      {children}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'gold' | 'warn' }) {
  const cls =
    tone === 'gold'
      ? 'border-[rgba(224,179,65,0.4)] bg-[rgba(224,179,65,0.08)] text-amber-100'
      : tone === 'warn'
        ? 'border-orange-500/40 bg-orange-500/10 text-orange-100'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-100';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="muted mt-1 text-sm sm:text-base">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function GuildTag({ tag, id }: { tag: string; id?: string }) {
  const inner = <span className="tag">[{tag || '?'}]</span>;
  return id ? (
    <Link to={`/guilds/${id}`} className="hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function TeamChip({ teamId, color, region }: { teamId: number | null; color?: Color | null; region?: Region | null }) {
  const names = useTeamNames();
  const cls = color === 'red' ? 'chip-red' : color === 'blue' ? 'chip-blue' : color === 'green' ? 'chip-green' : '';
  return (
    <span className={`chip ${cls}`} title={teamId ? `Team ${teamId}` : undefined}>
      {team(teamId, names)}
      {region && <span className="opacity-60">{region.toUpperCase()}</span>}
    </span>
  );
}

export function TeamName({ id }: { id: number | null | undefined }) {
  const names = useTeamNames();
  return <>{id ? team(id, names) : '—'}</>;
}

export function LiveBadge() {
  return (
    <span className="chip chip-live">
      <span className="live-dot" /> LIVE
    </span>
  );
}

export function Countdown({ to, label }: { to: string | number | null | undefined; label: string }) {
  const t = useT();
  const now = useNow(1000);
  if (!to) return null;
  const ms = typeof to === 'number' ? to : Date.parse(to);
  if (!Number.isFinite(ms)) return null;
  const c = countdownParts(ms, now);
  const cell = (v: number, u: string) => (
    <div className="min-w-[3.1rem] rounded-lg bg-[var(--bg-2)] px-2 py-1.5 text-center">
      <div className="font-mono text-xl font-bold tabular-nums">{String(v).padStart(2, '0')}</div>
      <div className="faint text-[0.65rem] uppercase tracking-wider">{u}</div>
    </div>
  );
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex gap-1.5">
        {cell(c.d, t('days'))}
        {cell(c.h, t('hrs'))}
        {cell(c.m, t('min'))}
        {cell(c.s, t('sec'))}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(560px,92vw)] rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-0 text-[var(--ink)] backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <h3 className="font-bold">{title}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('Close')}>

          ✕
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

export function ChipToggle<T extends string>({
  options,
  value,
  onChange,
  max,
}: {
  options: readonly { id: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            className="chip"
            aria-pressed={on}
            onClick={() => {
              if (on) onChange(value.filter((v) => v !== o.id));
              else if (!max || value.length < max) onChange([...value, o.id]);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--bg-2)] p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold transition ${
            value === o.id ? 'bg-[var(--gold)] text-[var(--gold-ink)]' : 'muted hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--bg-2)] px-3 py-2.5">
      <div className="faint text-[0.7rem] font-semibold uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
      {hint && <div className="faint text-xs">{hint}</div>}
    </div>
  );
}
