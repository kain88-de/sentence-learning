# Writing Practice

A simple browser-based writing practice app for children. The app plays slow German sentences, lets the learner write them down on paper, and reveals the answer with a blur-to-clear check step.

## Features

- Child-focused practice screen with `Listen`, `Write`, and `Reveal` steps
- In-browser German text-to-speech playback
- Play and pause support during playback
- Built-in sample sentences with pre-generated audio
- Custom sentences stored locally in IndexedDB
- Adjustable playback speed in the Manage tab
- Fully static app that can be hosted on GitHub Pages or any static file host

## Project Structure

- [app-b/](/home/max/code/learning/app-b) - the app UI
- [shared/](/home/max/code/learning/shared) - shared TTS, data, and storage logic
- [audio/](/home/max/code/learning/audio) - built-in audio files
- [scripts/](/home/max/code/learning/scripts) - static checks and audio generation helpers

## Run Locally

Serve the repository with a local static server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

The root page redirects to the app in `app-b/`.

## Development

Install dependencies:

```bash
bun install
```

Run checks:

```bash
npx biome check app-b shared
node scripts/check-static-site.mjs
```

Or use the package script:

```bash
bun run check
```

## Notes

- Use a local server for testing so IndexedDB behaves consistently.
- On first model-based playback, the browser will download the German model files into its cache.
- Built-in audio is used when the playback speed matches the pre-generated audio speed.
- There are no GitHub Actions configured yet.

## License

MIT. See [LICENSE](/home/max/code/learning/LICENSE).
