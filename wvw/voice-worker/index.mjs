// WvW Hub voice worker — the ONLY always-on piece, and optional.
//
// Holds one Discord gateway connection (intents: GUILDS + GUILD_VOICE_STATES,
// both non-privileged), tracks how many people sit in each voice channel of
// the guilds the bot is in, and once a minute POSTs per-channel COUNTS to the
// `wvw-voiceSamples` Cloud Function, HMAC-signed. Live runs linked to a hub
// voice channel then get real headcounts (peak / average).
//
// Dependency-free (Node 22 has a global WebSocket). Run anywhere: Cloud Run in
// the same GCP project (min-instances=1, no CPU throttling), a VPS, a Pi.
//
// Env:
//   DISCORD_BOT_TOKEN   same bot token as WVW_SECRETS.discordBotToken
//   VOICE_ENDPOINT      https://us-central1-<project>.cloudfunctions.net/wvw-voiceSamples
//   VOICE_SECRET        same as WVW_SECRETS.voiceWorkerSecret
//   PORT                (optional) health-check port, Cloud Run sets it
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { createVoiceState } from './state.mjs';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const ENDPOINT = process.env.VOICE_ENDPOINT;
const SECRET = process.env.VOICE_SECRET;
if (!TOKEN || !ENDPOINT || !SECRET) {
  console.error('Set DISCORD_BOT_TOKEN, VOICE_ENDPOINT and VOICE_SECRET.');
  process.exit(1);
}

const INTENTS = (1 << 0) | (1 << 7); // GUILDS | GUILD_VOICE_STATES
const SAMPLE_MS = 60_000;
const API = 'https://discord.com/api/v10';

const voice = createVoiceState();
let ws = null;
let seq = null;
let sessionId = null;
let resumeUrl = null;
let heartbeat = null;
let acked = true;
let backoff = 1000;
let lastPost = { at: 0, ok: false };

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function gatewayUrl() {
  const res = await fetch(`${API}/gateway/bot`, { headers: { Authorization: `Bot ${TOKEN}` } });
  if (!res.ok) throw new Error(`gateway/bot ${res.status}`);
  return (await res.json()).url;
}

function send(op, d) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op, d }));
}

function startHeartbeat(interval) {
  clearInterval(heartbeat);
  acked = true;
  setTimeout(() => send(1, seq), Math.floor(interval * Math.random()));
  heartbeat = setInterval(() => {
    if (!acked) {
      log('heartbeat not acked — reconnecting');
      ws?.close(4000, 'zombie');
      return;
    }
    acked = false;
    send(1, seq);
  }, interval);
}

function identify() {
  send(2, { token: TOKEN, intents: INTENTS, properties: { os: process.platform, browser: 'wvw-hub', device: 'wvw-hub' } });
}

async function connect(resume) {
  const base = resume && resumeUrl ? resumeUrl : await gatewayUrl();
  ws = new WebSocket(`${base}/?v=10&encoding=json`);
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.s != null) seq = msg.s;
    switch (msg.op) {
      case 10:
        startHeartbeat(msg.d.heartbeat_interval);
        if (resume && sessionId) send(6, { token: TOKEN, session_id: sessionId, seq });
        else identify();
        break;
      case 11:
        acked = true;
        break;
      case 1:
        send(1, seq);
        break;
      case 7:
        ws.close(4000, 'reconnect requested');
        break;
      case 9:
        if (!msg.d) {
          sessionId = null;
          seq = null;
        }
        setTimeout(() => (msg.d ? send(6, { token: TOKEN, session_id: sessionId, seq }) : identify()), 1000 + Math.random() * 4000);
        break;
      case 0:
        backoff = 1000;
        if (msg.t === 'READY') {
          sessionId = msg.d.session_id;
          resumeUrl = msg.d.resume_gateway_url;
          log(`ready as ${msg.d.user.username} in ${msg.d.guilds.length} guild(s)`);
        } else if (msg.t === 'GUILD_CREATE') voice.guildCreate(msg.d);
        else if (msg.t === 'GUILD_DELETE') voice.guildDelete(msg.d);
        else if (msg.t === 'VOICE_STATE_UPDATE') voice.voiceStateUpdate(msg.d);
        break;
    }
  });
  ws.addEventListener('close', (ev) => {
    clearInterval(heartbeat);
    if ([4004, 4010, 4011, 4012, 4013, 4014].includes(ev.code)) {
      console.error(`fatal gateway close ${ev.code} ${ev.reason} — check token/intents`);
      process.exit(1);
    }
    const canResume = ![4007, 4009].includes(ev.code) && !!sessionId;
    log(`gateway closed (${ev.code}) — ${canResume ? 'resuming' : 'reconnecting'} in ${backoff}ms`);
    setTimeout(() => connect(canResume).catch(onConnectError), backoff);
    backoff = Math.min(backoff * 2, 60_000);
  });
  ws.addEventListener('error', () => {
    /* close handler reconnects */
  });
}

function onConnectError(e) {
  log('connect failed', String(e));
  setTimeout(() => connect(false).catch(onConnectError), backoff);
  backoff = Math.min(backoff * 2, 60_000);
}

async function postSamples() {
  const body = JSON.stringify({ at: Date.now(), channels: voice.counts().map(({ channelId, count }) => ({ channelId, count })) });
  const sig = createHmac('sha256', SECRET).update(body).digest('hex');
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wvw-signature': sig }, body });
    lastPost = { at: Date.now(), ok: res.ok };
    if (!res.ok) log('sample post failed', res.status, await res.text());
  } catch (e) {
    lastPost = { at: Date.now(), ok: false };
    log('sample post error', String(e));
  }
}

setInterval(postSamples, SAMPLE_MS);

createServer((_req, res) => {
  const healthy = ws?.readyState === WebSocket.OPEN;
  res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ gateway: healthy, lastPost }));
}).listen(Number(process.env.PORT || 8080));

connect(false).catch(onConnectError);
process.on('SIGTERM', () => {
  ws?.close(1000);
  process.exit(0);
});
