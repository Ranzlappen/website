/**
 * Visual WvW map picker.
 *
 * A dropdown lists the maps of the current matchup (EBG + the three
 * borderlands, labelled with the team whose home they are) — each option shows
 * its own map — plus "Jumper" for cross-map play. The chosen map is shown
 * large and split into thirds, one per team colour (nearest team spawn); a
 * click on a third selects it ("ebg:red", "blue:green", …).
 *
 * Map images are curated from tiles.guildwars2.com by scripts/build-maps.py
 * and served from our own origin (no requests to ArenaNet from the browser).
 *
 * mode="pick"   → value is a zone id ("ebg:red" | "jumper")
 * mode="filter" → value may also be a whole map ("ebg") or null (all maps)
 */
import { useEffect, useRef, useState } from 'react';
import MAPDATA from '../lib/wvwMaps.json';
import { WVW_MAPS, type Third, type WvwMapId } from '../shared/constants';
import type { Color } from '../shared/types';
import { team } from '../lib/format';
import { useTeamNames } from '../lib/hooks';

type MapInfo = (typeof MAPDATA)['maps']['ebg'];
const DATA = MAPDATA.maps as Record<WvwMapId, MapInfo>;
const BASE = import.meta.env.BASE_URL;
const FILL: Record<Third, string> = { red: '229,83,75', blue: '74,144,217', green: '79,191,106' };
const ORDER: WvwMapId[] = ['ebg', 'red', 'blue', 'green'];

export function zoneParts(v: string | null | undefined): { map: WvwMapId | null; third: Third | null; jumper: boolean } {
  if (!v) return { map: null, third: null, jumper: false };
  if (v === 'jumper') return { map: null, third: null, jumper: true };
  const [map, third] = v.split(':') as [WvwMapId, Third | undefined];
  return { map: DATA[map] ? map : null, third: third ?? null, jumper: false };
}

/** Does an event's zone match a filter value (null = all, "ebg" = whole map, "ebg:red", "jumper")? */
export function zoneMatches(filter: string | null, zone: string | null | undefined): boolean {
  if (!filter) return true;
  if (!zone) return false;
  if (filter === zone) return true;
  return !filter.includes(':') && filter !== 'jumper' && zone.startsWith(`${filter}:`);
}

export function zoneLabel(v: string | null | undefined, sides?: Partial<Record<Color, number | null>>, names?: Record<string, string>): string {
  const z = zoneParts(v);
  if (z.jumper) return 'Jumper — cross-map';
  if (!z.map) return 'All maps';
  const m = WVW_MAPS.find((x) => x.id === z.map)!;
  const home = z.map !== 'ebg' && sides?.[z.map as Color] ? ` (${team(sides[z.map as Color], names)})` : '';
  return z.third ? `${m.short}${home} · ${z.third} third` : `${m.label}${home}`;
}

function Thumb({ map, size = 44 }: { map: WvwMapId; size?: number }) {
  return (
    <img
      src={`${BASE}${DATA[map].image}`}
      alt=""
      loading="lazy"
      className="rounded-md border border-[var(--border)] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function JumperThumb({ size = 44 }: { size?: number }) {
  return (
    <span className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--border)]" style={{ width: size, height: size }}>
      {ORDER.map((m) => (
        <img key={m} src={`${BASE}${DATA[m].image}`} alt="" loading="lazy" className="h-full w-full object-cover" />
      ))}
    </span>
  );
}

/** Small read-only map with one third highlighted (event pages, cards). */
export function MapThumb({ zone, size = 160 }: { zone: string | null | undefined; size?: number }) {
  const z = zoneParts(zone);
  if (z.jumper) return <JumperThumb size={size} />;
  if (!z.map) return null;
  const m = DATA[z.map];
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--border)]" style={{ width: size, aspectRatio: `${m.width} / ${m.height}` }}>
      <img src={`${BASE}${m.image}`} alt={m.name} className="absolute inset-0 h-full w-full" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {(Object.keys(m.thirds) as Third[]).map((t) => (
          <polygon
            key={t}
            points={m.thirds[t].polygon.map((p) => p.join(',')).join(' ')}
            fill={`rgba(${FILL[t]},${t === z.third ? 0.5 : 0.08})`}
            stroke={t === z.third ? 'white' : 'rgba(255,255,255,0.25)'}
            strokeWidth={t === z.third ? 0.006 : 0.003}
          />
        ))}
      </svg>
    </div>
  );
}

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  mode?: 'pick' | 'filter';
  /** Team ids per colour in the viewer's current matchup (labels the borderlands). */
  sides?: Partial<Record<Color, number | null>>;
  /** The viewer's own colour this week (marked "you"). */
  myColor?: Color | null;
}

