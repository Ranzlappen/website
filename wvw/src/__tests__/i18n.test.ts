import { describe, expect, it } from 'vitest';
import { allKeys, extractKeys } from '../../scripts/i18n-keys.mjs';
import { DICTS, translate } from '../i18n/translate';
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
  ...['red', 'blue', 'green'],
  ...['now', 'in {d}', '{d} ago'],
  // validateSchedule (shared/time.ts) messages, shown via t(schedErr) in the editor
  'Schedule is required.',
  'Unknown time zone.',
  'Date must be YYYY-MM-DD.',
  'Time must be HH:MM (24h).',
  'Duration must be between 15 minutes and 12 hours.',
  'Repeat must be none or weekly.',
  'Pick at least one weekday.',
  'End date must be YYYY-MM-DD.',
  'End date is before the start date.',
  ...['cancelled', 'on hold', 'logs', 'voice', 'checkins', 'reported'],
];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  it('extracts literal keys incl. both ternary branches, skipping compared values', () => {
    const keys = extractKeys(`t('A'); t(x ? 'B' : "C", { n }); t(mode === 'pick' ? 'D' : 'E'); at('no'); t(\`\${x}\`); msg('F')`);
    expect([...keys].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  const keys = [...new Set([...allKeys(), ...DYNAMIC])];

  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`every UI string has a ${lang} translation`, () => {
      expect(keys.filter((k) => !(k in dict))).toEqual([]);
    });

    it(`${lang} translations keep their {placeholders} and link targets`, () => {
      const links = (s: string) => [...s.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).sort();
      const broken = Object.entries(dict).filter(
        ([k, v]) => placeholders(k).join() !== placeholders(v).join() || links(k).join() !== links(v).join(),
      );
      expect(broken).toEqual([]);
    });

    it(`${lang} has no stale keys`, () => {
      const known = new Set(keys);
      expect(Object.keys(dict).filter((k) => !known.has(k))).toEqual([]);
    });
  }

  it('interpolates and falls back to English', () => {
    expect(translate('de', '{n} raids', { n: 3 })).toBe('3 Raids');
    expect(translate('en', '{n} raids', { n: 3 })).toBe('3 raids');
    expect(translate('de', 'Some brand-new string')).toBe('Some brand-new string');
    expect(translate('de', 'Tier {n}')).toBe('Tier {n}');
  });
});
