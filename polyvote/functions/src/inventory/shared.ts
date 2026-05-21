import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "select"
  | "boolean"
  | "date"
  | "url"
  | "ean";

// Subset of eBay File Exchange columns we can map to. Anything not in this
// set is treated as a custom item-specific (emitted as "C:<label>").
export const EBAY_CORE_FIELDS = [
  "Title",
  "Description",
  "Category",
  "ConditionID",
  "StartPrice",
  "Quantity",
  "CustomLabel",
  "Format",
  "Duration",
  "ShippingProfileName",
  "ReturnProfileName",
  "PaymentProfileName",
] as const;

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required: boolean;
  ebayRequired: boolean;
  ebayMapping?: string | null;
  order: number;
}

export interface FolderDoc {
  name: string;
  parentFolderId: string | null;
  pathSegments: string[];
  fieldSchema: FieldDef[];
  itemCount: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  deletedAt: number | null;
}

export interface EbayBlock {
  syncEnabled: boolean;
  listingStatus:
    | "none"
    | "ready"
    | "exported"
    | "listed"
    | "ended"
    | "error";
  listingId: string | null;
  lastExportedAt: number | null;
  lastError: string | null;
  categoryId: string | null;
  conditionId: number | null;
  format: "FixedPriceItem" | "Auction";
  duration: string;
}

export interface PhotoRef {
  storagePath: string;
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  width: number;
  height: number;
  order: number;
}

export interface ItemDoc {
  folderId: string;
  fields: Record<string, unknown>;
  photos: PhotoRef[];
  ebay: EbayBlock;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  deletedAt: number | null;
}

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const VALID_FIELD_TYPES: FieldType[] = [
  "text",
  "longtext",
  "number",
  "select",
  "boolean",
  "date",
  "url",
  "ean",
];

// EAN-8, UPC-A (12), EAN-13, GTIN-14
const EAN_PATTERN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

// The base schema every new folder gets. Covers the minimum set of eBay
// File Exchange columns needed for a fixed-price listing so the user can
// export without configuring anything first.
export function defaultFieldSchema(): FieldDef[] {
  return [
    {
      key: "title",
      label: "Title",
      type: "text",
      required: true,
      ebayRequired: true,
      ebayMapping: "Title",
      order: 0,
    },
    {
      key: "description",
      label: "Description",
      type: "longtext",
      required: false,
      ebayRequired: true,
      ebayMapping: "Description",
      order: 1,
    },
    {
      key: "sku",
      label: "SKU",
      type: "text",
      required: true,
      ebayRequired: false,
      ebayMapping: "CustomLabel",
      order: 2,
    },
    {
      key: "price",
      label: "Price",
      type: "number",
      required: true,
      ebayRequired: true,
      ebayMapping: "StartPrice",
      order: 3,
    },
    {
      key: "quantity",
      label: "Quantity",
      type: "number",
      required: true,
      ebayRequired: true,
      ebayMapping: "Quantity",
      order: 4,
    },
    {
      key: "condition",
      label: "Condition",
      type: "select",
      options: ["New", "Used – Like New", "Used – Good", "Used – Acceptable", "For parts"],
      required: false,
      ebayRequired: true,
      ebayMapping: "ConditionID",
      order: 5,
    },
  ];
}

export function defaultEbayBlock(): EbayBlock {
  return {
    syncEnabled: false,
    listingStatus: "none",
    listingId: null,
    lastExportedAt: null,
    lastError: null,
    categoryId: null,
    conditionId: null,
    format: "FixedPriceItem",
    duration: "GTC",
  };
}

