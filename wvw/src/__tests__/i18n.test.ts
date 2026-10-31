import { describe, expect, it } from 'vitest';
import { allKeys, extractKeys } from '../../scripts/i18n-keys.mjs';
import { de } from '../i18n/de';
import { translate } from '../i18n/translate';
import {
  AUDIENCES,
  COMMUNITY_RULES,
  EVENT_TYPES,
  MAPS,
  OPENNESS,
  PLAYSTYLES,
  RATING_AXES,
  REPORT_REASONS,
  VOICE_KINDS,
} from '../shared/constants';
import { WEEKDAY_SHORT } from '../shared/time';

/** Keys reaching t() through variables (option lists, nav/view labels, colours, statuses). */
const DYNAMIC = [
  ...[EVENT_TYPES, OPENNESS, PLAYSTYLES, VOICE_KINDS, RATING_AXES, REPORT_REASONS].flatMap((l) => l.map((o) => o.label as string)),
  ...AUDIENCES.flatMap((a) => [a.label, a.hint]),
  ...MAPS.flatMap((m) => [m.label, m.short]),
  ...WEEKDAY_SHORT,
  ...COMMUNITY_RULES,
  ...['Home', 'Calendar', 'Matchups', 'Guilds', 'My raids', 'Moderation'],
  ...['Map', 'Day', 'Week', 'Link', 'Month'],
  ...['red', 'blue', 'green'],
  ...['cancelled', 'on hold', 'logs', 'voice', 'checkins', 'reported'],
];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  it('extracts literal keys incl. both ternary branches, skipping compared values', () => {
    const keys = extractKeys(`t('A'); t(x ? 'B' : "C", { n }); t(mode === 'pick' ? 'D' : 'E'); at('no'); t(\`\${x}\`)`);
    expect([...keys].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('every UI string has a German translation', () => {
    const missing = [...new Set([...allKeys(), ...DYNAMIC])].filter((k) => !(k in de));
    expect(missing).toEqual([]);
  });

  it('translations keep their {placeholders}', () => {
    const broken = Object.entries(de).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join());
    expect(broken).toEqual([]);
  });

  it('interpolates and falls back to English', () => {
    expect(translate('de', '{n} raids', { n: 3 })).toBe('3 Raids');
    expect(translate('en', '{n} raids', { n: 3 })).toBe('3 raids');
    expect(translate('de', 'Some brand-new string')).toBe('Some brand-new string');
    expect(translate('de', 'Tier {n}')).toBe('Tier {n}');
  });
});
