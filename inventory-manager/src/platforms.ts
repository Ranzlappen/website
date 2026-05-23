// Platform registry — data-only mirror of
// `polyvote/functions/src/inventory/platforms.ts` (duplicated intentionally
// per the module-boundary convention; see inventory-manager/README.md). The
// backend copy additionally carries value-transform functions + delimiters
// the serializers need; the browser only needs the column names, required
// flags, badge colors, supported formats, and the schema/overlap helpers.

import type { FieldDef, FieldType } from './types';

export const PLATFORM_IDS = [
  'ebay',
  'amazon',
  'kleinanzeigen',
  'whatnot',
  'facebook',
  'idealo',
  'billiger',
  'geizhals',
] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export interface CanonicalFieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

const CONDITION_OPTIONS = [
  'New',
  'Used – Like New',
  'Used – Good',
  'Used – Acceptable',
  'For parts',
];

export const CANONICAL_FIELDS: Record<string, CanonicalFieldDef> = {
  title: { key: 'title', label: 'Title', type: 'text' },
  description: { key: 'description', label: 'Description', type: 'longtext' },
  price: { key: 'price', label: 'Price', type: 'number' },
  quantity: { key: 'quantity', label: 'Quantity', type: 'number' },
  condition: { key: 'condition', label: 'Condition', type: 'select', options: CONDITION_OPTIONS },
  sku: { key: 'sku', label: 'SKU', type: 'text' },
  brand: { key: 'brand', label: 'Brand', type: 'text' },
  manufacturer: { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  ean: { key: 'ean', label: 'EAN / GTIN', type: 'ean' },
  mpn: { key: 'mpn', label: 'MPN / Part no.', type: 'text' },
  category: { key: 'category', label: 'Category', type: 'text' },
  product_url: { key: 'product_url', label: 'Product URL', type: 'url' },
  shipping_cost: { key: 'shipping_cost', label: 'Shipping cost', type: 'number' },
  delivery_time: { key: 'delivery_time', label: 'Delivery time', type: 'text' },
  postal_code: { key: 'postal_code', label: 'Postal code', type: 'text' },
  availability: {
    key: 'availability',
    label: 'Availability',
    type: 'select',
    options: ['in stock', 'out of stock', 'preorder'],
  },
};

const CORE_KEYS = ['title', 'sku', 'price', 'quantity', 'description', 'condition'];

export type ExportFormatId = 'csv' | 'tsv' | 'xml';
export type XmlDialect =
  | 'rss-google'
  | 'solute'
  | 'idealo'
  | 'geizhals'
  | 'openimmo'
  | 'flat';

export interface PlatformFormat {
  id: ExportFormatId;
  label: string;
  fileExt: string;
  delimiter?: string;
  dialect?: XmlDialect;
  default?: boolean;
}

export interface PlatformColumnSpec {
  field: string;
  column: string;
  xmlTag?: string;
  required: boolean;
}

export interface PlatformDef {
  id: PlatformId;
  name: string;
  badge: string;
  formats: PlatformFormat[];
  columns: PlatformColumnSpec[];
}

// Column lists mirror the backend (without transforms/constants — the UI
// only reads `field`/`column`/`xmlTag`/`required`).
export const PLATFORMS: PlatformDef[] = [
  {
    id: 'ebay',
    name: 'eBay',
    badge: 'bg-blue-900/40 border-blue-700 text-blue-200',
    formats: [
      { id: 'csv', label: 'CSV', fileExt: 'csv', delimiter: ',', default: true },
      { id: 'tsv', label: 'Tab', fileExt: 'txt', delimiter: '\t' },
    ],
    columns: [
      { field: '__action', column: '*Action', required: false },
      { field: 'sku', column: 'CustomLabel', required: false },
      { field: 'category', column: '*Category', required: false },
      { field: 'title', column: '*Title', required: true },
      { field: 'description', column: '*Description', required: true },
      { field: 'condition', column: '*ConditionID', required: true },
      { field: 'price', column: '*StartPrice', required: true },
      { field: 'quantity', column: '*Quantity', required: true },
      { field: '__format', column: '*Format', required: false },
      { field: '__duration', column: '*Duration', required: false },
      { field: 'postal_code', column: '*Location', required: false },
      { field: 'photos', column: 'PicURL', required: false },
      { field: 'brand', column: 'C:Brand', required: false },
      { field: 'manufacturer', column: 'C:Manufacturer', required: false },
      { field: 'ean', column: 'C:EAN', required: false },
      { field: 'mpn', column: 'C:MPN', required: false },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    badge: 'bg-orange-900/40 border-orange-700 text-orange-200',
    formats: [{ id: 'tsv', label: 'Tab (.txt)', fileExt: 'txt', delimiter: '\t', default: true }],
    columns: [
      { field: 'sku', column: 'item_sku', required: true },
      { field: 'ean', column: 'external_product_id', required: true },
      { field: 'brand', column: 'brand_name', required: true },
      { field: 'title', column: 'item_name', required: true },
      { field: 'manufacturer', column: 'manufacturer', required: false },
      { field: 'mpn', column: 'part_number', required: false },
      { field: 'price', column: 'standard_price', required: true },
      { field: 'quantity', column: 'quantity', required: true },
      { field: 'description', column: 'product_description', required: false },
      { field: 'condition', column: 'condition_type', required: true },
      { field: 'photos', column: 'main_image_url', required: false },
      { field: 'category', column: 'recommended_browse_nodes', required: false },
    ],
  },
  {
    id: 'kleinanzeigen',
    name: 'Kleinanzeigen',
    badge: 'bg-emerald-900/40 border-emerald-700 text-emerald-200',
    formats: [
      { id: 'csv', label: 'CSV (unofficial)', fileExt: 'csv', delimiter: ',', default: true },
      { id: 'xml', label: 'OpenImmo XML', fileExt: 'xml', dialect: 'openimmo' },
    ],
    columns: [
      { field: 'title', column: 'title', xmlTag: 'title', required: true },
      { field: 'description', column: 'desc', xmlTag: 'desc', required: true },
      { field: 'price', column: 'price', xmlTag: 'price', required: true },
      { field: '__pricetype', column: 'pricetype', xmlTag: 'pricetype', required: false },
      { field: 'postal_code', column: 'postalcode', xmlTag: 'postalcode', required: false },
      { field: 'photos', column: 'image', xmlTag: 'image', required: false },
    ],
  },
  {
    id: 'whatnot',
    name: 'Whatnot',
    badge: 'bg-yellow-900/40 border-yellow-700 text-yellow-200',
    formats: [{ id: 'csv', label: 'CSV', fileExt: 'csv', delimiter: ',', default: true }],
    columns: [
      { field: 'category', column: 'Category', required: false },
      { field: '__subcategory', column: 'Sub Category', required: false },
      { field: 'title', column: 'Title', required: true },
      { field: 'description', column: 'Description', required: true },
      { field: 'quantity', column: 'Quantity', required: true },
      { field: '__type', column: 'Type', required: false },
      { field: 'price', column: 'Price', required: true },
      { field: '__shipping_profile', column: 'Shipping Profile', required: false },
      { field: 'condition', column: 'Condition', required: false },
      { field: 'sku', column: 'SKU', required: false },
      ...Array.from({ length: 8 }, (_, i) => ({
        field: 'photos',
        column: `Image URL ${i + 1}`,
        required: false,
      })),
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    badge: 'bg-indigo-900/40 border-indigo-700 text-indigo-200',
    formats: [
      { id: 'csv', label: 'CSV', fileExt: 'csv', delimiter: ',', default: true },
      { id: 'xml', label: 'XML (RSS)', fileExt: 'xml', dialect: 'rss-google' },
    ],
    columns: [
      { field: 'sku', column: 'id', xmlTag: 'g:id', required: true },
      { field: 'title', column: 'title', xmlTag: 'g:title', required: true },
      { field: 'description', column: 'description', xmlTag: 'g:description', required: true },
      { field: 'availability', column: 'availability', xmlTag: 'g:availability', required: false },
      { field: 'condition', column: 'condition', xmlTag: 'g:condition', required: true },
      { field: 'price', column: 'price', xmlTag: 'g:price', required: true },
      { field: 'product_url', column: 'link', xmlTag: 'g:link', required: true },
      { field: 'photos', column: 'image_link', xmlTag: 'g:image_link', required: true },
      { field: 'brand', column: 'brand', xmlTag: 'g:brand', required: false },
      { field: 'photos', column: 'additional_image_link', xmlTag: 'g:additional_image_link', required: false },
      { field: 'ean', column: 'gtin', xmlTag: 'g:gtin', required: false },
      { field: 'mpn', column: 'mpn', xmlTag: 'g:mpn', required: false },
      { field: 'category', column: 'google_product_category', xmlTag: 'g:google_product_category', required: false },
    ],
  },
  {
    id: 'idealo',
    name: 'idealo',
    badge: 'bg-sky-900/40 border-sky-700 text-sky-200',
    formats: [
      { id: 'csv', label: 'CSV', fileExt: 'csv', delimiter: ',', default: true },
      { id: 'xml', label: 'XML', fileExt: 'xml', dialect: 'idealo' },
    ],
    columns: [
      { field: 'sku', column: 'sku', xmlTag: 'sku', required: true },
      { field: 'brand', column: 'brand', xmlTag: 'brand', required: true },
      { field: 'title', column: 'title', xmlTag: 'title', required: true },
      { field: 'product_url', column: 'url', xmlTag: 'url', required: true },
      { field: 'price', column: 'price', xmlTag: 'price', required: true },
      { field: 'delivery_time', column: 'delivery', xmlTag: 'delivery', required: true },
      { field: 'shipping_cost', column: 'deliveryCosts_standard', xmlTag: 'deliveryCosts', required: false },
      { field: 'description', column: 'description', xmlTag: 'description', required: false },
      { field: 'photos', column: 'imageUrls', xmlTag: 'imageUrls', required: false },
      { field: 'ean', column: 'eans', xmlTag: 'eans', required: false },
      { field: 'mpn', column: 'hans', xmlTag: 'hans', required: false },
      { field: 'category', column: 'categoryPath', xmlTag: 'categoryPath', required: false },
      { field: 'condition', column: 'conditionType', xmlTag: 'conditionType', required: false },
    ],
  },
  {
    id: 'billiger',
    name: 'billiger.de',
    badge: 'bg-rose-900/40 border-rose-700 text-rose-200',
    formats: [
      { id: 'csv', label: 'CSV', fileExt: 'csv', delimiter: ',', default: true },
      { id: 'xml', label: 'XML', fileExt: 'xml', dialect: 'solute' },
    ],
    columns: [
      { field: 'sku', column: 'aid', xmlTag: 'aid', required: true },
      { field: 'ean', column: 'GTIN', xmlTag: 'GTIN', required: true },
      { field: 'title', column: 'name', xmlTag: 'name', required: true },
      { field: 'brand', column: 'brand', xmlTag: 'brand', required: true },
      { field: 'description', column: 'desc', xmlTag: 'desc', required: true },
      { field: 'product_url', column: 'link', xmlTag: 'link', required: true },
      { field: 'product_url', column: 'target_url', xmlTag: 'target_url', required: false },
      { field: 'photos', column: 'images', xmlTag: 'images', required: false },
      { field: 'price', column: 'price', xmlTag: 'price', required: true },
      { field: 'shipping_cost', column: 'dlv_cost', xmlTag: 'dlv_cost', required: false },
      { field: 'delivery_time', column: 'dlv_time', xmlTag: 'dlv_time', required: false },
      { field: 'category', column: 'shop_cat', xmlTag: 'shop_cat', required: false },
      { field: 'mpn', column: 'mpn', xmlTag: 'mpn', required: false },
      { field: 'condition', column: 'condition', xmlTag: 'condition', required: false },
      { field: 'availability', column: 'availability', xmlTag: 'availability', required: false },
    ],
  },
  {
    id: 'geizhals',
    name: 'Geizhals',
    badge: 'bg-teal-900/40 border-teal-700 text-teal-200',
    formats: [
      { id: 'csv', label: 'CSV', fileExt: 'csv', delimiter: ';', default: true },
      { id: 'xml', label: 'XML', fileExt: 'xml', dialect: 'geizhals' },
    ],
    columns: [
      { field: 'sku', column: 'article_id', xmlTag: 'article_id', required: true },
      { field: 'title', column: 'name', xmlTag: 'name', required: true },
      { field: 'manufacturer', column: 'manufacturer', xmlTag: 'manufacturer', required: true },
      { field: 'price', column: 'price', xmlTag: 'price', required: true },
      { field: 'product_url', column: 'deeplink', xmlTag: 'deeplink', required: true },
      { field: 'ean', column: 'ean', xmlTag: 'ean', required: false },
      { field: 'mpn', column: 'mpn', xmlTag: 'mpn', required: false },
      { field: 'shipping_cost', column: 'shipping_cost', xmlTag: 'shipping_cost', required: false },
      { field: 'description', column: 'description', xmlTag: 'description', required: false },
      { field: 'photos', column: 'image_url', xmlTag: 'image_url', required: false },
    ],
  },
];

export const PLATFORM_BY_ID = new Map<string, PlatformDef>(PLATFORMS.map((p) => [p.id, p]));

export function getPlatform(id: string): PlatformDef | undefined {
  return PLATFORM_BY_ID.get(id);
}

export function platformName(id: string): string {
  return PLATFORM_BY_ID.get(id)?.name ?? id;
}

function canonicalToFieldDef(key: string, owners: string[], order: number): FieldDef {
  const c = CANONICAL_FIELDS[key];
  const base: FieldDef = {
    key: c.key,
    label: c.label,
    type: c.type,
    required: false,
    platforms: owners,
    order,
  };
  // Only attach `options` for select fields — mirrors the backend so schema
  // objects never carry an explicit `undefined` (rejected by Firestore).
  return c.options ? { ...base, options: c.options } : base;
}

export function coreFieldSchema(): FieldDef[] {
  return CORE_KEYS.map((key, i) => canonicalToFieldDef(key, [], i));
}

function desiredOwners(tags: string[]): Map<string, Set<string>> {
  const desired = new Map<string, Set<string>>();
  for (const tag of tags) {
    const def = PLATFORM_BY_ID.get(tag);
    if (!def) continue;
    for (const col of def.columns) {
      if (!(col.field in CANONICAL_FIELDS)) continue;
      if (!desired.has(col.field)) desired.set(col.field, new Set());
      desired.get(col.field)!.add(tag);
    }
  }
  return desired;
}

export function fieldsForTags(tags: string[]): FieldDef[] {
  if (!tags.length) return coreFieldSchema();
  return ensureTagColumns([], tags);
}

/** Recompute a schema for the folder's FULL tag list — generates missing
 * canonical columns, refreshes each canonical column's `platforms` to the
 * current owning tags, keeps every existing column (data-safe). */
export function ensureTagColumns(schema: FieldDef[], tags: string[]): FieldDef[] {
  const desired = desiredOwners(tags);
  const out = schema.map((f) => ({ ...f, platforms: [...(f.platforms ?? [])] }));
  for (const f of out) {
    if (f.key in CANONICAL_FIELDS) {
      f.platforms = desired.has(f.key) ? Array.from(desired.get(f.key)!) : [];
    }
  }
  let order = out.length;
  for (const [key, owners] of desired) {
    if (!out.some((f) => f.key === key)) {
      out.push(canonicalToFieldDef(key, Array.from(owners), order++));
    }
  }
  return out.map((f, i) => ({ ...f, order: i }));
}

export function platformsForField(
  key: string,
): { platform: PlatformId; name: string; column: string; required: boolean }[] {
  const out: { platform: PlatformId; name: string; column: string; required: boolean }[] = [];
  for (const def of PLATFORMS) {
    for (const col of def.columns) {
      if (col.field === key) {
        out.push({ platform: def.id, name: def.name, column: col.column, required: col.required });
      }
    }
  }
  return out;
}

export function missingForPlatform(
  item: { fields?: Record<string, unknown>; photos?: unknown[] },
  platformId: string,
): string[] {
  const def = PLATFORM_BY_ID.get(platformId);
  if (!def) return [];
  const missing: string[] = [];
  for (const col of def.columns) {
    if (!col.required) continue;
    if (col.field === 'photos') {
      if ((item.photos?.length ?? 0) === 0) missing.push(col.column);
      continue;
    }
    if (!(col.field in CANONICAL_FIELDS)) continue;
    const v = item.fields?.[col.field];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      missing.push(col.column);
    }
  }
  return Array.from(new Set(missing));
}
