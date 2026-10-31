// Pure voice-occupancy bookkeeping for the gateway worker (unit-tested).
// Tracks userId → channelId per guild from GUILD_CREATE + VOICE_STATE_UPDATE
// and turns it into per-channel headcounts. User ids never leave this process.

export function createVoiceState() {
  /** @type {Map<string, Map<string, string>>} guildId → (userId → channelId) */
  const guilds = new Map();

  function guild(id) {
    let g = guilds.get(id);
    if (!g) {
      g = new Map();
      guilds.set(id, g);
    }
    return g;
  }

  return {
    /** GUILD_CREATE: replace the guild's snapshot. */
    guildCreate(d) {
      const g = new Map();
      for (const vs of d.voice_states ?? []) {
        const isBot = vs.member?.user?.bot === true;
        if (vs.channel_id && !isBot) g.set(vs.user_id, vs.channel_id);
      }
      // voice_states in GUILD_CREATE lack member.user.bot; filter known bots from members.
      const bots = new Set((d.members ?? []).filter((m) => m.user?.bot).map((m) => m.user.id));
      for (const id of bots) g.delete(id);
      guilds.set(d.id, g);
    },
    guildDelete(d) {
      guilds.delete(d.id);
    },
    /** VOICE_STATE_UPDATE */
    voiceStateUpdate(d) {
      if (!d.guild_id) return;
      const g = guild(d.guild_id);
      if (d.member?.user?.bot) return;
      if (d.channel_id) g.set(d.user_id, d.channel_id);
      else g.delete(d.user_id);
    },
    /** [{ guildId, channelId, count }] for every non-empty channel. */
    counts() {
      const out = [];
      for (const [guildId, g] of guilds) {
        const per = new Map();
        for (const ch of g.values()) per.set(ch, (per.get(ch) ?? 0) + 1);
        for (const [channelId, count] of per) out.push({ guildId, channelId, count });
      }
      return out;
    },
  };
}
