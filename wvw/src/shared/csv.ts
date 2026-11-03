/**
 * Tiny RFC-4180-style CSV reader for the raid import pipeline.
 *
 * MIRRORED FILE — keep identical to `polyvote/functions/src/wvw/shared/csv.ts`.
 *
 * Handles quoted fields, doubled quotes, CRLF, and auto-detects the delimiter
 * (`,` from Google Sheets, `;` from German/European Excel, tab from pasting
 * straight out of a spreadsheet). Header names are lower-cased and trimmed.
 */

export type Delimiter = ',' | ';' | '\t';

export function detectDelimiter(text: string): Delimiter {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: [Delimiter, number][] = [
    [',', header.split(',').length],
    [';', header.split(';').length],
    ['\t', header.split('\t').length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/** CSV → objects keyed by lower-cased header names. */
export function csvToObjects(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.map((r) => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (k) o[k] = (r[i] ?? '').trim();
    });
    return o;
  });
}

/** Columns understood by the raid import (see wvw/README.md → "Seeding raids"). */
export const IMPORT_COLUMNS = [
  'guild',
  'title',
  'type',
  'map',
  'days',
  'date',
  'time',
  'timezone',
  'duration',
  'languages',
  'audience',
  'openness',
  'team',
] as const;

export const IMPORT_TEMPLATE = [
  IMPORT_COLUMNS.join(','),
  'Age Of Destiny,Reset night blob,zerg,ebg,fri,,20:30,Europe/Berlin,180,"en,de",everyone,open,',
  'Apply Water To Burned Area,Havoc roam,havoc,red,"tue,thu",,21:00,Europe/Berlin,120,de,everyone,open,12008',
  'Age Of Destiny,Training squad,training,jumper,,2026-11-15,19:00,Europe/London,90,en,team,open,',
].join('\n');
