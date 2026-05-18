/**
 * Tiny RFC-4180-ish CSV (de)serializer. Handles quoted fields, embedded
 * commas/newlines, and doubled quotes. No external deps so we stay inside
 * the existing Functions bundle.
 */

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  // Strip BOM
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // Swallow \r\n as a single line break.
      if (input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }

    cell += ch;
    i++;
  }

  // Flush trailing cell/row (no terminating newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
