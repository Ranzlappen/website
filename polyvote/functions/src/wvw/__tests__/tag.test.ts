/** Commander tag, /squadjoin and optional titles (raid editor + CSV import). */
import { describe, expect, it } from 'vitest';
import { cleanSquadJoin, cleanTag, defaultTitle, validateEventInput } from '../events';
import { parseTag } from '../import';
import { toPublicEvent, type EventDoc } from '../indexes';

const base = {
  guildId: null,
  title: 'Reset blob',
  type: 'zerg',
  openness: 'open',
  languages: ['en'],
  schedule: { tz: 'Europe/Berlin', date: '2026-11-06', time: '20:00', durationMin: 120, repeat: 'none', days: [] },
  map: 'ebg',
  goals: '',
  expectedSize: null,
  voice: null,
  buildsUrl: null,
  notes: '',
};
const now = Date.parse('2026-11-04T12:00:00Z');

describe('commander tag', () => {
  it('accepts every colour in both shapes; absent = default (null)', () => {
    expect(cleanTag({ color: 'magenta', shape: 'catmander' })).toEqual({ color: 'magenta', shape: 'catmander' });
    expect(cleanTag({ color: 'red' })).toEqual({ color: 'red', shape: 'commander' });
    expect(cleanTag(null)).toBeNull();
    expect(cleanTag(undefined)).toBeNull();
  });
  it('rejects unknown colours and shapes', () => {
    expect(() => cleanTag({ color: 'black' })).toThrow(/colour/);
    expect(() => cleanTag({ color: 'red', shape: 'dogmander' })).toThrow(/catmander/);
  });
  it('is part of the public event row', () => {
    const e = { ...validateEventInput({ ...base, tag: { color: 'yellow', shape: 'commander' } }, now), id: 'x' } as unknown as EventDoc;
    expect(toPublicEvent(e).tag).toEqual({ color: 'yellow', shape: 'commander' });
    expect(toPublicEvent({ ...e, tag: undefined } as unknown as EventDoc).tag).toBeNull();
  });
  it('parses the CSV tag column', () => {
    expect(parseTag('red')).toEqual({ color: 'red', shape: 'commander' });
    expect(parseTag('cat purple')).toEqual({ color: 'purple', shape: 'catmander' });
    expect(parseTag('Catmander:White')).toEqual({ color: 'white', shape: 'catmander' });
    expect(parseTag('pink')).toEqual({ color: 'magenta', shape: 'commander' });
    expect(parseTag('')).toBeNull();
    expect(() => parseTag('cat')).toThrow(/Unknown tag/);
  });
});

describe('squad join', () => {
  it('keeps just the name, also from a pasted command', () => {
    expect(cleanSquadJoin('Lady Sylvari')).toBe('Lady Sylvari');
    expect(cleanSquadJoin('/squadjoin  Lady   Sylvari ')).toBe('Lady Sylvari');
    expect(cleanSquadJoin('/sqjoin Name.1234')).toBe('Name.1234');
    expect(cleanSquadJoin('Ælfwyn Ñúñez')).toBe('Ælfwyn Ñúñez');
    expect(cleanSquadJoin('')).toBeNull();
    expect(cleanSquadJoin(null)).toBeNull();
  });
  it('rejects anything that is not a name', () => {
    expect(() => cleanSquadJoin('Name; /dance')).toThrow(/character or account name/);
    expect(() => cleanSquadJoin('x'.repeat(41))).toThrow(/too long/);
  });
  it('round-trips through event validation', () => {
    expect(validateEventInput({ ...base, squadJoin: '/sqjoin Tag Man' }, now).squadJoin).toBe('Tag Man');
  });
});

describe('optional title', () => {
  it('falls back to the raid type', () => {
    expect(validateEventInput({ ...base, title: '' }, now).title).toBe(defaultTitle('zerg'));
    expect(validateEventInput({ ...base, title: '   ', type: 'havoc' }, now).title).toBe('Havoc');
    expect(validateEventInput({ ...base, title: undefined }, now).title).toBe('Zerg / blob');
  });
});
