import type { FieldDef } from './types';

/** Render a stored field value as read-only display text for the table. */
export function formatFieldValue(def: FieldDef, value: unknown): string {
  if (def.type === 'boolean') {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return '—';
  }
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
