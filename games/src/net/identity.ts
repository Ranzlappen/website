/**
 * Stable per-browser id used as a player's id for the *local* sync backend.
 * (The Firebase backend uses the anonymous-auth uid instead — see
 * `firebaseClient.ensureAnonUid`.) Lives in the net layer so adapters can use it
 * without depending on the React UI.
 */
const KEY = 'tabletop:client-id';

export function getClientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `c_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `c_${Math.random().toString(36).slice(2)}`;
  }
}
