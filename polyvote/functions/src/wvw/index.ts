/**
 * WvW Hub — Cloud Functions, exported as ONE group (`wvw-*`).
 *
 * Grouping means the deploy target is just `functions:wvw` (firebase-deploy.yml)
 * and a new WvW function never needs a workflow edit. Callable names on the
 * client are therefore "wvw-<name>" and HTTP endpoints live at
 * https://us-central1-<project>.cloudfunctions.net/wvw-<name>.
 * Architecture + setup: wvw/README.md.
 */

// Phase 0 — public data
export { poll } from './poller';
export { maintain } from './maintenance';

// Phase 1 — identity, verification, guilds, events, reports, calendar feeds
export { discordLogin } from './auth';
export { verifyApiKey, rotateChallenge, updatePrefs, forgetApiKey, deleteMyData } from './members';
export {
  claimGuild,
  updateGuildProfile,
  createCommanderInvite,
  redeemCommanderInvite,
  listGuildCommanders,
  removeGuildCommander,
} from './guilds';
export { createEvent, updateEvent, cancelEvent, getEventDetails, listMyEvents } from './events';
export { report, modListReports, modResolveReport } from './reports';
export { ical } from './ical';
export { adminGetSettings, adminUpdateSettings, adminSetRole, adminListMods } from './admin';

// Phase 2 — Discord bot + hub server
export { discordInteractions, discordJobs } from './discord/interactions';
export { adminProvisionDiscord, adminRegisterCommands, adminDiscordInfo } from './discord/provision';

// Phase 3 — runs, metrics, ratings, voice headcounts
export { startRun, endRun, addRunLogs, checkIn, rateRun, myRunState } from './runs';
export { voiceSamples } from './voice';
