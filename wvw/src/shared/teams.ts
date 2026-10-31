/**
 * WvW team (a.k.a. "shard") id → display name.
 *
 * MIRRORED FILE — keep identical to `polyvote/functions/src/wvw/shared/teams.ts` (see CLAUDE.md
 * "Module boundaries": no cross-module imports, duplicate intentionally).
 *
 * Since the World Restructuring, WvW "servers" are teams that ArenaNet rebuilds
 * at every relink. The API exposes only numeric team ids (11xxx = NA,
 * 12xxx = EU) — `/v2/worlds` does NOT resolve them — so the names live here.
 * Source: the Elite Insights JSON docs (`JsonWvWMapData` shard list), which
 * match the ids served by `/v2/wvw/matches` `all_worlds`. Admins can override
 * any name at runtime via `wvwPublic/config.teamNames` (Moderation → Settings),
 * so a rename in-game doesn't need a deploy.
 */

export type Region = 'na' | 'eu';

export const TEAM_NAMES: Record<number, string> = {
  11001: 'Moogooloo',
  11002: "Rall's Rest",
  11003: 'Domain of Torment',
  11004: 'Yohlon Haven',
  11005: 'Tombs of Drascir',
  11006: 'Hall of Judgment',
  11007: 'Throne of Balthazar',
  11008: "Dwayna's Temple",
  11009: "Abaddon's Prison",
  11010: 'Cathedral of Blood',
  11011: 'Lutgardis Conservatory',
  11012: 'Mosswood',
  11013: 'Mithric Cliffs',
  11014: "Lagula's Kraal",
  11015: 'De Molish Post',
  11016: 'Olafstead',
  11017: "Beacon's Perch",
  11018: 'Granite Citadel',
  12001: 'Skrittsburgh',
  12002: "Fortune's Vale",
  12003: 'Silent Woods',
  12004: "Ettin's Back",
  12005: 'Domain of Anguish',
  12006: 'Palawadan',
  12007: 'Bloodstone Gulch',
  12008: 'Frost Citadel',
  12009: 'Dragrimmar',
  12010: "Grenth's Door",
  12011: 'Mirror of Lyssa',
  12012: "Melandru's Dome",
  12013: "Kormir's Library",
  12014: 'Great House Aviary',
  12015: 'Bava Nisos',
  12016: 'Temple of Febe',
  12017: 'Gyala Hatchery',
  12018: 'Grekvelnn Burrows',
  12019: 'Stormguard',
  12020: 'Sifhalla',
  12021: "Hrothgar's Pass",
};

/** True for a restructuring-era team id (not a legacy 1xxx/2xxx world id). */
export function isTeamId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id >= 11000 && id < 13000;
}

export function regionOfTeam(teamId: number): Region | null {
  if (teamId >= 11000 && teamId < 12000) return 'na';
  if (teamId >= 12000 && teamId < 13000) return 'eu';
  return null;
}

/** Match ids are "1-x" (NA) / "2-x" (EU). */
export function regionOfMatch(matchId: string): Region | null {
  if (matchId.startsWith('1-')) return 'na';
  if (matchId.startsWith('2-')) return 'eu';
  return null;
}

export function teamName(
  teamId: number | null | undefined,
  overrides?: Record<string, string> | null,
): string {
  if (teamId == null) return 'Unknown team';
  const o = overrides?.[String(teamId)];
  if (o) return o;
  return TEAM_NAMES[teamId] ?? `Team ${teamId}`;
}

/** Pick the restructuring team id out of a match's `all_worlds[color]` array. */
export function teamFromAllWorlds(ids: readonly number[] | undefined): number | null {
  if (!ids) return null;
  for (const id of ids) if (isTeamId(id)) return id;
  return null;
}