export function validateFieldSchema(input: unknown): FieldDef[] {
  if (!Array.isArray(input)) {
    throw new HttpsError("invalid-argument", "fieldSchema must be an array.");
  }
  if (input.length > 60) {
    throw new HttpsError("invalid-argument", "fieldSchema may have at most 60 fields.");
  }

  const seenKeys = new Set<string>();
  const out: FieldDef[] = [];

  input.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") {
      throw new HttpsError("invalid-argument", `field ${idx}: must be an object.`);
    }
    const r = raw as Record<string, unknown>;

    const key = typeof r.key === "string" ? r.key.trim() : "";
    if (!FIELD_KEY_PATTERN.test(key)) {
      throw new HttpsError(
        "invalid-argument",
        `field ${idx}: key must match ${FIELD_KEY_PATTERN}.`
      );
    }
    if (seenKeys.has(key)) {
      throw new HttpsError("invalid-argument", `duplicate field key: ${key}.`);
    }
    seenKeys.add(key);

    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label || label.length > 80) {
      throw new HttpsError(
        "invalid-argument",
        `field ${key}: label is required (max 80 chars).`
      );
    }

    const type = r.type as FieldType;
    if (!VALID_FIELD_TYPES.includes(type)) {
      throw new HttpsError(
        "invalid-argument",
        `field ${key}: type must be one of ${VALID_FIELD_TYPES.join(", ")}.`
      );
    }

    let options: string[] | undefined;
    if (type === "select") {
      if (!Array.isArray(r.options) || r.options.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          `field ${key}: select type requires non-empty options.`
        );
      }
      options = r.options
        .filter((o): o is string => typeof o === "string")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      if (options.length === 0) {
        throw new HttpsError("invalid-argument", `field ${key}: options must contain text.`);
      }
    }

    const ebayMappingRaw =
      typeof r.ebayMapping === "string" && r.ebayMapping.trim()
        ? r.ebayMapping.trim()
        : null;
    if (ebayMappingRaw && ebayMappingRaw.length > 60) {
      throw new HttpsError(
        "invalid-argument",
        `field ${key}: ebayMapping too long.`
      );
    }

    out.push({
      key,
      label,
      type,
      options,
      required: r.required === true,
      ebayRequired: r.ebayRequired === true,
      ebayMapping: ebayMappingRaw,
      order: typeof r.order === "number" ? r.order : idx,
    });
  });

  out.sort((a, b) => a.order - b.order);
  out.forEach((f, i) => (f.order = i));
  return out;
}

/**
 * Validate item `fields` against the folder's schema. Coerces numbers from
 * strings, trims text, and rejects values that violate `required`.
 * Returns the cleaned fields object.
 */
export function validateItemFields(
  fields: unknown,
  schema: FieldDef[],
  opts: { enforceRequired: boolean }
): Record<string, unknown> {
  if (!fields || typeof fields !== "object") {
    throw new HttpsError("invalid-argument", "fields must be an object.");
  }
  const input = fields as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const def of schema) {
    const raw = input[def.key];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim() === "");

    if (isEmpty) {
      if (opts.enforceRequired && def.required) {
        throw new HttpsError(
          "invalid-argument",
          `${def.label} is required.`
        );
      }
      out[def.key] = null;
      continue;
    }

    switch (def.type) {
      case "text":
      case "longtext":
      case "url":
        out[def.key] = String(raw).trim();
        break;
      case "number": {
        const n = typeof raw === "number" ? raw : Number(String(raw).trim());
        if (!Number.isFinite(n)) {
          throw new HttpsError(
            "invalid-argument",
            `${def.label} must be a number.`
          );
        }
        out[def.key] = n;
        break;
      }
      case "boolean":
        out[def.key] = raw === true || raw === "true" || raw === 1 || raw === "1";
        break;
      case "date": {
        const s = String(raw).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          throw new HttpsError(
            "invalid-argument",
            `${def.label} must be YYYY-MM-DD.`
          );
        }
        out[def.key] = s;
        break;
      }
      case "select": {
        const s = String(raw).trim();
        if (def.options && !def.options.includes(s)) {
          throw new HttpsError(
            "invalid-argument",
            `${def.label}: "${s}" is not an allowed option.`
          );
        }
        out[def.key] = s;
        break;
      }
      case "ean": {
        const s = String(raw).trim().replace(/\s+/g, "");
        if (!EAN_PATTERN.test(s)) {
          throw new HttpsError(
            "invalid-argument",
            `${def.label} must be an 8, 12, 13, or 14-digit barcode.`
          );
        }
        out[def.key] = s;
        break;
      }
    }
  }

  return out;
}

/** Returns the keys of all eBay-required fields that are missing/empty. */
export function missingEbayRequiredFields(
  fields: Record<string, unknown>,
  schema: FieldDef[]
): string[] {
  return schema
    .filter((f) => f.ebayRequired)
    .filter((f) => {
      const v = fields[f.key];
      return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    })
    .map((f) => f.label);
}

/** Append an audit log entry for any inventory mutation. */
export async function appendAudit(entry: {
  action: string;
  actorUid: string;
  itemId?: string | null;
  folderId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await getFirestore().collection("inventoryAuditLog").add({
    ...entry,
    timestamp: Date.now(),
  });
}
