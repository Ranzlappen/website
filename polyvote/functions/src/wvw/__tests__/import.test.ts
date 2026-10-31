import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: {} }));

import { csvToObjects, detectDelimiter, IMPORT_TEMPLATE, parseCsv } from '../shared/csv';
import { importKey, normaliseDate, normaliseDuration, normaliseTime, parseImportRow } from '../import';

const NOW = Date.parse('2026-10-31T12:00:00Z');

describe('csv', () => {
  it('parses quotes, doubled quotes, CRLF and blank lines', () => {
    const rows = parseCsv('a,b,c\r\n"x, y","say ""hi""",3\r\n\r\nlast,,\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', '3'],
      ['last', '', ''],
    ]);
  });

  it('detects ; and tab delimiters (European Excel, pasted cells)', () => {
    expect(detectDelimiter('guild;time;map\nA;20:00;ebg')).toBe(';');
    expect(detectDelimiter('guild\ttime\nA\t20:00')).toBe('\t');
    expect(detectDelimiter('guild,time')).toBe(',');
    expect(csvToObjects('Guild;Time\nAoD;20:00')).toEqual([{ guild: 'AoD', time: '20:00' }]);
  });

  it('the template parses into valid rows', () => {
    const rows = csvToObjects(IMPORT_TEMPLATE);
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(() => parseImportRow(r, NOW)).not.toThrow();
  });
});

describe('import row parsing', () => {
  it('normalises dates, times and durations', () => {
    expect(normaliseDate('2026-11-5')).toBe('2026-11-05');
    expect(normaliseDate('15.11.2026')).toBe('2026-11-15');
    expect(normaliseDate('nope')).toBeNull();
    expect(normaliseTime('20:30')).toBe('20:30');
    expect(normaliseTime('8:30 pm')).toBe('20:30');
    expect(normaliseTime('20.30')).toBe('20:30');
    expect(normaliseTime('21')).toBe('21:00');
    expect(normaliseTime('25:00')).toBeNull();
    expect(normaliseDuration('')).toBe(120);
    expect(normaliseDuration('90')).toBe(90);
    expect(normaliseDuration('2h')).toBe(120);
    expect(normaliseDuration('1h30')).toBe(90);
    expect(normaliseDuration('1:45')).toBe(105);
  });

  it('builds a weekly raid from days (German day names too)', () => {
    const r = parseImportRow({ guild: 'Age Of Destiny', days: 'Mo, Mi, fri', time: '20:30', timezone: 'Europe/Berlin', map: 'EBG', languages: 'de,en' }, NOW);
    expect(r.guildRef).toBe('Age Of Destiny');
    expect(r.input.schedule).toMatchObject({ repeat: 'weekly', days: [1, 3, 5], time: '20:30', tz: 'Europe/Berlin', date: '2026-10-31' });
    expect(r.input.map).toBe('ebg');
    expect(r.input.languages).toEqual(['de', 'en']);
    expect(r.input.type).toBe('zerg');
    expect(r.input.title).toBe('Zerg / blob');
    expect(r.input.audience).toBe('everyone');
  });

  it('builds a one-off raid from a date and maps aliases', () => {
    const r = parseImportRow({ guild: 'X', date: '15.11.2026', time: '19:00', map: 'desert bl', type: 'Havoc', audience: 'team', team: '12008' }, NOW);
    expect(r.input.schedule).toMatchObject({ repeat: 'none', date: '2026-11-15' });
    expect(r.input.map).toBe('red');
    expect(r.input.type).toBe('havoc');
    expect(r.input.audience).toBe('team');
    expect(r.team).toBe(12008);
  });

  it('rejects bad rows with readable messages', () => {
    expect(() => parseImportRow({ time: '20:00', days: 'mon' }, NOW)).toThrow(/guild/);
    expect(() => parseImportRow({ guild: 'X', time: '20:00' }, NOW)).toThrow(/days .* or a date/);
    expect(() => parseImportRow({ guild: 'X', time: 'late', days: 'mon' }, NOW)).toThrow(/time/);
    expect(() => parseImportRow({ guild: 'X', time: '20:00', days: 'someday' }, NOW)).toThrow(/day/);
    expect(() => parseImportRow({ guild: 'X', time: '20:00', days: 'mon', map: 'moon' }, NOW)).toThrow(/map/);
    expect(() => parseImportRow({ guild: 'X', time: '20:00', days: 'mon', timezone: 'Mars/Base' }, NOW)).toThrow(/time zone/);
    expect(() => parseImportRow({ guild: 'X', time: '20:00', days: 'mon', team: '2008' }, NOW)).toThrow(/team id/);
    expect(() => parseImportRow({ guild: 'X', time: '20:00', days: 'mon', languages: 'klingon' }, NOW)).toThrow(/language/);
  });

  it('import keys are stable for the same raid and differ otherwise', () => {
    const a = parseImportRow({ guild: 'X', days: 'fri', time: '20:30', title: 'Reset Blob' }, NOW).input;
    const b = parseImportRow({ guild: 'X', days: 'fri', time: '20:30', title: ' reset blob ', map: 'red' }, NOW).input;
    const c = parseImportRow({ guild: 'X', days: 'sat', time: '20:30', title: 'Reset Blob' }, NOW).input;
    expect(importKey('G', a)).toBe(importKey('G', b));
    expect(importKey('G', a)).not.toBe(importKey('G', c));
    expect(importKey('G', a)).not.toBe(importKey('H', a));
  });
});
