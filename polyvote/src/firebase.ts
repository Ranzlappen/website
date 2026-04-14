/*
 * CHANGE: Updated – Firebase initialization with Cloud Functions and admin auth
 * REASON: Added getFunctions for Cloud Function calls, EmailAuthProvider for admin sign-in
 * DATE: 2026-04-14
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, EmailAuthProvider } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Firebase config – same project as the parent Jekyll site.
 * Credentials are public client-side keys (safe to commit).
 * Security is enforced via Firestore rules + Cloud Functions on the backend.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyByEwHUnausbBmyRT928uGTRw5ZvszjjiM',
  authDomain: 'proven-concept-436717-q3.firebaseapp.com',
  projectId: 'proven-concept-436717-q3',
  storageBucket: 'proven-concept-436717-q3.appspot.com',
  messagingSenderId: '420991269376',
  appId: '1:420991269376:web:8b2d0bcac98ffd92abb6e5',
};

const app = initializeApp(firebaseConfig);

/** Firestore instance used throughout PolyVote */
export const db = getFirestore(app);

/** Firebase Auth instance – supports anonymous + signed-in users */
export const auth = getAuth(app);

/** Cloud Functions instance for calling backend functions */
export const functions = getFunctions(app);

/** Email auth provider for admin sign-in */
export const emailProvider = new EmailAuthProvider();

signInAnonymously(auth).catch(console.error);

// ── Cloud Function callables ──

/** Cast a vote (server-validated) */
export const castVoteFn = httpsCallable<
  { topicId: string; metricId: string; choiceId: string },
  { changed: boolean; isChange?: boolean }
>(functions, 'castVote');

/** Report content */
export const reportContentFn = httpsCallable<
  { type: string; targetId: string; parentId?: string; reason: string; description?: string },
  { id: string }
>(functions, 'reportContent');

/** Bootstrap the first admin (only works when no admin exists) */
export const bootstrapAdminFn = httpsCallable<
  Record<string, never>,
  { success: boolean; message: string }
>(functions, 'bootstrapAdmin');

// ── Admin callables ──

export const adminCreateTopicFn = httpsCallable(functions, 'adminCreateTopic');
export const adminEditTopicFn = httpsCallable(functions, 'adminEditTopic');
export const adminDeleteTopicFn = httpsCallable(functions, 'adminDeleteTopic');
export const adminListUsersFn = httpsCallable(functions, 'adminListUsers');
export const adminBanUserFn = httpsCallable(functions, 'adminBanUser');
export const adminUnbanUserFn = httpsCallable(functions, 'adminUnbanUser');
export const setUserRoleFn = httpsCallable(functions, 'setUserRole');
export const adminDeleteCommentFn = httpsCallable(functions, 'adminDeleteComment');
export const adminReviewReportFn = httpsCallable(functions, 'adminReviewReport');
export const adminListReportsFn = httpsCallable(functions, 'adminListReports');
export const adminUpdateRequestStatusFn = httpsCallable<
  { requestId: string; changeStatuses: { changeId: string; status: 'approved' | 'rejected' }[] },
  { success: boolean; status: string }
>(functions, 'adminUpdateRequestStatus');
export const adminBulkUpdateRequestsFn = httpsCallable(functions, 'adminBulkUpdateRequests');
export const adminGetAnalyticsFn = httpsCallable(functions, 'adminGetAnalytics');
export const adminGetVotingTrendsFn = httpsCallable(functions, 'adminGetVotingTrends');

// ── User callables (server-validated writes) ──

/** Post a comment (server-validated with rate limiting) */
export const postCommentFn = httpsCallable<
  { topicId: string; text: string; parentId?: string },
  { id: string }
>(functions, 'postComment');

/** Create a topic request/proposal (server-validated) */
export const createTopicRequestFn = httpsCallable<
  { title: string; description: string; category: string; metrics: unknown[] },
  { id: string }
>(functions, 'createTopicRequest');

/** Endorse a topic request (atomic, dedup-safe) */
export const endorseTopicRequestFn = httpsCallable<
  { requestId: string },
  { newCount: number }
>(functions, 'endorseTopicRequest');

/** Create a structured change request (server-validated) */
export const createChangeRequestFn = httpsCallable<
  { topicId: string; topicTitle: string; description: string; changes: unknown[] },
  { id: string }
>(functions, 'createChangeRequest');
