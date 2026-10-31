import { COMMON_TIMEZONES } from '../shared/constants';
import { browserTimeZone } from '../lib/format';
import { useStore } from '../store';

/** Display time-zone selector (affects every time on the site). */
export function TzPicker({ compact = false }: { compact?: boolean }) {
  const tz = useStore((s) => s.displayTz);
  const setTz = useStore((s) => s.setDisplayTz);
  const zones = [...new Set([browserTimeZone(), tz, ...COMMON_TIMEZONES])];
  return (
    <label className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <span className="muted whitespace-nowrap">🕑 Times in</span>
      <select className="select !w-auto !py-1 text-sm" value={tz} onChange={(e) => setTz(e.target.value)}>
        {zones.map((z) => (
          <option key={z} value={z}>
            {z === browserTimeZone() ? `${z} (yours)` : z}
          </option>
        ))}
      </select>
    </label>
  );
}
