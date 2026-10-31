/**
 * Slash-command definitions (registered by `wvw-adminRegisterCommands`) and
 * the option parsing that turns a `/raid schedule` into an `EventInput`.
 */
import { EVENT_TYPES, MAPS, OPENNESS } from '../shared/constants';

const STRING = 3;
const INTEGER = 4;
const BOOLEAN = 5;
const SUB = 1;

const choices = (list: readonly { id: string; label: string }[]) =>
  list.map((x) => ({ name: x.label.slice(0, 100), value: x.id }));

export const COMMANDS = [
  {
    name: 'raid',
    description: 'Schedule and run WvW raids on the WvW Hub calendar',
    type: 1,
    dm_permission: false,
    options: [
      {
        type: SUB,
        name: 'schedule',
        description: 'Put a raid on the calendar (announced here and on the website)',
        options: [
          { type: STRING, name: 'guild', description: 'Guild you lead for', required: true, autocomplete: true },
          { type: STRING, name: 'title', description: 'e.g. "Monday night zerg"', required: true, max_length: 80 },
          { type: STRING, name: 'type', description: 'Raid type', required: true, choices: choices(EVENT_TYPES) },
          { type: STRING, name: 'date', description: 'First date, YYYY-MM-DD', required: true, min_length: 10, max_length: 10 },
          { type: STRING, name: 'time', description: 'Start time HH:MM (24h, your time zone)', required: true, min_length: 5, max_length: 5 },
          { type: STRING, name: 'timezone', description: 'Your time zone (default: your Hub preference or UTC)', autocomplete: true },
          { type: INTEGER, name: 'duration', description: 'Minutes (default 120)', min_value: 15, max_value: 720 },
          {
            type: STRING,
            name: 'repeat',
            description: 'One-off or weekly',
            choices: [
              { name: 'One-off', value: 'none' },
              { name: 'Weekly', value: 'weekly' },
            ],
          },
          { type: STRING, name: 'days', description: 'Weekly days, e.g. "mon,wed,fri" (default: the date’s weekday)' },
          { type: STRING, name: 'map', description: 'Map (team-only detail)', choices: choices(MAPS) },
          { type: STRING, name: 'openness', description: 'Who can join', choices: choices(OPENNESS) },
          { type: STRING, name: 'languages', description: 'Language codes, e.g. "en,de" (default en)' },
          { type: STRING, name: 'voice', description: 'Voice link (team-only detail)', max_length: 300 },
          { type: STRING, name: 'goals', description: 'Goals (team-only detail)', max_length: 500 },
          { type: INTEGER, name: 'expected', description: 'Expected squad size (team-only detail)', min_value: 1, max_value: 100 },
        ],
      },
      {
        type: SUB,
        name: 'list',
        description: 'Upcoming raids for your team (or a region)',
        options: [
          {
            type: STRING,
            name: 'region',
            description: 'Region (default: your team)',
            choices: [
              { name: 'EU', value: 'eu' },
              { name: 'NA', value: 'na' },
            ],
          },
          { type: BOOLEAN, name: 'mine', description: 'Only raids you posted' },
        ],
      },
      {
        type: SUB,
        name: 'live',
        description: 'Go live — starts a run and posts it with a Check-in button',
        options: [
          { type: STRING, name: 'event', description: 'Your scheduled raid', autocomplete: true },
          { type: STRING, name: 'guild', description: 'Ad-hoc run: guild', autocomplete: true },
          { type: STRING, name: 'type', description: 'Ad-hoc run: type', choices: choices(EVENT_TYPES) },
          { type: STRING, name: 'map', description: 'Map you are on', choices: choices(MAPS) },
          { type: STRING, name: 'voice', description: 'Hub voice channel link (enables voice counts)', max_length: 300 },
        ],
      },
      {
        type: SUB,
        name: 'end',
        description: 'End your live run (stats + rating window open)',
        options: [
          { type: INTEGER, name: 'peak', description: 'Peak squad size you saw', min_value: 1, max_value: 100 },
          { type: STRING, name: 'log', description: 'dps.report link(s), space separated', max_length: 1000 },
        ],
      },
      {
        type: SUB,
        name: 'cancel',
        description: 'Cancel one of your scheduled raids',
        options: [{ type: STRING, name: 'event', description: 'Your raid', required: true, autocomplete: true }],
      },
    ],
  },
  {
    name: 'wvw',
    description: 'WvW Hub utilities',
    type: 1,
    options: [
      { type: SUB, name: 'me', description: 'Your verification status' },
      { type: SUB, name: 'verify', description: 'How to verify your GW2 account' },
      { type: SUB, name: 'matchup', description: 'Current matchup for your team' },
      { type: SUB, name: 'relink', description: 'Countdown to the next relink + reset' },
    ],
  },
] as const;

const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, so: 0,
  mon: 1, monday: 1, mo: 1,
  tue: 2, tuesday: 2, di: 2,
  wed: 3, wednesday: 3, mi: 3,
  thu: 4, thursday: 4, do: 4,
  fri: 5, friday: 5, fr: 5,
  sat: 6, saturday: 6, sa: 6,
};

/** "mon, wed fri" → [1, 3, 5]; unknown tokens are ignored. */
export function parseDays(s: string | undefined): number[] {
  if (!s) return [];
  const out = new Set<number>();
  for (const tok of s.toLowerCase().split(/[\s,;/]+/)) {
    if (tok in DAY_NAMES) out.add(DAY_NAMES[tok]);
  }
  return [...out].sort((a, b) => a - b);
}

export function parseLanguages(s: string | undefined): string[] {
  if (!s) return ['en'];
  return [...new Set(s.toLowerCase().split(/[\s,;/]+/).filter(Boolean))].slice(0, 4);
}

export interface InteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: InteractionOption[];
}

/** Flatten `/raid schedule …` into { sub, opts, focused }. */
export function flattenOptions(options: InteractionOption[] | undefined): {
  sub: string | null;
  opts: Record<string, string | number | boolean>;
  focused: string | null;
} {
  const opts: Record<string, string | number | boolean> = {};
  let sub: string | null = null;
  let focused: string | null = null;
  let list = options ?? [];
  if (list.length === 1 && list[0].type === SUB) {
    sub = list[0].name;
    list = list[0].options ?? [];
  }
  for (const o of list) {
    if (o.value !== undefined) opts[o.name] = o.value;
    if (o.focused) focused = o.name;
  }
  return { sub, opts, focused };
}

/** dps.report permalinks out of free text. */
export function parseLogLinks(s: string | undefined): string[] {
  if (!s) return [];
  const re = /https:\/\/(?:[a-z]\.)?dps\.report\/[A-Za-z0-9_-]+/g;
  return [...new Set(s.match(re) ?? [])].slice(0, 10);
}
