// Platform registry — the single source of truth mapping each canonical
// inventory field to the EXACT per-platform export column name + required
// flag + value formatting. Mirrored (data-only) in
// `inventory-manager/src/platforms.ts`; this backend copy additionally
// carries the value-transform functions + delimiter/format the serializers
// need (the frontend never serializes). See inventory-manager/README.md.

import type { FieldDef, FieldType, ItemDoc } from "./shared";

export const PLATFORM_IDS = [
  "ebay",
  "amazon",
  "kleinanzeigen",
  "whatnot",
  "facebook",
  "idealo",
  "billiger",
  "geizhals",
] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

// ── Canonical fields: ONE definition per shared concept. ──
export interface CanonicalFieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

const CONDITION_OPTIONS = [
  "New",
  "Used – Like New",
  "Used – Good",
  "Used – Acceptable",
  "For parts",
];

export const CANONICAL_FIELDS: Record<string, CanonicalFieldDef> = {
  title: { key: "title", label: "Title", type: "text" },
  description: { key: "description", label: "Description", type: "longtext" },
  price: { key: "price", label: "Price", type: "number" },
  quantity: { key: "quantity", label: "Quantity", type: "number" },
  condition: {
    key: "condition",
    label: "Condition",
    type: "select",
    options: CONDITION_OPTIONS,
  },
  sku: { key: "sku", label: "SKU", type: "text" },
  brand: { key: "brand", label: "Brand", type: "text" },
  manufacturer: { key: "manufacturer", label: "Manufacturer", type: "text" },
  ean: { key: "ean", label: "EAN / GTIN", type: "ean" },
  mpn: { key: "mpn", label: "MPN / Part no.", type: "text" },
  category: { key: "category", label: "Category", type: "text" },
  product_url: { key: "product_url", label: "Product URL", type: "url" },
  shipping_cost: { key: "shipping_cost", label: "Shipping cost", type: "number" },
  delivery_time: { key: "delivery_time", label: "Delivery time", type: "text" },
  postal_code: { key: "postal_code", label: "Postal code", type: "text" },
  availability: {
    key: "availability",
    label: "Availability",
    type: "select",
    options: ["in stock", "out of stock", "preorder"],
  },
};

// Untagged folders still get a usable base.
const CORE_KEYS = ["title", "sku", "price", "quantity", "description", "condition"];

// ── Output-format + column shapes. ──
export type ExportFormatId = "csv" | "tsv" | "xml";
export type XmlDialect =
  | "rss-google"
  | "solute"
  | "idealo"
  | "geizhals"
  | "openimmo"
  | "flat";

export interface PlatformFormat {
  id: ExportFormatId;
  label: string;
  fileExt: string;
  delimiter?: string;
  dialect?: XmlDialect;
  default?: boolean;
}

type ItemWithId = ItemDoc & { id: string };

export interface PlatformColumnSpec {
  /** Canonical field key, `'photos'`, or a `'__computed'` sentinel. */
  field: string;
  column: string; // exact CSV/TSV header
  xmlTag?: string; // exact XML element (xml formats only)
  required: boolean;
  transform?: (value: unknown, item: ItemWithId) => string | number;
}

export interface PlatformDef {
  id: PlatformId;
  name: string;
  badge: string; // Tailwind classes for the color-coded badge
  formats: PlatformFormat[];
  columns: PlatformColumnSpec[];
  constants?: { column: string; value: string }[];
}

