# AGENTS.md

## Purpose

This repository contains a static browser-based German dictation practice app for children.
The app lives in `app/` and depends on shared browser-side modules in `shared/`.

## Repo Map

- `index.html`: root wrapper that redirects `/` to `app/`
- `app/`: UI, page structure, and app behavior
- `shared/`: text-to-speech playback, sentence data loading, and IndexedDB helpers
- `audio/`: pre-generated built-in WAV files for sample sentences
- `data/`: built-in sentence source text
- `scripts/`: static checks and audio generation helpers

## Local Development

Serve the site with a local static server:

```bash
just serve
```

Fallback:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`, which redirects to `app/`.

The root `index.html` is intentionally just a wrapper. Keep that setup unless the project explicitly adopts a build/deploy step that moves the app back to `/`.

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

Preferred local test server:

```bash
just serve
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

## Frontend Architecture

- Keep page-level modules thin:
  - `app/app.js` owns the practice page only
  - `app/manage.js` owns the manage page only
- Put cross-page browser modules in `shared/`, not `app/`.
- Split responsibilities by concern, not by feature label:
  - sentence loading and sentence helpers in `shared/`
  - model download and synthesis worker orchestration in `shared/model-tts.js`
  - playback transport and playback state in a separate playback module
- Do not let UI code depend on human-readable status text such as `"Wiedergabe beendet."` for logic.
- UI state decisions must be based on stable fields like:
  - `phase`
  - `isPlaying`
  - `isPaused`
  - explicit IDs or flags
- Avoid mixing these responsibilities in one module:
  - worker/model lifecycle
  - audio playback
  - sentence persistence
  - page rendering
- If a helper is shared by both pages, place it in `shared/` and give it a concern-based name.
- Prefer normal page navigation over hiding whole screens behind client-side tab state when the screens have different responsibilities.

## Current Default

- Default reading speed is `0.55x`.
- The default-speed built-in audio files were generated to match that value.

## Future Work

- A GitHub Actions publish flow for GitHub Pages is a good next step.
- That workflow can also generate built-in audio during deployment if the project chooses not to store all generated assets manually.
