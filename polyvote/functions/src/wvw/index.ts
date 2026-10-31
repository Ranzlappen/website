/**
 * WvW Hub — Cloud Functions, exported as ONE group (`wvw-*`).
 *
 * Grouping means the deploy target is just `functions:wvw` (firebase-deploy.yml)
 * and a new WvW function never needs a workflow edit. Callable names on the
 * client are therefore "wvw-<name>" and HTTP endpoints live at
 * https://us-central1-<project>.cloudfunctions.net/wvw-<name>.
 * Architecture + setup: wvw/README.md. The Discord integration (bot, hub
 * server, role sync, voice headcounts) is deferred — see the README.
 */

// Phase 0 — public data
export { poll } from './poller';
export { maintain } from './maintenance';

// Phase 1 — sign-in/verification (GW2 API key), guilds, events, reports, calendar feeds
export { signIn, verifyApiKey, refreshMe, updatePrefs, forgetApiKey, deleteMyData } from './members';
export { updateGuildProfile } from './guilds';
export { createEvent, updateEvent, cancelEvent, getEventDetails, listMyEvents } from './events';
export { report, modListReports, modResolveReport } from './reports';
export { ical } from './ical';
export { adminGetSettings, adminUpdateSettings, adminSetRole, adminListMods } from './admin';
export { adminImportEvents } from './import';

// Phase 3 — runs, metrics, ratings
export { startRun, endRun, addRunLogs, checkIn, rateRun, myRunState } from './runs';