// ── Value transforms. ──
function photos(item: ItemWithId): { downloadUrl: string }[] {
  return (item.photos ?? []) as { downloadUrl: string }[];
}
function firstPhoto(item: ItemWithId): string {
  return photos(item)[0]?.downloadUrl ?? "";
}
function ebayConditionId(v: unknown): number | "" {
  const s = String(v ?? "");
  if (s === "New") return 1000;
  if (s === "For parts") return 7000;
  if (s.startsWith("Used")) return 3000;
  return "";
}
function amazonCondition(v: unknown): string {
  switch (String(v ?? "")) {
    case "New":
      return "New";
    case "Used – Like New":
      return "UsedLikeNew";
    case "Used – Good":
      return "UsedGood";
    case "Used – Acceptable":
      return "UsedAcceptable";
    case "For parts":
      return "UsedAcceptable";
    default:
      return "Used";
  }
}
// new | used | refurbished (Facebook, billiger.de)
function simpleCondition(v: unknown): string {
  return String(v ?? "") === "New" ? "new" : "used";
}
function idealoConditionType(v: unknown): string {
  switch (String(v ?? "")) {
    case "New":
      return "NEW";
    case "Used – Like New":
      return "AS_NEW";
    default:
      return "USED";
  }
}
function plain(v: unknown): string | number {
  return v === undefined || v === null ? "" : (v as string | number);
}

