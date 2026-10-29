import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { livekitConfig, safeIdentity, utteranceLogLine, offline } from '../src/policy.mjs';
import { MODEL_FILES, ensureModels, ensureLiveKit } from '../src/install.mjs';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

test('an utterance log line carries size and length, never the words', () => {
  const line = utteranceLogLine('patient reports chest pain since Tuesday', 48000, 16000);
  assert.equal(line, 'utterance transcribed: 6 words, 3.0 s');
  for (const word of ['patient', 'chest', 'pain', 'Tuesday']) assert.ok(!line.includes(word));
});

test('no log call in the source interpolates transcribed text', () => {
  for (const file of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const src = readFileSync(path.join(SRC, file), 'utf8');
    const calls = src.match(/\blog\(`[^`]*`\)/g) ?? [];
    for (const call of calls) assert.ok(!/\$\{(heard|text|spoken|msg\.text)\b/.test(call), `${file}: ${call}`);
  }
});

test('local dev server may use the dev key pair', () => {
  const c = livekitConfig({}, 7880);
  assert.equal(c.url, 'ws://127.0.0.1:7880');
  assert.equal(c.key, 'devkey');
  assert.equal(c.external, false);
});

test('an external LiveKit server needs real keys', () => {
  assert.throws(() => livekitConfig({ LIVEKIT_URL: 'wss://lk.example' }, 7880), /LIVEKIT_API_KEY/);
  assert.throws(() => livekitConfig({ LIVEKIT_URL: 'wss://lk.example', LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'x' }, 7880), /dev key pair/);
  assert.throws(() => livekitConfig({ LIVEKIT_URL: 'wss://lk.example', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 'secret' }, 7880), /dev key pair/);
  const c = livekitConfig({ LIVEKIT_URL: 'wss://lk.example', LIVEKIT_API_KEY: 'k1', LIVEKIT_API_SECRET: 's1' }, 7880);
  assert.equal(c.url, 'wss://lk.example');
  assert.equal(c.external, true);
});

test('participant identities are short ids, not free text', () => {
  assert.equal(safeIdentity('clinician-7'), 'clinician-7');
  assert.equal(safeIdentity('Jane Doe, DOB 1980'), 'browser');
  assert.equal(safeIdentity('x'.repeat(65)), 'browser');
  assert.equal(safeIdentity(null), 'browser');
  assert.equal(livekitConfig({ LK_IDENTITY: 'bad identity' }, 7880).identity, 'voice-host');
});

test('every model file is pinned to a commit and a SHA-256', () => {
  for (const m of MODEL_FILES) {
    assert.match(m.rev, /^[0-9a-f]{40}$/, m.file);
    assert.match(m.sha256, /^[0-9a-f]{64}$/, m.file);
  }
  assert.ok(!readFileSync(path.join(SRC, 'install.mjs'), 'utf8').includes('resolve/main'));
});

test('offline mode refuses to download anything', async () => {
  assert.equal(offline({ CCV_OFFLINE: '1' }), true);
  assert.equal(offline({}), false);
  const home = mkdtempSync(path.join(tmpdir(), 'ccv-offline-'));
  const before = process.env.CCV_OFFLINE;
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('network used in offline mode'); };
  process.env.CCV_OFFLINE = '1';
  try {
    await assert.rejects(ensureModels(home, () => {}), /CCV_OFFLINE is set and stt\/encoder\.int8\.onnx is not staged/);
    if (process.platform !== 'darwin') await assert.rejects(ensureLiveKit(home, () => {}), /CCV_OFFLINE is set and LiveKit is not staged/);
  } finally {
    globalThis.fetch = realFetch;
    if (before === undefined) delete process.env.CCV_OFFLINE; else process.env.CCV_OFFLINE = before;
    rmSync(home, { recursive: true, force: true });
  }
});
