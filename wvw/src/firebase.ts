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

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message);
    // Firebase prefixes some codes ("internal", "unavailable") — keep it human.
    if (msg === 'internal') return 'Something went wrong on our side — please try again.';
    return msg.replace(/^Firebase: /, '');
  }
  return 'Something went wrong.';
}