// ── The matrix, encoded. ──
export const PLATFORMS: PlatformDef[] = [
  {
    id: "ebay",
    name: "eBay",
    badge: "bg-blue-900/40 border-blue-700 text-blue-200",
    formats: [
      { id: "csv", label: "CSV", fileExt: "csv", delimiter: ",", default: true },
      { id: "tsv", label: "Tab", fileExt: "txt", delimiter: "\t" },
    ],
    columns: [
      {
        field: "__action",
        column: "*Action",
        required: false,
        transform: (_v, item) => (item.ebay?.listingId ? "Revise" : "Add"),
      },
      {
        field: "sku",
        column: "CustomLabel",
        required: false,
        transform: (v, item) => (v ? (v as string) : item.id),
      },
      {
        field: "category",
        column: "*Category",
        required: false,
        transform: (v, item) => item.ebay?.categoryId ?? (plain(v) as string),
      },
      { field: "title", column: "*Title", required: true },
      { field: "description", column: "*Description", required: true },
      {
        field: "condition",
        column: "*ConditionID",
        required: true,
        transform: (v, item) =>
          (item.ebay?.conditionId ?? ebayConditionId(v)) as string | number,
      },
      { field: "price", column: "*StartPrice", required: true },
      { field: "quantity", column: "*Quantity", required: true },
      {
        field: "__format",
        column: "*Format",
        required: false,
        transform: (_v, item) =>
          item.ebay?.format === "Auction" ? "Auction" : "FixedPrice",
      },
      {
        field: "__duration",
        column: "*Duration",
        required: false,
        transform: (_v, item) => item.ebay?.duration ?? "GTC",
      },
      { field: "postal_code", column: "*Location", required: false },
      {
        field: "photos",
        column: "PicURL",
        required: false,
        transform: (_v, item) => photos(item).map((p) => p.downloadUrl).join("|"),
      },
      { field: "brand", column: "C:Brand", required: false },
      { field: "manufacturer", column: "C:Manufacturer", required: false },
      { field: "ean", column: "C:EAN", required: false },
      { field: "mpn", column: "C:MPN", required: false },
    ],
    constants: [
      { column: "Country", value: "DE" },
      { column: "Currency", value: "EUR" },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    badge: "bg-orange-900/40 border-orange-700 text-orange-200",
    formats: [
      { id: "tsv", label: "Tab (.txt)", fileExt: "txt", delimiter: "\t", default: true },
    ],
    columns: [
      { field: "sku", column: "item_sku", required: true },
      { field: "ean", column: "external_product_id", required: true },
      { field: "brand", column: "brand_name", required: true },
      { field: "title", column: "item_name", required: true },
      { field: "manufacturer", column: "manufacturer", required: false },
      { field: "mpn", column: "part_number", required: false },
      { field: "price", column: "standard_price", required: true },
      { field: "quantity", column: "quantity", required: true },
      { field: "description", column: "product_description", required: false },
      {
        field: "condition",
        column: "condition_type",
        required: true,
        transform: (v) => amazonCondition(v),
      },
      {
        field: "photos",
        column: "main_image_url",
        required: false,
        transform: (_v, item) => firstPhoto(item),
      },
      { field: "category", column: "recommended_browse_nodes", required: false },
    ],
    constants: [{ column: "external_product_id_type", value: "EAN" }],
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    badge: "bg-emerald-900/40 border-emerald-700 text-emerald-200",
    formats: [
      {
        id: "csv",
        label: "CSV (unofficial)",
        fileExt: "csv",
        delimiter: ",",
        default: true,
      },
      { id: "xml", label: "OpenImmo XML", fileExt: "xml", dialect: "openimmo" },
    ],
    columns: [
      { field: "title", column: "title", xmlTag: "title", required: true },
      { field: "description", column: "desc", xmlTag: "desc", required: true },
      {
        field: "price",
        column: "price",
        xmlTag: "price",
        required: true,
        transform: (v) => {
          const n = Number(v);
          return Number.isFinite(n) ? String(Math.round(n)) : "";
        },
      },
      {
        field: "__pricetype",
        column: "pricetype",
        xmlTag: "pricetype",
        required: false,
        transform: () => "0",
      },
      { field: "postal_code", column: "postalcode", xmlTag: "postalcode", required: false },
      {
        field: "photos",
        column: "image",
        xmlTag: "image",
        required: false,
        transform: (_v, item) => firstPhoto(item),
      },
    ],
  },
  {
    id: "whatnot",
    name: "Whatnot",
    badge: "bg-yellow-900/40 border-yellow-700 text-yellow-200",
    formats: [
      { id: "csv", label: "CSV", fileExt: "csv", delimiter: ",", default: true },
    ],
    columns: [
      { field: "category", column: "Category", required: false },
      {
        field: "__subcategory",
        column: "Sub Category",
        required: false,
        transform: () => "",
      },
      { field: "title", column: "Title", required: true },
      { field: "description", column: "Description", required: true },
      { field: "quantity", column: "Quantity", required: true },
      {
        field: "__type",
        column: "Type",
        required: false,
        transform: () => "Buy It Now",
      },
      { field: "price", column: "Price", required: true },
      {
        field: "__shipping_profile",
        column: "Shipping Profile",
        required: false,
        transform: () => "",
      },
      { field: "condition", column: "Condition", required: false },
      { field: "sku", column: "SKU", required: false },
      ...Array.from({ length: 8 }, (_, i) => ({
        field: "photos",
        column: `Image URL ${i + 1}`,
        required: false,
        transform: (_v: unknown, item: ItemWithId) =>
          photos(item)[i]?.downloadUrl ?? "",
      })),
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    badge: "bg-indigo-900/40 border-indigo-700 text-indigo-200",
    formats: [
      { id: "csv", label: "CSV", fileExt: "csv", delimiter: ",", default: true },
      { id: "xml", label: "XML (RSS)", fileExt: "xml", dialect: "rss-google" },
    ],
    columns: [
      { field: "sku", column: "id", xmlTag: "g:id", required: true },
      { field: "title", column: "title", xmlTag: "g:title", required: true },
      {
        field: "description",
        column: "description",
        xmlTag: "g:description",
        required: true,
      },
      {
        field: "availability",
        column: "availability",
        xmlTag: "g:availability",
        required: false,
        transform: (v) => (v ? (v as string) : "in stock"),
      },
      {
        field: "condition",
        column: "condition",
        xmlTag: "g:condition",
        required: true,
        transform: (v) => simpleCondition(v),
      },
      {
        field: "price",
        column: "price",
        xmlTag: "g:price",
        required: true,
        transform: (v) => (v === undefined || v === null || v === "" ? "" : `${v} EUR`),
      },
      { field: "product_url", column: "link", xmlTag: "g:link", required: true },
      {
        field: "photos",
        column: "image_link",
        xmlTag: "g:image_link",
        required: true,
        transform: (_v, item) => firstPhoto(item),
      },
      { field: "brand", column: "brand", xmlTag: "g:brand", required: false },
      {
        field: "photos",
        column: "additional_image_link",
        xmlTag: "g:additional_image_link",
        required: false,
        transform: (_v, item) =>
          photos(item)
            .slice(1)
            .map((p) => p.downloadUrl)
            .join(","),
      },
      { field: "ean", column: "gtin", xmlTag: "g:gtin", required: false },
      { field: "mpn", column: "mpn", xmlTag: "g:mpn", required: false },
      {
        field: "category",
        column: "google_product_category",
        xmlTag: "g:google_product_category",
        required: false,
      },
    ],
  },
  {
    id: "idealo",
    name: "idealo",
    badge: "bg-sky-900/40 border-sky-700 text-sky-200",
    formats: [
      { id: "csv", label: "CSV", fileExt: "csv", delimiter: ",", default: true },
      { id: "xml", label: "XML", fileExt: "xml", dialect: "idealo" },
    ],
    columns: [
      { field: "sku", column: "sku", xmlTag: "sku", required: true },
      { field: "brand", column: "brand", xmlTag: "brand", required: true },
      { field: "title", column: "title", xmlTag: "title", required: true },
      { field: "product_url", column: "url", xmlTag: "url", required: true },
      { field: "price", column: "price", xmlTag: "price", required: true },
      { field: "delivery_time", column: "delivery", xmlTag: "delivery", required: true },
      {
        field: "shipping_cost",
        column: "deliveryCosts_standard",
        xmlTag: "deliveryCosts",
        required: false,
      },
      { field: "description", column: "description", xmlTag: "description", required: false },
      {
        field: "photos",
        column: "imageUrls",
        xmlTag: "imageUrls",
        required: false,
        transform: (_v, item) => photos(item).map((p) => p.downloadUrl).join(";"),
      },
      { field: "ean", column: "eans", xmlTag: "eans", required: false },
      { field: "mpn", column: "hans", xmlTag: "hans", required: false },
      { field: "category", column: "categoryPath", xmlTag: "categoryPath", required: false },
      {
        field: "condition",
        column: "conditionType",
        xmlTag: "conditionType",
        required: false,
        transform: (v) => idealoConditionType(v),
      },
    ],
  },
  {
    id: "billiger",
    name: "billiger.de",
    badge: "bg-rose-900/40 border-rose-700 text-rose-200",
    formats: [
      { id: "csv", label: "CSV", fileExt: "csv", delimiter: ",", default: true },
      { id: "xml", label: "XML", fileExt: "xml", dialect: "solute" },
    ],
    columns: [
      { field: "sku", column: "aid", xmlTag: "aid", required: true },
      { field: "ean", column: "GTIN", xmlTag: "GTIN", required: true },
      { field: "title", column: "name", xmlTag: "name", required: true },
      { field: "brand", column: "brand", xmlTag: "brand", required: true },
      { field: "description", column: "desc", xmlTag: "desc", required: true },
      { field: "product_url", column: "link", xmlTag: "link", required: true },
      { field: "product_url", column: "target_url", xmlTag: "target_url", required: false },
      {
        field: "photos",
        column: "images",
        xmlTag: "images",
        required: false,
        transform: (_v, item) => photos(item).map((p) => p.downloadUrl).join(";"),
      },
      { field: "price", column: "price", xmlTag: "price", required: true },
      {
        field: "shipping_cost",
        column: "dlv_cost",
        xmlTag: "dlv_cost",
        required: false,
        transform: (v) => (v === undefined || v === null || v === "" ? "0.00" : (v as number)),
      },
      { field: "delivery_time", column: "dlv_time", xmlTag: "dlv_time", required: false },
      { field: "category", column: "shop_cat", xmlTag: "shop_cat", required: false },
      { field: "mpn", column: "mpn", xmlTag: "mpn", required: false },
      {
        field: "condition",
        column: "condition",
        xmlTag: "condition",
        required: false,
        transform: (v) => simpleCondition(v),
      },
      { field: "availability", column: "availability", xmlTag: "availability", required: false },
    ],
  },
  {
    id: "geizhals",
    name: "Geizhals",
    badge: "bg-teal-900/40 border-teal-700 text-teal-200",
    formats: [
      { id: "csv", label: "CSV", fileExt: "csv", delimiter: ";", default: true },
      { id: "xml", label: "XML", fileExt: "xml", dialect: "geizhals" },
    ],
    columns: [
      { field: "sku", column: "article_id", xmlTag: "article_id", required: true },
      { field: "title", column: "name", xmlTag: "name", required: true },
      {
        field: "manufacturer",
        column: "manufacturer",
        xmlTag: "manufacturer",
        required: true,
        transform: (v, item) =>
          (v as string) || (item.fields?.brand as string) || "",
      },
      { field: "price", column: "price", xmlTag: "price", required: true },
      { field: "product_url", column: "deeplink", xmlTag: "deeplink", required: true },
      { field: "ean", column: "ean", xmlTag: "ean", required: false },
      { field: "mpn", column: "mpn", xmlTag: "mpn", required: false },
      { field: "shipping_cost", column: "shipping_cost", xmlTag: "shipping_cost", required: false },
      { field: "description", column: "description", xmlTag: "description", required: false },
      {
        field: "photos",
        column: "image_url",
        xmlTag: "image_url",
        required: false,
        transform: (_v, item) => firstPhoto(item),
      },
    ],
  },
];

export const PLATFORM_BY_ID = new Map<string, PlatformDef>(
  PLATFORMS.map((p) => [p.id, p])
);

export function getPlatform(id: string): PlatformDef | undefined {
  return PLATFORM_BY_ID.get(id);
}

// ── Schema builders / helpers (shared by UI + server). ──

function canonicalToFieldDef(
  key: string,
  owners: string[],
  order: number
): FieldDef {
  const c = CANONICAL_FIELDS[key];
  const base: FieldDef = {
    key: c.key,
    label: c.label,
    type: c.type,
    required: false,
    platforms: owners,
    order,
  };
  // Only attach `options` for select fields — never write explicit
  // `undefined` (Firestore rejects it).
  return c.options ? { ...base, options: c.options } : base;
}

export function coreFieldSchema(): FieldDef[] {
  return CORE_KEYS.map((key, i) => canonicalToFieldDef(key, [], i));
}

/** Map of canonical key → the tags (subset of `tags`) whose platform uses it. */
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

/** Schema for a brand-new folder created with `tags` (empty → core). */
export function fieldsForTags(tags: string[]): FieldDef[] {
  if (!tags.length) return coreFieldSchema();
  return ensureTagColumns([], tags);
}

/**
 * Recompute a schema for the folder's FULL tag list: generate any missing
 * canonical columns, set every canonical column's `platforms` to exactly the
 * current tags that use it (so removing a tag drops its badges and any
 * column it solely owned keeps its data with `platforms: []`). Never deletes
 * columns. The one entry point for add- AND strip-tag.
 */
export function ensureTagColumns(schema: FieldDef[], tags: string[]): FieldDef[] {
  const desired = desiredOwners(tags);
  const out = schema.map((f) => ({ ...f, platforms: [...f.platforms] }));

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

/** For a given canonical column key, every platform that uses it + its exact
 * header + required flag. Powers the per-column info button. */
export function platformsForField(
  key: string
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

/** Required platform columns an item is missing (by exact column name). */
export function missingForPlatform(
  item: { fields?: Record<string, unknown>; photos?: unknown[] },
  platformId: string
): string[] {
  const def = PLATFORM_BY_ID.get(platformId);
  if (!def) return [];
  const missing: string[] = [];
  for (const col of def.columns) {
    if (!col.required) continue;
    if (col.field === "photos") {
      if ((item.photos?.length ?? 0) === 0) missing.push(col.column);
      continue;
    }
    if (!(col.field in CANONICAL_FIELDS)) continue;
    const v = item.fields?.[col.field];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      missing.push(col.column);
    }
  }
  return Array.from(new Set(missing));
}
