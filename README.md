# ccv

Realtime voice for Claude Code: a LiveKit room you join from the browser, speech-to-text (Underdog Bark 3.0 Clean), and text-to-speech (Paradee). Runs as an MCP server through `npx`. This fork (SolutionsAsService/ccv-mcp) adds the hardening below for clinical use.

## Use

Add the server to Claude Code (`.mcp.json` in the project, or `claude mcp add ccv -- npx -y github:SolutionsAsService/ccv-mcp#<commit>`). Pin a commit: without one, `npx` runs whatever the default branch holds at start, then from the session:

1. `voice_setup`: installs LiveKit and downloads the models in the background (about 1 GB once).
2. `voice_start`: starts LiveKit (dev mode) and the voice host. Open the printed page (http://127.0.0.1:8800/) and click join.
3. `voice_heard` lists what was said; `voice_speak` replies. Long replies stream sentence by sentence.
4. `voice_status` shows setup progress and recent logs; `voice_stop` shuts the stack down.

## Configuration

`.env` in the current directory is read at start. Process environment variables win over it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HF_TOKEN` | none | Faster Hugging Face downloads (sent as an Authorization header) |
| `LIVEKIT_URL` | started locally | Use an existing LiveKit server instead of starting one |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | `devkey` / `secret` | Keys for the room. The dev pair works only with the local dev server; with `LIVEKIT_URL` both are required and the dev pair is refused |
| `CCV_OFFLINE` | unset | `1`: never download. Setup uses only the LiveKit binary and models already staged in `CCV_HOME` |
| `LK_ROOM` | `lk-voice` | Room name |
| `CCV_PORT` | `8800` | Voice page and host port (127.0.0.1) |
| `CCV_HOME` | `./.ccv` | Where binaries and models live |
| `END_SILENCE_MS` | `800` | Quiet time that ends an utterance (debounce only, nothing is force-sent) |
| `MIN_SPEECH_MS` | `250` | Shorter bursts (clicks, knocks) are dropped |
| `BARGE_DBFS` / `BARGE_MS` | `-30` / `250` | Level and duration that interrupt playback |

## Hardening (0.2.0)

For use where speech can be protected health information:

- **No spoken words in logs.** An utterance is logged as `utterance transcribed: 6 words, 3.0 s`. Barge-in lines carry no participant. `voice_status` and `ccv.log` therefore hold sizes and states only. Transcripts reach the caller through `voice_heard` alone, from an in-memory buffer of the last 50.
- **Pinned models.** Each model downloads from a fixed Hugging Face commit, and every file is checked against its SHA-256 (previously one file of six).
- **Offline runs.** With `CCV_OFFLINE=1` nothing is downloaded, so after staging `CCV_HOME` the stack runs with no network beyond the local room.
- **Keys.** An external LiveKit server must come with its own key and secret; the dev pair is refused there.
- **Inputs.** Token identities must be short ids (`[A-Za-z0-9_.-]`, up to 64 characters), else `browser`. `/speak` bodies are capped at 64 KiB.

`npm test` runs the checks (Node's built-in test runner, no models needed): no log call interpolates transcribed text, every model file is pinned, offline mode never touches the network, and the key and identity rules hold.

## Platforms

- LiveKit: Linux amd64/arm64 and Windows amd64/arm64 use the release archive, checked against its SHA-256 checksums. macOS uses `brew install livekit`, with Docker (`livekit/livekit-server`) as a fallback.
- Speech runs in Node with onnxruntime-node and an espeak-ng WebAssembly build. No Python and no native build step.

## Models

- STT: `velddev/Underdog-Bark-3.0-Clean-sherpa-onnx` (int8 encoder, decoder, joiner, tokens).
- TTS: `sahilmahendrakar/Paradee-8M-v1.1` (`onnx/paradee_int8.onnx`, `config.json`).

## Status

Verified locally: models download with resume and checksum, LiveKit installs and passes its checksum, MCP tools list and start/stop, the host joins the room and serves the page. Not yet verified: a live conversation in the room (barge-in, long-form speech).
