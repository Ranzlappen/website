export interface FrontMatter {
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  image: string;
  status: 'published' | 'draft' | 'placeholder' | 'unpublished';
  series: string | null;
  seriesOrder: number | null;
  comments: boolean;
  author: string | null;
  keywords: string[];
  backdrop: string | null;
  polyvoteTopic: string | null;
}

export interface BlogDraft {
  id: string;
  slug: string;
  filename: string;
  frontMatter: FrontMatter;
  body: string;
  authorUid: string;
  createdAt: number;
  updatedAt: number;
  githubSha: string | null;
  lastPublishedAt: number | null;
  draftStatus: 'editing' | 'published' | 'archived';
  // Set when this draft was created by importing an existing GitHub post
  // in "Edit" mode. Used to route re-imports back to the same draft and to
  // distinguish a legitimate update from a silent overwrite at publish time.
  sourceFilename: string | null;
}

export interface ExistingPost {
  name: string;
  sha: string;
  size: number;
}

export type UserRole = 'user' | 'author' | 'moderator' | 'admin';

export const CATEGORIES = [
  'Media',
  'Projects',
  'Technology',
  'Privacy',
  'UX Design',
] as const;

export const STATUSES = [
  'published',
  'draft',
  'placeholder',
  'unpublished',
] as const;

export const SERIES_OPTIONS = [
  { id: 'media-trust', label: 'Media, Trust & Power' },
  { id: 'project-showcases', label: 'Project Showcases' },
  { id: 'privacy-and-control', label: 'Privacy & User Control' },
] as const;

export function createEmptyFrontMatter(): FrontMatter {
  const today = new Date().toISOString().split('T')[0];
  return {
    title: '',
    description: '',
    date: today,
    category: '',
    tags: [],
    image: '',
    status: 'draft',
    series: null,
    seriesOrder: null,
    comments: true,
    author: null,
    keywords: [],
    backdrop: null,
    polyvoteTopic: null,
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