export function MapPicker({ value, onChange, mode = 'pick', sides, myColor }: Props) {
  const names = useTeamNames();
  const z = zoneParts(value);
  const [browse, setBrowse] = useState<WvwMapId | 'jumper' | null>(z.jumper ? 'jumper' : z.map ?? (mode === 'pick' ? 'ebg' : null));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const optionLabel = (m: WvwMapId | 'jumper' | null): { title: string; sub: string } => {
    if (m === null) return { title: 'All maps', sub: 'No map filter' };
    if (m === 'jumper') return { title: 'Jumper', sub: 'Cross-map play — hopping between maps' };
    const info = WVW_MAPS.find((x) => x.id === m)!;
    if (m === 'ebg') return { title: info.label, sub: 'Shared map · thirds by spawn' };
    const t = sides?.[m as Color];
    return { title: info.label, sub: t ? `${team(t, names)}’s home${myColor === m ? ' (you)' : ''}` : `${m} team’s home` };
  };

  const choose = (m: WvwMapId | 'jumper' | null) => {
    setBrowse(m);
    setOpen(false);
    if (m === 'jumper') onChange('jumper');
    else if (m === null) onChange(null);
    else if (mode === 'filter') onChange(m);
  };

  const options: (WvwMapId | 'jumper' | null)[] = [...(mode === 'filter' ? [null] : []), ...ORDER, 'jumper'];
  const cur = optionLabel(browse);
  const map = browse && browse !== 'jumper' ? DATA[browse] : null;

  return (
    <div ref={box} className="grid gap-3">
      <div className="relative">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-2 text-left hover:border-[var(--gold)]"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {browse === 'jumper' ? <JumperThumb /> : browse ? <Thumb map={browse} /> : <span className="grid h-11 w-11 place-items-center rounded-md border border-[var(--border)] text-lg">🗺️</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{cur.title}</span>
            <span className="faint block truncate text-xs">{cur.sub}</span>
          </span>
          <span className="muted">▾</span>
        </button>
        {open && (
          <ul role="listbox" className="absolute z-30 mt-1 max-h-[70vh] w-full overflow-auto rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1 shadow-2xl">
            {options.map((m) => {
              const l = optionLabel(m);
              return (
                <li key={m ?? 'all'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={browse === m}
                    onClick={() => choose(m)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)] ${browse === m ? 'bg-[var(--surface-2)]' : ''}`}
                  >
                    {m === 'jumper' ? <JumperThumb size={56} /> : m ? <Thumb map={m} size={56} /> : <span className="grid h-14 w-14 place-items-center rounded-md border border-[var(--border)] text-xl">🗺️</span>}
                    <span>
                      <span className="block font-semibold">{l.title}</span>
                      <span className="faint block text-xs">{l.sub}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {browse === 'jumper' && (
        <div className="rounded-xl border border-[var(--gold)] bg-[rgba(224,179,65,0.06)] p-4 text-sm">
          <div className="mb-2 flex gap-2">
            {ORDER.map((m) => (
              <Thumb key={m} map={m} size={52} />
            ))}
          </div>
          <b>Jumper — cross-map play.</b> The squad hops between maps wherever it’s needed (defending, chasing fights, map-hopping
          havoc). {value === 'jumper' ? '✓ selected' : ''}
        </div>
      )}

      {map && browse && browse !== 'jumper' && (
        <div>
          <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-xl border border-[var(--border-strong)]" style={{ aspectRatio: `${map.width} / ${map.height}` }}>
            <img src={`${BASE}${map.image}`} alt={map.name} className="absolute inset-0 h-full w-full select-none" draggable={false} />
            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              {(Object.keys(map.thirds) as Third[]).map((t) => {
                const selected = z.map === browse && z.third === t;
                return (
                  <polygon
                    key={t}
                    points={map.thirds[t].polygon.map((p) => p.join(',')).join(' ')}
                    fill={`rgba(${FILL[t]},${selected ? 0.5 : 0.18})`}
                    stroke={selected ? 'white' : `rgba(${FILL[t]},0.9)`}
                    strokeWidth={selected ? 0.006 : 0.003}
                    className="cursor-pointer transition-[fill] hover:fill-[rgba(255,255,255,0.18)]"
                    onClick={() => onChange(`${browse}:${t}`)}
                  >
                    <title>{`${t} third`}</title>
                  </polygon>
                );
              })}
            </svg>
            {map.objectives
              .filter((o) => o.type === 'Keep' || o.type === 'Castle')
              .map((o) => (
                <span
                  key={o.id}
                  title={o.name}
                  className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-black/60 bg-[var(--gold)]"
                  style={{ left: `${o.pos[0] * 100}%`, top: `${o.pos[1] * 100}%` }}
                />
              ))}
            {(Object.keys(map.thirds) as Third[]).map((t) => {
              const [x, y] = map.thirds[t].centroid;
              const teamId = sides?.[t];
              return (
                <span
                  key={t}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/60 px-1.5 py-0.5 text-center text-[0.7rem] font-semibold leading-tight text-white"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                >
                  {t[0].toUpperCase() + t.slice(1)} third
                  {teamId ? <span className="block font-normal opacity-80">{team(teamId, names)}{myColor === t ? ' · you' : ''}</span> : null}
                </span>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Map third">
            {mode === 'filter' && (
              <button type="button" className="chip" aria-pressed={value === browse} onClick={() => onChange(browse)}>
                Whole map
              </button>
            )}
            {(['red', 'blue', 'green'] as Third[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`chip chip-${t}`}
                aria-pressed={z.map === browse && z.third === t}
                onClick={() => onChange(`${browse}:${t}`)}
              >
                {z.map === browse && z.third === t ? '✓ ' : ''}
                {t} third
              </button>
            ))}
          </div>
          <p className="faint mt-1 text-center text-[0.65rem]">{MAPDATA.attribution}</p>
        </div>
      )}
    </div>
  );
}
