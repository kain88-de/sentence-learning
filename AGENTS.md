# AGENTS.md

## Purpose

This repository contains a static browser-based German dictation practice app for children.
The publishable site lives in `site/`.
The page entry points live in `site/` and depend on browser-side modules in `site/lib/`.

## Repo Map

- `site/`: static site root published to GitHub Pages
- `site/index.html`: practice page entry point
- `site/manage.html`: manage page entry point
- `site/app.js`: practice page behavior
- `site/manage.js`: manage page behavior
- `site/style.css`: shared page styles
- `site/lib/`: text-to-speech playback, sentence loading, and IndexedDB helpers
- `site/assets/audio/`: generated built-in WAV files for sample sentences
- `site/assets/data/`: built-in sentence manifest
- `sentences.txt`: source of truth for built-in sentences
- `scripts/`: static checks and audio generation helpers

## Local Development

Serve the site with a local static server:

```bash
just serve
```

Fallback:

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/`.

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
- Built-in audio in `site/assets/audio/` must stay aligned with `PREBUILT_AUDIO_SPEED` in `site/lib/builtin-sentences.js`.
- `site/assets/data/builtin-sentences.json` is generated from `sentences.txt` by the audio build step.
- The built-in WAV files are generated during GitHub Pages deploy and may not be present in a fresh checkout until `bun run build:audio` is run.
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
  - `site/app.js` owns the practice page only
  - `site/manage.js` owns the manage page only
- Put cross-page browser modules in `site/lib/`, not the page entry modules.
- Split responsibilities by concern, not by feature label:
  - built-in sentence loading in `site/lib/builtin-sentences.js`
  - sentence persistence in `site/lib/sentences.js`
  - model download and synthesis worker orchestration in `site/lib/model-tts.js`
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
- If a helper is shared by both pages, place it in `site/lib/` and give it a concern-based name.
- Prefer normal page navigation over hiding whole screens behind client-side tab state when the screens have different responsibilities.

## Current Default

- Default reading speed is `0.55x`.
- The default-speed built-in audio files should be generated to match that value.

## Future Work

- If audio generation ever becomes too slow for deploy, consider caching or publishing the generated assets separately.
