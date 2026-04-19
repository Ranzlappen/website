import { initializeApp } from 'firebase/app';
import { getAuth, EmailAuthProvider } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { BlogDraft, ExistingPost, FrontMatter } from './types';

const firebaseConfig = {
  apiKey: 'AIzaSyByEwHUnausbBmyRT928uGTRw5ZvszjjiM',
  authDomain: 'proven-concept-436717-q3.firebaseapp.com',
  projectId: 'proven-concept-436717-q3',
  storageBucket: 'proven-concept-436717-q3.appspot.com',
  messagingSenderId: '420991269376',
  appId: '1:420991269376:web:8b2d0bcac98ffd92abb6e5',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const emailProvider = new EmailAuthProvider();

const functions = getFunctions(app);

// ── Blog draft CRUD ──

export const blogSaveDraftFn = httpsCallable<
  { draftId?: string; slug: string; frontMatter: FrontMatter; body: string },
  { id: string; updatedAt: number }
>(functions, 'blogSaveDraft');

export const blogListDraftsFn = httpsCallable<
  Record<string, never>,
  { drafts: BlogDraft[]; total: number }
>(functions, 'blogListDrafts');

export const blogGetDraftFn = httpsCallable<
  { draftId: string },
  BlogDraft
>(functions, 'blogGetDraft');

export const blogDeleteDraftFn = httpsCallable<
  { draftId: string },
  { success: boolean }
>(functions, 'blogDeleteDraft');

// ── Publish ──

export const blogPublishToGitHubFn = httpsCallable<
  { draftId: string; confirmOverwrite?: boolean },
  { commitSha: string; commitUrl: string }
>(functions, 'blogPublishToGitHub');

// ── Images ──

export const blogUploadImageFn = httpsCallable<
  { slug: string; filename: string; base64Data: string },
  { path: string; commitSha: string }
>(functions, 'blogUploadImage');

// ── GitHub ──

export const blogListExistingPostsFn = httpsCallable<
  Record<string, never>,
  { posts: ExistingPost[] }
>(functions, 'blogListExistingPosts');

export const blogFetchExistingPostFn = httpsCallable<
  { filename: string },
  { filename: string; slug: string; frontMatter: FrontMatter; body: string; sha: string }
>(functions, 'blogFetchExistingPost');

export type ImportAuthorChoice =
  | 'default'
  | 'keep'
  | { value: string };

export const blogImportPostForEditFn = httpsCallable<
  { filename: string; authorChoice: ImportAuthorChoice },
  { draftId: string; created: boolean }
>(functions, 'blogImportPostForEdit');

// ── Series usage ──

export interface SeriesUsageEntry {
  source: 'published' | 'draft';
  series: string;
  seriesOrder: number | null;
  title: string;
  filename: string;
  draftId?: string;
  status?: string;
}

export const blogListSeriesUsageFn = httpsCallable<
  Record<string, never>,
  { posts: SeriesUsageEntry[]; drafts: SeriesUsageEntry[] }
>(functions, 'blogListSeriesUsage');
