/**
 * Re-export of the canonical client-id helper (now in the net layer). Kept here
 * so existing UI imports (`../ui/identity`) keep working.
 */
export { getClientId } from '../net/identity';
