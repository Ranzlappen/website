// Mirrors `polyvote/functions/src/inventory/shared.ts`. Duplicated per the
// module-boundary convention (CLAUDE.md: no cross-module imports).

export type UserRole = 'user' | 'author' | 'moderator' | 'admin';

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'select'
  | 'boolean'
  | 'date'
  | 'url'
  | 'ean';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required: boolean;
  /** Platform tag ids this column serves (drives header badges). */
  platforms: string[];
  order: number;
}

export interface FolderDoc {
  id: string;
  name: string;
  parentFolderId: string | null;
  pathSegments: string[];
  fieldSchema: FieldDef[];
  platformTags: string[];
  itemCount: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  deletedAt: number | null;
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

export interface EbayBlock {
  syncEnabled: boolean;
  listingStatus: 'none' | 'ready' | 'exported' | 'listed' | 'ended' | 'error';
  listingId: string | null;
  lastExportedAt: number | null;
  lastError: string | null;
  categoryId: string | null;
  conditionId: number | null;
  format: 'FixedPriceItem' | 'Auction';
  duration: string;
}

export interface ItemDoc {
  id: string;
  folderId: string;
  fields: Record<string, unknown>;
  photos: PhotoRef[];
  ebay: EbayBlock;
  /** Denormalized EAN-typed field values; maintained server-side. */
  eanCodes: string[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  deletedAt: number | null;
}

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'ean', label: 'EAN / barcode (with Scan)' },
];

export function defaultEbayBlock(): EbayBlock {
  return {
    syncEnabled: false,
    listingStatus: 'none',
    listingId: null,
    lastExportedAt: null,
    lastError: null,
    categoryId: null,
    conditionId: null,
    format: 'FixedPriceItem',
    duration: 'GTC',
  };
}
