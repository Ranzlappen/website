import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, PageHeader, Segmented, Skeleton } from '../components/ui';
import { useDocumentTitle, useGuildIndex, useMatches, useTeamNames } from '../lib/hooks';
import { relative, team } from '../lib/format';
import { LANGUAGES, PLAYSTYLES, labelOf, type Language, type Playstyle } from '../shared/constants';
import { COLORS } from '../shared/types';
import type { Region } from '../shared/teams';
import { useStore } from '../store';

type Sort = 'activity' | 'held' | 'tag' | 'upcoming';

export default function Guilds() {
  useDocumentTitle('Guilds');
  const member = useStore((s) => s.member);
  const names = useTeamNames();
  const [region, setRegion] = useState<Region>(member?.region ?? 'eu');
  const [q, setQ] = useState('');
  const [teamSel, setTeamSel] = useState('all');
  const [style, setStyle] = useState<Playstyle | 'all'>('all');
  const [lang, setLang] = useState<Language | 'all'>('all');
  const [recruiting, setRecruiting] = useState(false);
  const [sort, setSort] = useState<Sort>('activity');
  const { data, loading, error } = useGuildIndex(region);
  const matches = useMatches();

  const teams = useMemo(() => {
    const ids = new Set<number>();
    for (const m of matches.data?.matches ?? []) if (m.region === region) for (const c of COLORS) if (m.sides[c].teamId) ids.add(m.sides[c].teamId!);
    return [...ids].sort((a, b) => team(a, names).localeCompare(team(b, names)));
  }, [matches.data, region, names]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (data?.guilds ?? []).filter(
      (g) =>
        (!needle || g.tag.toLowerCase().includes(needle) || g.name.toLowerCase().includes(needle)) &&
        (teamSel === 'all' || String(g.teamId) === teamSel) &&
        (style === 'all' || g.playstyles.includes(style)) &&
        (lang === 'all' || g.languages.includes(lang)) &&
        (!recruiting || g.recruiting),
    );
    const by: Record<Sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      activity: (a, b) => b.claims4w - a.claims4w,
      held: (a, b) => b.heldNow - a.heldNow,
      tag: (a, b) => a.tag.localeCompare(b.tag),
      upcoming: (a, b) => b.upcoming - a.upcoming,
    };
    return [...list].sort(by[sort]);
  }, [data, q, teamSel, style, lang, recruiting, sort]);

  return (
    <div>
      <PageHeader
        title="Guild directory"
        sub="Active WvW guilds, from public objective claims and verified guild pages. Activity = objectives claimed in the last 4 weeks."
        actions={<Segmented options={[{ id: 'eu', label: 'EU' }, { id: 'na', label: 'NA' }]} value={region} onChange={(r) => { setRegion(r); setTeamSel('all'); }} />}
      />
      <div className="card card-pad mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="lg:col-span-2">
          <span className="label">Search</span>
          <input className="input" placeholder="Tag or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="label">Team</span>
          <select className="select" value={teamSel} onChange={(e) => setTeamSel(e.target.value)}>
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {team(t, names)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Playstyle</span>
          <select className="select" value={style} onChange={(e) => setStyle(e.target.value as Playstyle | 'all')}>
            <option value="all">Any</option>
            {PLAYSTYLES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Language</span>
          <select className="select" value={lang} onChange={(e) => setLang(e.target.value as Language | 'all')}>
            <option value="all">Any</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recruiting} onChange={(e) => setRecruiting(e.target.checked)} /> Recruiting
          </label>
          <select className="select !py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="activity">Sort: activity</option>
            <option value="held">Sort: holding now</option>
            <option value="upcoming">Sort: upcoming raids</option>
            <option value="tag">Sort: tag A–Z</option>
          </select>
        </div>
      </div>

      {error && <ErrorBox>Could not load guilds: {error}</ErrorBox>}
      {loading ? (
        <Skeleton h={400} />
      ) : rows.length === 0 ? (
        <Empty title="No guilds match">The directory fills automatically from objective claims every few minutes.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Guild</th>
                <th>Team</th>
                <th className="text-right">Claims (4w)</th>
                <th className="text-right">Holding</th>
                <th className="text-right">Raids</th>
                <th>Style</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link to={`/guilds/${g.id}`} className="hover:underline">
                      <span className="tag">[{g.tag}]</span> {g.name}
                    </Link>
                    <span className="ml-1.5 inline-flex gap-1">
                      {g.claimed && <span className="chip chip-gold" title="Claimed by its verified guild leader">✓</span>}
                      {g.recruiting && <span className="chip chip-green">recruiting</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{team(g.teamId, names)}</td>
                  <td className="text-right tabular-nums">{g.claims4w}</td>
                  <td className="text-right tabular-nums">{g.heldNow || '—'}</td>
                  <td className="text-right tabular-nums">{g.upcoming || '—'}</td>
                  <td className="faint text-xs">{g.playstyles.map((p) => labelOf(PLAYSTYLES, p)).join(', ') || '—'}</td>
                  <td className="faint whitespace-nowrap text-xs">{g.lastSeenAt ? relative(g.lastSeenAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 300 && <p className="faint px-4 py-2 text-xs">Showing 300 of {rows.length} — refine the filters.</p>}
        </div>
      )}
    </div>
  );
}
