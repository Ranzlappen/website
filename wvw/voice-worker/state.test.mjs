import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceState } from './state.mjs';

test('tracks joins, moves and leaves per channel', () => {
  const s = createVoiceState();
  s.guildCreate({
    id: 'g1',
    voice_states: [
      { user_id: 'a', channel_id: 'c1' },
      { user_id: 'b', channel_id: 'c1' },
      { user_id: 'bot', channel_id: 'c1' },
    ],
    members: [{ user: { id: 'bot', bot: true } }],
  });
  assert.deepEqual(s.counts(), [{ guildId: 'g1', channelId: 'c1', count: 2 }]);

  s.voiceStateUpdate({ guild_id: 'g1', user_id: 'c', channel_id: 'c2', member: { user: { id: 'c' } } });
  s.voiceStateUpdate({ guild_id: 'g1', user_id: 'a', channel_id: 'c2', member: { user: { id: 'a' } } });
  s.voiceStateUpdate({ guild_id: 'g1', user_id: 'b', channel_id: null, member: { user: { id: 'b' } } });
  s.voiceStateUpdate({ guild_id: 'g1', user_id: 'x', channel_id: 'c2', member: { user: { id: 'x', bot: true } } });
  assert.deepEqual(s.counts(), [{ guildId: 'g1', channelId: 'c2', count: 2 }]);

  s.guildDelete({ id: 'g1' });
  assert.deepEqual(s.counts(), []);
});

test('counts never include user ids', () => {
  const s = createVoiceState();
  s.guildCreate({ id: 'g', voice_states: [{ user_id: 'secret-user', channel_id: 'c' }] });
  assert.equal(JSON.stringify(s.counts()).includes('secret-user'), false);
});
