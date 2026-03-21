# German Browser TTS Decision

## Constraints

- The site must stay static.
- Speech must not depend on `window.speechSynthesis` or installed OS voices.
- It only needs to support non-commercial use.
- It should behave consistently across Linux, macOS, Windows, and mobile browsers.

## What was ruled out

`Web Speech API` was removed because Linux devices without a German voice have no acceptable fallback, and voice quality or availability differs too much between devices.

## Options considered

### `sherpa-onnx` + German Piper voices

This is the strongest browser-WASM option for German and has better voice choice, but it would mean a more custom runtime path than the current site needs for a first model-backed version.

### `Transformers.js` + `Xenova/mms-tts-deu`

This is the selected option.

Why it fits:

- official browser support through `Transformers.js`
- German model is available as `Xenova/mms-tts-deu`
- inference runs client-side
- no dependency on local system voices
- browser cache support is built in

Tradeoffs:

- first-run download is noticeable
- a single German voice is less flexible than Piper's voice catalog
- quality is acceptable for dictation practice, but not necessarily the best available German TTS
- the source model license is non-commercial only

### Larger multilingual ONNX models

These were rejected for the first implementation because they are heavier and increase startup time and compatibility risk on weaker devices.

## Chosen architecture

- `IndexedDB` for custom sentence storage
- `Transformers.js` `text-to-speech` pipeline
- model: `Xenova/mms-tts-deu`
- in-browser audio playback through `AudioContext`
- browser cache enabled for model assets

## Deployment note

The app stays static, but the model files are still fetched remotely on first use unless the model is mirrored locally later. If you want a stricter self-hosted deployment later, the next step is to serve the model files from `/models/` and point the runtime there.
