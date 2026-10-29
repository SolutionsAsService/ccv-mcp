// Hardening rules kept free of I/O so they can be tested without models or a LiveKit server.
// Spoken words are content: they reach the caller through voice_heard only, never a log line.

const DEV_KEY = 'devkey';
const DEV_SECRET = 'secret';
const IDENTITY = /^[A-Za-z0-9_.-]{1,64}$/;

// LiveKit settings from the environment. The dev key pair is accepted only for the LiveKit server
// ccv starts itself on loopback; an external server must come with its own key and secret.
export function livekitConfig(env, localPort) {
  const external = env.LIVEKIT_URL;
  const key = env.LIVEKIT_API_KEY;
  const secret = env.LIVEKIT_API_SECRET;
  if (external) {
    if (!key || !secret) throw new Error('LIVEKIT_URL is set: set LIVEKIT_API_KEY and LIVEKIT_API_SECRET too');
    if (key === DEV_KEY || secret === DEV_SECRET) throw new Error('the dev key pair (devkey/secret) is only for the local dev server; use real keys with LIVEKIT_URL');
  }
  return {
    url: external ?? `ws://127.0.0.1:${localPort}`,
    key: key ?? DEV_KEY,
    secret: secret ?? DEV_SECRET,
    room: env.LK_ROOM ?? 'lk-voice',
    identity: safeIdentity(env.LK_IDENTITY, 'voice-host'),
    external: Boolean(external),
  };
}

// Participant identity for a token: a short id, never free text. Anything else falls back.
export function safeIdentity(raw, fallback = 'browser') {
  return typeof raw === 'string' && IDENTITY.test(raw) ? raw : fallback;
}

// The log line for a transcribed utterance: its size and length, not its words.
export function utteranceLogLine(text, samples, rate) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return `utterance transcribed: ${words} words, ${(samples / rate).toFixed(1)} s`;
}

// CCV_OFFLINE=1: never download. Setup uses only what is already staged in CCV_HOME.
export function offline(env) {
  return env.CCV_OFFLINE === '1' || env.CCV_OFFLINE === 'true';
}
