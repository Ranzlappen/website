import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type {
  EbayBlock,
  FieldDef,
  FolderDoc,
  ItemDoc,
  PhotoRef,
} from './types';

const firebaseConfig = {
  apiKey: 'AIzaSyByEwHUnausbBmyRT928uGTRw5ZvszjjiM',
  authDomain: 'proven-concept-436717-q3.firebaseapp.com',
  projectId: 'proven-concept-436717-q3',
  storageBucket: 'proven-concept-436717-q3.firebasestorage.app',
  messagingSenderId: '420991269376',
  appId: '1:420991269376:web:8b2d0bcac98ffd92abb6e5',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
const functions = getFunctions(app);

// ── Folders ──
export const inventoryListFoldersFn = httpsCallable<
  Record<string, never>,
  { folders: FolderDoc[]; total: number }
>(functions, 'inventoryListFolders');

export const inventoryCreateFolderFn = httpsCallable<
  { parentFolderId?: string | null; name: string; fieldSchema?: FieldDef[] },
  FolderDoc
>(functions, 'inventoryCreateFolder');

export const inventoryUpdateFolderFn = httpsCallable<
  {
    folderId: string;
    name?: string;
    fieldSchema?: FieldDef[];
    parentFolderId?: string | null;
  },
  FolderDoc
>(functions, 'inventoryUpdateFolder');

export const inventoryDeleteFolderFn = httpsCallable<
  { folderId: string },
  { success: boolean; deletedFolderCount: number }
>(functions, 'inventoryDeleteFolder');

export const inventoryDuplicateFolderFn = httpsCallable<
  { folderId: string; newName?: string; copyItems?: boolean },
  FolderDoc & { itemCount: number; photoCount: number }
>(functions, 'inventoryDuplicateFolder');

// ── Items ──
export const inventoryListItemsFn = httpsCallable<
  { folderId?: string; limit?: number; cursor?: number; ebayOnly?: boolean },
  { items: ItemDoc[]; nextCursor: number | null }
>(functions, 'inventoryListItems');

export const inventoryGetItemFn = httpsCallable<{ itemId: string }, ItemDoc>(
  functions,
  'inventoryGetItem',
);

export const inventoryCreateItemFn = httpsCallable<
  {
    folderId: string;
    fields: Record<string, unknown>;
    ebay?: Partial<EbayBlock>;
  },
  ItemDoc
>(functions, 'inventoryCreateItem');

export const inventoryUpdateItemFn = httpsCallable<
  {
    itemId: string;
    fields?: Record<string, unknown>;
    ebay?: Partial<EbayBlock>;
  },
  ItemDoc
>(functions, 'inventoryUpdateItem');

export const inventoryDeleteItemFn = httpsCallable<
  { itemId: string },
  { success: boolean }
>(functions, 'inventoryDeleteItem');

export const inventoryToggleEbaySyncFn = httpsCallable<
  { itemId: string; enabled: boolean },
  { success: boolean; ebay: EbayBlock }
>(functions, 'inventoryToggleEbaySync');

// ── Photos ──
export const inventoryUploadPhotoFn = httpsCallable<
  {
    itemId: string;
    filename: string;
    base64Data: string;
    width?: number;
    height?: number;
  },
  PhotoRef
>(functions, 'inventoryUploadPhoto');

export const inventoryDeletePhotoFn = httpsCallable<
  { itemId: string; storagePath: string },
  { success: boolean; photos: PhotoRef[] }
>(functions, 'inventoryDeletePhoto');

export const inventoryReorderPhotosFn = httpsCallable<
  { itemId: string; photoOrder: string[] },
  { success: boolean; photos: PhotoRef[] }
>(functions, 'inventoryReorderPhotos');

// ── Import / export ──
export const inventoryImportFn = httpsCallable<
  { folderId: string; format: 'csv' | 'json'; data: string; dryRun?: boolean },
  {
    dryRun: boolean;
    summary: {
      toCreate: number;
      toUpdate: number;
      skipped: { row: number; reason: string }[];
    };
  }
>(functions, 'inventoryImport');

export const inventoryExportFn = httpsCallable<
  { folderId: string; format: 'csv' | 'json' },
  { format: 'csv' | 'json'; filename: string; body: string }
>(functions, 'inventoryExport');

// ── eBay export ──
export const inventoryExportEbayCsvFn = httpsCallable<
  { folderId?: string; itemIds?: string[] },
  { filename: string; body: string; rowCount: number; columns: string[] }
>(functions, 'inventoryExportEbayCsv');
