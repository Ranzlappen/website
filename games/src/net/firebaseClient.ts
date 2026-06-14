/**
 * Firebase client bootstrap for the games module.
 *
 * Uses the same public, client-safe project config as the rest of the site
 * (these keys are not secrets — security is enforced by Firebase rules). The
 * app is initialised lazily and only when Firebase multiplayer is actually
 * switched on, so the offline/local experience never pays for the Firebase SDK.
 *
 * NOTE: real-time multiplayer uses the Realtime Database. The `databaseURL`
 * below points at this project's RTDB in the **europe-west1** region. The games
 * RTDB rules (`/games-rooms`, `/games-states`) and the server arbiter functions
 * deploy from the repo via firebase-deploy.yml — see
 * docs/wiki/firebase-multiplayer.md. When Firebase isn't reachable the app uses
 * the local cross-tab adapter automatically.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: 'AIzaSyByEwHUnausbBmyRT928uGTRw5ZvszjjiM',
  authDomain: 'proven-concept-436717-q3.firebaseapp.com',
  projectId: 'proven-concept-436717-q3',
  databaseURL: 'https://proven-concept-436717-q3-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: 'proven-concept-436717-q3.firebasestorage.app',
  messagingSenderId: '420991269376',
  appId: '1:420991269376:web:8b2d0bcac98ffd92abb6e5',
};

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig, 'tabletop-games');
  return app;
}

/** Whether a Realtime Database URL is configured (a precondition for sync). */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.databaseURL);
}

let authReady: Promise<string> | null = null;

/**
 * Sign in anonymously and resolve the uid. Online play is server-authoritative:
 * the uid is the player's identity (RTDB rules + the arbiter key off it), so a
 * client can't act as another player. Memoized; the `firebase/auth` SDK is
 * imported lazily so the offline/local experience never downloads it. Requires
 * Anonymous Auth to be enabled in the Firebase console.
 */
export function ensureAnonUid(): Promise<string> {
  if (!authReady) {
    authReady = (async () => {
      const { getAuth, onAuthStateChanged, signInAnonymously } = await import(
        'firebase/auth'
      );
      const auth = getAuth(getFirebaseApp());
      return new Promise<string>((resolve, reject) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsub();
            resolve(user.uid);
          }
        });
        if (!auth.currentUser) signInAnonymously(auth).catch(reject);
      });
    })();
  }
  return authReady;
}

/** Call a games Cloud Function (lazy-loads `firebase/functions`). */
export async function callGames<Req, Res>(name: string, data: Req): Promise<Res> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<Req, Res>(getFunctions(getFirebaseApp()), name);
  const res = await fn(data);
  return res.data;
}
