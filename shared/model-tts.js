let worker = null;
let audioContext = null;
let activeSource = null;
let generationToken = 0;
let requestId = 0;

const pendingRequests = new Map();
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

function stopSource() {
  if (!activeSource) {
    return;
  }

  activeSource.onended = null;
  try {
    activeSource.stop();
  } catch (_error) {
    // Ignore stop errors for already-finished sources.
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

async function playRawAudio(rawAudio, token) {
  const context = await ensureAudioContext();
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
      error: "",
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
}

async function decodeAudioBuffer(arrayBuffer) {
  const context = await ensureAudioContext();
  const copy = arrayBuffer.slice(0);
  return context.decodeAudioData(copy);
}

async function playAudioBuffer(audioBuffer, token) {
  const context = await ensureAudioContext();
  if (token !== generationToken) {
    return;
  }

  stopSource();

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
      error: "",
    });
  };

  setState({
    phase: "playing",
    message: "Playing audio.",
    progress: 1,
    isPlaying: true,
    error: "",
  });

  source.start();
}

function ensureWorker() {
  if (worker) {
    return worker;
  }

  worker = new Worker(new URL("./model-tts.worker.js", import.meta.url), { type: "module" });

  worker.addEventListener("message", (event) => {
    const data = event.data;

    if (data.type === "status") {
      setState({
        phase: data.phase,
        message: data.message,
        progress: data.progress,
        isPlaying: false,
        error: data.error ?? "",
      });
      return;
    }

    const pending = pendingRequests.get(data.id);
    if (!pending) {
      return;
    }

    pendingRequests.delete(data.id);

    if (data.type === "result") {
      pending.resolve(data.payload);
      return;
    }

    if (data.type === "error") {
      pending.reject(new Error(data.error));
    }
  });

  worker.addEventListener("error", (event) => {
    setState({
      phase: "error",
      message: "Model worker crashed.",
      progress: 0,
      isPlaying: false,
      error: event.message,
    });
  });

  return worker;
}

function runWorkerCommand(command) {
  const activeWorker = ensureWorker();
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    activeWorker.postMessage({ id, ...command });
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
  await runWorkerCommand({ command: "preload" });
}

export async function generateSpeech(text, { speed = 0.75 } = {}) {
  generationToken += 1;
  stopSource();

  setState({
    phase: "generating",
    message: "Generating German speech.",
    progress: 1,
    isPlaying: false,
    error: "",
  });

  const payload = await runWorkerCommand({ command: "generate", text, speed });
  setState({
    phase: "ready",
    message: "Audio generated and ready to play.",
    progress: 1,
    isPlaying: false,
    error: "",
  });
  return payload;
}

export async function playGeneratedAudio(rawAudio) {
  generationToken += 1;
  const token = generationToken;
  await playRawAudio(rawAudio, token);
}

export async function playAudioUrl(url) {
  generationToken += 1;
  const token = generationToken;
  setState({
    phase: "loading",
    message: "Loading prebuilt audio.",
    progress: 1,
    isPlaying: false,
    error: "",
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status}`);
  }

  const audioBuffer = await decodeAudioBuffer(await response.arrayBuffer());
  await playAudioBuffer(audioBuffer, token);
}

export async function speakText(text, { speed = 0.75 } = {}) {
  const payload = await generateSpeech(text, { speed });
  await playGeneratedAudio(payload);
  return payload;
}

export function stopPlayback() {
  generationToken += 1;
  stopSource();
  setState({
    phase: worker ? "ready" : "idle",
    message: worker ? "Playback stopped." : "Model not loaded yet.",
    progress: worker ? 1 : 0,
    isPlaying: false,
    error: "",
  });
}
