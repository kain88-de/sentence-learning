# Writing Practice

[![Validation](https://github.com/kain88-de/sentence-learning/actions/workflows/ci.yml/badge.svg)](https://github.com/kain88-de/sentence-learning/actions/workflows/ci.yml)

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

- [site/](/home/max/code/learning/site) - publishable static site root
- [site/index.html](/home/max/code/learning/site/index.html) - practice page entry point
- [site/manage.html](/home/max/code/learning/site/manage.html) - manage page
- [site/lib/](/home/max/code/learning/site/lib) - browser-side modules
- [site/assets/](/home/max/code/learning/site/assets) - built-in sentence source files and generated audio output
- [scripts/](/home/max/code/learning/scripts) - static checks and audio generation helpers

## Run Locally

Serve the repository with:

```bash
just serve
```

Fallback if `just` is not installed:

```bash
python3 -m http.server 8000 --directory site
```

Then open:

```text
http://localhost:8000/
```

The site root [site/index.html](/home/max/code/learning/site/index.html) is the practice page entry point.

## Development

Install dependencies:

```bash
bun install
```

Start a local dev server:

```bash
just serve
```

Run checks:

```bash
npx biome check site/*.js site/*.html site/*.css site/lib
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
- The built-in WAV files are generated during GitHub Pages deploy and can also be generated locally with `bun run build:audio`.
- GitHub Pages publishes [site/](/home/max/code/learning/site), not the whole repository.
- The practice page entry point is [site/index.html](/home/max/code/learning/site/index.html).

## License

MIT. See [LICENSE](/home/max/code/learning/LICENSE).
