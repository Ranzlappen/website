/**
 * WvW map picker + small map helpers.
 *
 * Raid leaders pick only the MAP (EBG, one of the three borderlands) or
 * "Jumper" for cross-map play. Thirds are not chosen — they are a display
 * device on the matchup map view, where a raid appears in the third of the
 * colour of the team that organised it (MatchupMap.tsx).
 *
 * Map images are curated from tiles.guildwars2.com by scripts/build-maps.py
 * and served from our own origin (no requests to ArenaNet from the browser).
 *
 * mode="pick"   → value is a map id ("ebg" | "red" | … | "jumper")
 * mode="filter" → value may also be null (all maps); renders compact
 */
import { useEffect, useRef, useState } from 'react';
import MAPDATA from '../lib/wvwMaps.json';
import { MAPS, WVW_MAPS, type MapId, type Third, type WvwMapId } from '../shared/constants';
import type { Color } from '../shared/types';
import { team } from '../lib/format';
import { useTeamNames } from '../lib/hooks';
import { useT, type TFn } from '../i18n';

export type MapInfo = (typeof MAPDATA)['maps']['ebg'];
export const MAP_DATA = MAPDATA.maps as Record<WvwMapId, MapInfo>;
export const MAP_ATTRIBUTION = MAPDATA.attribution;
export const MAP_ORDER: WvwMapId[] = ['ebg', 'red', 'blue', 'green'];
/** rgb triplets per team colour (used for third tints + chips). */
export const THIRD_RGB: Record<Third, string> = { red: '229,83,75', blue: '74,144,217', green: '79,191,106' };
const BASE = import.meta.env.BASE_URL;
export const mapImage = (m: WvwMapId) => `${BASE}${MAP_DATA[m].image}`;

const isMapId = (v: unknown): v is MapId => MAPS.some((m) => m.id === v);

/** "Red Borderlands (Frost Citadel's home)", "Eternal Battlegrounds", "Jumper — cross-map play". */
export function mapLabel(
  v: MapId | string | null | undefined,
  t: TFn,
  sides?: Partial<Record<Color, number | null>>,
  names?: Record<string, string>,
  short = false,
): string {
  if (!v) return t('All maps');
  if (!isMapId(v)) return v;
  const m = MAPS.find((x) => x.id === v)!;
  const base = t(short ? m.short : m.label);
  if (v === 'ebg' || v === 'jumper') return base;
  const home = sides?.[v as Color];
  return home ? `${base} (${t('{team}’s home', { team: team(home, names) })})` : base;
}

function Thumb({ map, size = 44 }: { map: WvwMapId; size?: number }) {
  return (
    <img
      src={mapImage(map)}
      alt=""
      loading="lazy"
      className="rounded-md border border-[var(--border)] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function JumperThumb({ size = 44 }: { size?: number }) {
  return (
    <span className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--border)]" style={{ width: size, height: size }}>
      {MAP_ORDER.map((m) => (
        <img key={m} src={mapImage(m)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ))}
    </span>
  );
}

/**
 * Read-only map. `third` highlights one colour's third — on event pages that's
 * the organising team's colour in the current matchup (where it shows on the
 * matchup map).
 */
export function MapThumb({ map, third, size = 160 }: { map: MapId | null | undefined; third?: Third | null; size?: number }) {
  if (map === 'jumper') return <JumperThumb size={size} />;
  if (!map || !MAP_DATA[map]) return null;
  const m = MAP_DATA[map];
  return (
    <div className="relative shrink-0 overflow-hidden rounded-lg border border-[var(--border)]" style={{ width: size, aspectRatio: `${m.width} / ${m.height}` }}>
      <img src={mapImage(map)} alt={m.name} className="absolute inset-0 h-full w-full" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {(Object.keys(m.thirds) as Third[]).map((t) => (
          <polygon
            key={t}
            points={m.thirds[t].polygon.map((p) => p.join(',')).join(' ')}
            fill={`rgba(${THIRD_RGB[t]},${t === third ? 0.45 : 0.1})`}
            stroke={t === third ? 'white' : 'rgba(255,255,255,0.25)'}
            strokeWidth={t === third ? 0.006 : 0.003}
          />
        ))}
      </svg>
    </div>
  );
}

