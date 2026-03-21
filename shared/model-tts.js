import { env, pipeline } from "../node_modules/@huggingface/transformers/dist/transformers.web.js";

export const MODEL_INFO = {
  id: "Xenova/mms-tts-deu",
  label: "MMS German",
  license: "CC-BY-NC-4.0",
};

env.allowRemoteModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = "/node_modules/@huggingface/transformers/dist/";

let synthesizerPromise = null;
let audioContext = null;
let activeSource = null;
let generationToken = 0;

const listeners = new Set();
const state = {
  phase: "idle",
  message: "Model not loaded yet.",
  progress: 0,
  isPlaying: false,
  error: "",
};

function notify() {
  const snapshot = getSnapshot();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function setState(patch) {
  Object.assign(state, patch);
  notify();
}

function progressToRatio(progressEvent) {
  if (typeof progressEvent?.progress === "number") {
    return Math.max(0, Math.min(1, progressEvent.progress / 100));
  }

  if (
    typeof progressEvent?.loaded === "number" &&
    typeof progressEvent?.total === "number" &&
    progressEvent.total > 0
  ) {
    return Math.max(0, Math.min(1, progressEvent.loaded / progressEvent.total));
  }

  return 0;
}

function stopSource() {
  if (!activeSource) {
    return;
  }

  activeSource.onended = null;
  try {
    activeSource.stop();
  } catch (_error) {
    // Audio nodes can throw if they have already finished.
  }
  activeSource.disconnect();
  activeSource = null;
}

async function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return audioContext;
}

async function loadSynthesizer() {
  if (!synthesizerPromise) {
    setState({
      phase: "loading",
      message: "Downloading and preparing the German model.",
      progress: 0,
      error: "",
    });

    synthesizerPromise = pipeline("text-to-speech", MODEL_INFO.id, {
      progress_callback(progressEvent) {
        const ratio = progressToRatio(progressEvent);
        const statusLabel = progressEvent?.status
          ? `${progressEvent.status}.`
          : "Downloading model files.";
        setState({
          phase: "loading",
          message: statusLabel,
          progress: ratio,
          error: "",
        });
      },
    })
      .then((synthesizer) => {
        setState({
          phase: "ready",
          message: "German model ready.",
          progress: 1,
          error: "",
        });
        return synthesizer;
      })
      .catch((error) => {
        synthesizerPromise = null;
        setState({
          phase: "error",
          message: "Model load failed.",
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      });
  }

  return synthesizerPromise;
}

function playRawAudio(rawAudio, token) {
  return ensureAudioContext().then((context) => {
    if (token !== generationToken) {
      return;
    }

    stopSource();

    const audioBuffer = context.createBuffer(1, rawAudio.audio.length, rawAudio.sampling_rate);
    audioBuffer.copyToChannel(rawAudio.audio, 0);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    activeSource = source;

    source.onended = () => {
      if (activeSource === source) {
        activeSource.disconnect();
        activeSource = null;
      }
      setState({
        phase: "ready",
        message: "Playback finished.",
        progress: 1,
        isPlaying: false,
      });
    };

    setState({
      phase: "playing",
      message: "Playing generated audio.",
      progress: 1,
      isPlaying: true,
      error: "",
    });

    source.start();
  });
}

export function getSnapshot() {
  return { ...state };
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getSnapshot());
  return () => listeners.delete(listener);
}

export async function preloadModel() {
  await loadSynthesizer();
}

export async function speakText(text, { speed = 0.75 } = {}) {
  generationToken += 1;
  const token = generationToken;
  stopSource();

  setState({
    phase: "generating",
    message: "Generating German speech.",
    progress: 1,
    isPlaying: false,
    error: "",
  });

  const synthesizer = await loadSynthesizer();
  const output = await synthesizer(text, { speed });
  await playRawAudio(output, token);
  return output;
}

export function stopPlayback() {
  generationToken += 1;
  stopSource();
  setState({
    phase: synthesizerPromise ? "ready" : "idle",
    message: synthesizerPromise ? "Playback stopped." : "Model not loaded yet.",
    progress: synthesizerPromise ? 1 : 0,
    isPlaying: false,
    error: "",
  });
}
