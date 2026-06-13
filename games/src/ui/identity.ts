/** A stable, per-browser client id used as the player's id in online rooms. */
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