interface Props {
  value: MapId | null;
  onChange: (v: MapId | null) => void;
  mode?: 'pick' | 'filter';
  /** Team ids per colour in the viewer's current matchup (labels the borderlands). */
  sides?: Partial<Record<Color, number | null>>;
  /** The viewer's own colour this week (marked "you"; highlighted in the preview). */
  myColor?: Color | null;
}

export function MapPicker({ value, onChange, mode = 'pick', sides, myColor }: Props) {
  const t = useT();
  const names = useTeamNames();
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

  const optionLabel = (m: MapId | null): { title: string; sub: string } => {
    if (m === null) return { title: t('All maps'), sub: t('No map filter') };
    if (m === 'jumper') return { title: 'Jumper', sub: t('Cross-map play — hopping between maps') };
    const info = WVW_MAPS.find((x) => x.id === m)!;
    if (m === 'ebg') return { title: t(info.label), sub: t('Shared centre map') };
    const home = sides?.[m as Color];
    return {
      title: t(info.label),
      sub: home ? `${t('{team}’s home', { team: team(home, names) })}${myColor === m ? ` · ${t('you')}` : ''}` : t('Home of the {color} team', { color: t(m) }),
    };
  };

  const options: (MapId | null)[] = [...(mode === 'filter' ? [null] : []), ...MAP_ORDER, 'jumper'];
  const cur = optionLabel(value);
  const compact = mode === 'filter';

  return (
    <div ref={box} className="grid gap-3">
      <div className="relative">
        <button
          type="button"
          className={`flex w-full items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-2)] text-left hover:border-[var(--gold)] ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {value === 'jumper' ? (
            <JumperThumb size={compact ? 30 : 44} />
          ) : value ? (
            <Thumb map={value} size={compact ? 30 : 44} />
          ) : (
            <span className={`grid place-items-center rounded-md border border-[var(--border)] ${compact ? 'h-[30px] w-[30px]' : 'h-11 w-11 text-lg'}`}>🗺️</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{cur.title}</span>
            {!compact && <span className="faint block truncate text-xs">{cur.sub}</span>}
          </span>
          <span className="muted">▾</span>
        </button>
        {open && (
          <ul role="listbox" className="absolute z-30 mt-1 max-h-[70vh] w-full min-w-[16rem] overflow-auto rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1 shadow-2xl">
            {options.map((m) => {
              const l = optionLabel(m);
              return (
                <li key={m ?? 'all'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === m}
                    onClick={() => {
                      onChange(m);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)] ${value === m ? 'bg-[var(--surface-2)]' : ''}`}
                  >
                    {m === 'jumper' ? <JumperThumb size={52} /> : m ? <Thumb map={m} size={52} /> : <span className="grid h-[52px] w-[52px] place-items-center rounded-md border border-[var(--border)] text-xl">🗺️</span>}
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

      {mode === 'pick' && value === 'jumper' && (
        <div className="rounded-xl border border-[var(--gold)] bg-[rgba(224,179,65,0.06)] p-4 text-sm">
          <div className="mb-2 flex gap-2">
            {MAP_ORDER.map((m) => (
              <Thumb key={m} map={m} size={52} />
            ))}
          </div>
          <b>{t('Jumper — cross-map play.')}</b> {t('The squad hops between maps wherever it’s needed (defending, chasing fights, map-hopping havoc). It shows in the Jumper section of the matchup map.')}
        </div>
      )}

      {mode === 'pick' && value && value !== 'jumper' && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
          <MapThumb map={value} third={myColor} size={200} />
          <p className="muted text-sm">
            {myColor
              ? t('On the matchup map your raid shows in the {color} third — the side of your team ({team}) this week.', {
                  color: t(myColor),
                  team: team(sides?.[myColor] ?? null, names),
                })
              : t('On the matchup map your raid shows in the third of your team’s colour.')}
            <span className="faint mt-1 block text-[0.65rem]">{MAP_ATTRIBUTION}</span>
          </p>
        </div>
      )}
    </div>
  );
}
