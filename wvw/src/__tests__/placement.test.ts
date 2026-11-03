import { describe, expect, it } from 'vitest';
import { placeRaids } from '../lib/placement';
import type { MatchSummary, PublicEvent } from '../shared/types';
import type { MapId } from '../shared/constants';

const side = (teamId: number) => ({ teamId, score: 0, victoryPoints: 0, kills: 0, deaths: 0, owned: { camps: 0, towers: 0, keeps: 0, castles: 0 }, claimingGuilds: 0 });
const match: Pick<MatchSummary, 'sides'> = { sides: { red: side(12001), blue: side(12002), green: side(12003) } };

function ev(id: string, teamId: number, map: MapId, extra: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id,
    guildId: 'G',
    guildTag: 'TAG',
    guildName: 'Guild',
    official: false,
    region: 'eu',
    teamId,
    title: id,
    type: 'zerg',
    map,
    audience: 'everyone',
    openness: 'open',
    languages: ['en'],
    schedule: { tz: 'UTC', date: '2026-11-01', time: '20:00', durationMin: 120, repeat: 'none' },
    status: 'scheduled',
    liveRunId: null,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

describe('matchup map placement', () => {
  const now = Date.parse('2026-11-01T19:00:00Z');
  const at = (h: number) => Date.parse(`2026-11-01T${String(h).padStart(2, '0')}:00:00Z`);

  it('puts a raid in the third of the organising team’s colour on its map', () => {
    const p = placeRaids(
      match,
      [
        { e: ev('redOnEbg', 12001, 'ebg'), start: at(20), end: at(22) },
        { e: ev('greenOnRedBl', 12003, 'red'), start: at(21), end: at(23) },
        { e: ev('blueJumper', 12002, 'jumper'), start: at(20), end: at(21) },
      ],
      now,
    );
    expect(p.ebg.red.map((x) => x.e.id)).toEqual(['redOnEbg']);
    expect(p.red.green.map((x) => x.e.id)).toEqual(['greenOnRedBl']);
    expect(p.red.red).toEqual([]);
    expect(p.jumper.blue.map((x) => x.e.id)).toEqual(['blueJumper']);
  });

  it('ignores raids of teams outside the matchup and merges repeat occurrences', () => {
    const weekly = ev('weekly', 12002, 'blue');
    const p = placeRaids(
      match,
      [
        { e: ev('otherMatch', 12009, 'ebg'), start: at(20), end: at(22) },
        { e: weekly, start: at(20), end: at(22) },
        { e: weekly, start: at(20) + 86_400_000, end: at(22) + 86_400_000 },
      ],
      now,
    );
    expect(Object.values(p.ebg).flat()).toEqual([]);
    expect(p.blue.blue).toHaveLength(1);
    expect(p.blue.blue[0].more).toBe(1);
  });

  it('sorts live raids first, then by start', () => {
    const p = placeRaids(
      match,
      [
        { e: ev('later', 12001, 'ebg'), start: at(20), end: at(22) },
        { e: ev('running', 12001, 'ebg'), start: at(18), end: at(21) },
        { e: ev('liveRun', 12001, 'ebg', { liveRunId: 'r1' }), start: at(21), end: at(23) },
      ],
      now,
    );
    expect(p.ebg.red.map((x) => [x.e.id, x.live])).toEqual([
      ['running', true],
      ['liveRun', true],
      ['later', false],
    ]);
  });
});
