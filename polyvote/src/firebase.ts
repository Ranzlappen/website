/*
 * CHANGE: New file – Firebase initialization for PolyVote
 * REASON: Reuses the same Firebase project (proven-concept-436717-q3) as the parent repo
 * DATE: 2026-04-02
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

/**
 * Firebase config – same project as the parent Jekyll site.
 * Credentials are public client-side keys (safe to commit).
 * Security is enforced via Firestore rules on the backend.
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

signInAnonymously(auth).catch(console.error);
