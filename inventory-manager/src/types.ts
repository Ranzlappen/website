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
  | 'url';

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
  id: string;
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
];

export const EBAY_MAPPING_OPTIONS = [
  '',
  'Title',
  'Description',
  'Category',
  'ConditionID',
  'StartPrice',
  'Quantity',
  'CustomLabel',
  'Format',
  'Duration',
  'ShippingProfileName',
  'ReturnProfileName',
  'PaymentProfileName',
];

export function defaultFieldSchema(): FieldDef[] {
  return [
    { key: 'title', label: 'Title', type: 'text', required: true, ebayRequired: true, ebayMapping: 'Title', order: 0 },
    { key: 'description', label: 'Description', type: 'longtext', required: false, ebayRequired: true, ebayMapping: 'Description', order: 1 },
    { key: 'sku', label: 'SKU', type: 'text', required: true, ebayRequired: false, ebayMapping: 'CustomLabel', order: 2 },
    { key: 'price', label: 'Price', type: 'number', required: true, ebayRequired: true, ebayMapping: 'StartPrice', order: 3 },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true, ebayRequired: true, ebayMapping: 'Quantity', order: 4 },
    {
      key: 'condition',
      label: 'Condition',
      type: 'select',
      options: ['New', 'Used – Like New', 'Used – Good', 'Used – Acceptable', 'For parts'],
      required: false,
      ebayRequired: true,
      ebayMapping: 'ConditionID',
      order: 5,
    },
  ];
}

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
