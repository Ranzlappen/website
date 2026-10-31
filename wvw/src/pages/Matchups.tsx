import { useState } from 'react';
import { Countdown, PageHeader, Segmented, Skeleton, TeamName, ErrorBox } from '../components/ui';
import { useDocumentTitle, useMatches } from '../lib/hooks';
import { compact, kd, relative } from '../lib/format';
import { COLORS, type Color, type MatchSummary } from '../shared/types';
import type { Region } from '../shared/teams';
import { useStore } from '../store';

const MAP_LABEL: Record<string, string> = {
  Center: 'Eternal Battlegrounds',
  RedHome: 'Red Borderlands',
  BlueHome: 'Blue Borderlands',
  GreenHome: 'Green Borderlands',
};

function Bar({ match, field }: { match: MatchSummary; field: 'victoryPoints' | 'score' | 'kills' }) {
  const total = COLORS.reduce((s, c) => s + match.sides[c][field], 0) || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--bg-2)]" aria-hidden>
      {COLORS.map((c) => (
        <div key={c} className={`bar-${c}`} style={{ width: `${(match.sides[c][field] / total) * 100}%` }} />
      ))}
    </div>
  );
}

function MatchCard({ m, guildCounts, myTeam }: { m: MatchSummary; guildCounts: Record<string, number>; myTeam: number | null }) {
  const [open, setOpen] = useState(false);
  const order = [...COLORS].sort((a, b) => m.sides[b].victoryPoints - m.sides[a].victoryPoints);
  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Tier {m.id.split('-')[1]}</h2>
        <span className="faint text-xs">ends {relative(Date.parse(m.end))}</span>
      </div>
      <Bar match={m} field="victoryPoints" />
      <div className="mt-3 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th className="text-right">VP</th>
              <th className="text-right">Score</th>
              <th className="text-right">K/D</th>
              <th className="text-right" title="Camps / towers / keeps / castle owned">Owned</th>
              <th className="text-right" title="Distinct guilds holding a claim right now">Claims</th>
              <th className="text-right" title="Guilds that selected this team's WvW guild">Guilds</th>
            </tr>
          </thead>
          <tbody>
            {order.map((c: Color) => {
              const s = m.sides[c];
              return (
                <tr key={c}>
                  <td className={`side-${c} font-semibold`}>
                    ● <TeamName id={s.teamId} />
                    {s.teamId === myTeam && <span className="chip chip-gold ml-1.5">you</span>}
                  </td>
                  <td className="text-right font-bold tabular-nums">{s.victoryPoints}</td>
                  <td className="text-right tabular-nums">{compact(s.score)}</td>
                  <td className="text-right tabular-nums">{kd(s.kills, s.deaths)}</td>
                  <td className="text-right tabular-nums faint">
                    {s.owned.camps}/{s.owned.towers}/{s.owned.keeps}/{s.owned.castles}
                  </td>
                  <td className="text-right tabular-nums">{s.claimingGuilds}</td>
                  <td className="text-right tabular-nums faint">{s.teamId ? guildCounts[String(s.teamId)] ?? '—' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost btn-sm mt-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '▾' : '▸'} Per map
      </button>
      {open && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {m.maps.map((map) => (
            <div key={map.type} className="rounded-xl bg-[var(--bg-2)] p-3">
              <div className="mb-1.5 text-sm font-semibold">{MAP_LABEL[map.type] ?? map.type}</div>
              {COLORS.map((c) => (
                <div key={c} className="flex justify-between text-xs">
                  <span className={`side-${c}`}>
                    ● <TeamName id={m.sides[c].teamId} />
                  </span>
                  <span className="tabular-nums">
                    {compact(map.kills[c])} K · {compact(map.deaths[c])} D · {kd(map.kills[c], map.deaths[c])}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Matchups() {
  useDocumentTitle('Matchups');
  const member = useStore((s) => s.member);
  const [region, setRegion] = useState<Region>(member?.region ?? 'eu');
  const { data, loading, error } = useMatches();
  const list = (data?.matches ?? []).filter((m) => m.region === region);
  return (
    <div>
      <PageHeader
        title="Matchups"
        sub={data ? `Live from the GW2 API · updated ${relative(data.updatedAt)}` : 'Live from the GW2 API'}
        actions={<Segmented options={[{ id: 'eu', label: 'EU' }, { id: 'na', label: 'NA' }]} value={region} onChange={setRegion} />}
      />
      {error && <ErrorBox>Could not load matchups: {error}</ErrorBox>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card card-pad">
          <Countdown to={data?.timers.teamAssignment[region]} label="Next relink (team assignment)" />
        </div>
        <div className="card card-pad">
          <Countdown to={data?.timers.lockout[region]} label="WvW guild selection lockout" />
        </div>
        <div className="card card-pad">
          <Countdown to={list[0]?.end} label="Weekly reset" />
        </div>
      </div>
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton h={260} />
          <Skeleton h={260} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((m) => (
            <MatchCard key={m.id} m={m} guildCounts={data?.teamGuildCounts ?? {}} myTeam={member?.teamId ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
