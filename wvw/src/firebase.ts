/**
 * Firebase client for WvW Hub.
 *
 * Same public project config as the other apps, but a NAMED app ("wvw-hub")
 * so its auth session is persisted separately: signing in here with Discord
 * never replaces a Blog Admin / PolyVote / Tabletop session on the same
 * origin, and vice-versa.
 *
 * Reads: a few public index docs + the member's own doc (Firestore rules in
 * polyvote/firestore.rules). Writes: callables only ("wvw-<name>").
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyByEwHUnausbBmyRT928uGTRw5ZvszjjiM',
  authDomain: 'proven-concept-436717-q3.firebaseapp.com',
  projectId: 'proven-concept-436717-q3',
  storageBucket: 'proven-concept-436717-q3.firebasestorage.app',
  messagingSenderId: '420991269376',
  appId: '1:420991269376:web:8b2d0bcac98ffd92abb6e5',
};

export const app = initializeApp(firebaseConfig, 'wvw-hub');
export const auth = getAuth(app);
export const firestore = getFirestore(app);
const functions = getFunctions(app);

/** Call `wvw-<name>`; rejects with the server's (user-readable) message. */
export async function call<Res = unknown, Req = unknown>(name: string, data?: Req): Promise<Res> {
  const fn = httpsCallable<Req, Res>(functions, `wvw-${name}`);
  const res = await fn(data as Req);
  return res.data;
}

const NOT_DEPLOYED = 'The WvW Hub server isn’t reachable — it may not be deployed yet (see wvw/README.md → Setup). Please try again later.';

/**
 * Human-readable callable errors. A callable that doesn't exist (backend not
 * deployed) or can't be reached surfaces as code "functions/internal" with the
 * bare message "internal" — show a setup hint instead of "internal [0]".
 */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message);
    const code = String((e as { code?: string }).code ?? '');
    if (msg === 'internal' || /^internal\b/.test(msg)) return NOT_DEPLOYED;
    if (code === 'functions/unavailable' && /unavailable/i.test(msg)) return NOT_DEPLOYED;
    if (code === 'functions/not-found' && msg === 'not-found') return NOT_DEPLOYED;
    return msg.replace(/^Firebase: /, '');
  }
  return 'Something went wrong.';
}

/** Firestore read errors on public docs → readable text. */
export function friendlyLoadError(error: string): string {
  if (/permission|insufficient/i.test(error)) {
    return 'Raids can’t be loaded yet — the WvW Hub database rules aren’t deployed (see wvw/README.md → Setup).';
  }
  return `Could not load raids: ${error}`;
}
