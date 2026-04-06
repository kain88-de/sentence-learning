# AGENTS.md

## Purpose

This repository contains a static browser-based German dictation practice app for children.
The app lives in `app-b/` and depends on shared browser-side modules in `shared/`.

## Repo Map

- `app-b/`: UI, page structure, and app behavior
- `shared/`: text-to-speech playback, sentence data loading, and IndexedDB helpers
- `audio/`: pre-generated built-in WAV files for sample sentences
- `data/`: built-in sentence source text
- `scripts/`: static checks and audio generation helpers

## Local Development

Serve the site with a local static server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`, which redirects to `app-b/`.

## Common Commands

Install dependencies:

```bash
bun install
```

Run validation:

```bash
bun run check
```

Reformat source files:

```bash
bun run format
```

Regenerate built-in audio after changing `PREBUILT_AUDIO_SPEED` or built-in sentences:

```bash
bun run build:audio
```

## Project Constraints

- Keep the app fully static. Do not introduce a server dependency unless explicitly requested.
- Built-in audio in `audio/` must stay aligned with `PREBUILT_AUDIO_SPEED` in `shared/data.js`.
- If you change built-in sentence text or the prebuilt speed, regenerate the WAV files.
- IndexedDB behavior should be tested through a local server, not `file://`.
- Preserve the current lightweight structure unless there is a clear reason to add framework tooling.

## Change Guidance

- Prefer small, direct edits over broad refactors.
- Keep browser code compatible with the current static deployment model.
- When changing playback behavior, verify both paths:
  - bundled built-in WAV playback
  - generated TTS playback for non-default speeds
- Run `bun run check` after code changes.

## Current Default

- Default reading speed is `0.65x`.
- The default-speed built-in audio files were generated to match that value.
