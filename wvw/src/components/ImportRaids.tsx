/**
 * Moderation → Import: the seed pipeline for the calendar (admin only).
 *
 * Paste a CSV (Google Sheets → File → Download → CSV, Excel "CSV UTF-8", or
 * copy the cells straight out of the sheet — tab-separated works too), check
 * the server's preview, then import. Re-importing the same sheet updates the
 * raids it created instead of duplicating them. Server: `wvw-adminImportEvents`
 * (polyvote/functions/src/wvw/import.ts).
 */
import { useState } from 'react';
import { ErrorBox, Notice } from './ui';
import { call, errorMessage } from '../firebase';
import { useStore } from '../store';
import { IMPORT_COLUMNS, IMPORT_TEMPLATE, csvToObjects } from '../shared/csv';
import { EVENT_TYPES, labelOf } from '../shared/constants';
import type { ImportRowResult } from '../shared/types';
import { team } from '../lib/format';
import { useTeamNames } from '../lib/hooks';
import { mapLabel } from './MapPicker';
import { useT } from '../i18n';

interface Result {
  dryRun: boolean;
  rows: ImportRowResult[];
  created: number;
  updated: number;
  errors: number;
}

const COLUMN_HELP: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  guild: 'Exact guild name or guild GUID (required)',
  title: 'Raid title (default: the type)',
  type: EVENT_TYPES.map((t) => t.id).join(' / '),
  map: 'ebg / red / blue / green / jumper',
  days: 'Weekly days, e.g. "mon,wed" or "Mo,Mi" — empty for one-off',
  date: 'One-off date (YYYY-MM-DD or DD.MM.YYYY), or start of a weekly series',
  time: 'Start time HH:MM in the time zone below (required)',
  timezone: 'IANA zone, e.g. Europe/Berlin (default UTC)',
  duration: 'Minutes, or 2h / 1h30 (default 120)',
  languages: 'en, de, fr, es, pl, it, pt, ru (default en)',
  audience: 'everyone / team (default everyone)',
  openness: 'open / guild / invite (default open)',
  team: 'Team id override (11xxx NA, 12xxx EU) — else taken from the guild’s in-game WvW team',
};

export function ImportRaids() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const names = useTeamNames();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const rowsLocal = csv.trim() ? csvToObjects(csv).length : 0;

  const send = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await call<Result>('adminImportEvents', { csv, dryRun });
      setResult(r);
      if (!dryRun) toast(t('Imported: {c} new, {u} updated.', { c: r.created, u: r.updated }), 'ok');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([IMPORT_TEMPLATE + '\n'], { type: 'text/csv' }));
    a.download = 'wvw-hub-raids-template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="grid gap-4">
      <Notice>
        {t('Seed the calendar from schedules guilds already publish (commander sheets, guild Discord / forum / Reddit posts). Imported raids show as “listed by moderators” — never ✓ official — follow their guild’s WvW team after relinks, and any verified member of the guild can edit one to take it over.')}
      </Notice>
      <div className="card card-pad grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{t('Paste CSV')}</h2>
          <div className="flex gap-2">
            <button className="btn btn-sm" type="button" onClick={download}>
              ⬇ {t('Template')}
            </button>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => setCsv(IMPORT_TEMPLATE)}>
              {t('Fill example')}
            </button>
          </div>
        </div>
        <textarea
          className="textarea min-h-[12rem] font-mono text-xs"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setResult(null);
          }}
          placeholder={IMPORT_COLUMNS.join(',')}
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="faint text-xs">{t('{n} data rows · comma, semicolon or tab separated · max 300 rows', { n: rowsLocal })}</span>
          <div className="flex gap-2">
            <button className="btn" disabled={busy || !rowsLocal} onClick={() => send(true)}>
              {busy ? t('Checking…') : t('Preview')}
            </button>
            <button className="btn btn-gold" disabled={busy || !result || !result.dryRun || !(result.created + result.updated)} onClick={() => send(false)}>
              {t('Import {n} raids', { n: result ? result.created + result.updated : 0 })}
            </button>
          </div>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      {result && (
        <div className="card overflow-x-auto">
          <div className="flex flex-wrap gap-2 px-4 pt-3 text-sm">
            <span className="chip chip-green">{t('{n} new', { n: result.created })}</span>
            <span className="chip chip-blue">{t('{n} updated', { n: result.updated })}</span>
            <span className="chip chip-red">{t('{n} errors', { n: result.errors })}</span>
            {!result.dryRun && <span className="chip chip-gold">✓ {t('imported')}</span>}
          </div>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="faint uppercase">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t('Status')}</th>
                <th className="px-3 py-2">{t('Guild')}</th>
                <th className="px-3 py-2">{t('Team')}</th>
                <th className="px-3 py-2">{t('Title')}</th>
                <th className="px-3 py-2">{t('Map')}</th>
                <th className="px-3 py-2">{t('When')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.rows.map((r) => (
                <tr key={r.line} className={r.status === 'error' ? 'bg-red-500/5' : ''}>
                  <td className="faint px-3 py-1.5">{r.line}</td>
                  <td className="px-3 py-1.5">
                    {r.status === 'error' ? <span className="text-red-300">✗ {r.error}</span> : r.status === 'create' ? t('new') : t('update')}
                  </td>
                  <td className="px-3 py-1.5">{r.guildTag ? `[${r.guildTag}] ${r.guildName}` : '—'}</td>
                  <td className="px-3 py-1.5">{r.teamId ? team(r.teamId, names) : '—'}</td>
                  <td className="px-3 py-1.5">
                    {r.title}
                    {r.type && <span className="faint"> · {t(labelOf(EVENT_TYPES, r.type))}</span>}
                    {r.audience === 'team' && ' 🔒'}
                  </td>
                  <td className="px-3 py-1.5">{r.map ? mapLabel(r.map, t, undefined, undefined, true) : '—'}</td>
                  <td className="px-3 py-1.5">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="card card-pad text-sm">
        <summary className="cursor-pointer font-bold">{t('Columns')}</summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-[8rem_1fr]">
          {IMPORT_COLUMNS.map((c) => (
            <div key={c} className="contents">
              <dt className="font-mono text-[var(--gold)]">{c}</dt>
              <dd className="muted">{COLUMN_HELP[c]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
