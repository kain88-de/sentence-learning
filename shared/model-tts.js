let worker = null;
let audioContext = null;
let activeSource = null;
let activeAudioElement = null;
let generationToken = 0;
let requestId = 0;

const pendingRequests = new Map();
const listeners = new Set();
const state = {
  phase: "idle",
  message: "Modell ist noch nicht geladen.",
  progress: 0,
  isPlaying: false,
  isPaused: false,
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

function cleanupAudioElement(audioElement) {
  audioElement.onended = null;
  audioElement.onpause = null;
  audioElement.onerror = null;
}

function ensureHtmlAudioElement() {
  if (activeAudioElement) {
    return activeAudioElement;
  }

  const audioElement = document.createElement("audio");
  audioElement.preload = "auto";
  audioElement.playsInline = true;
  audioElement.style.display = "none";
  document.body.append(audioElement);
  activeAudioElement = audioElement;
  return audioElement;
}

function stopSource() {
  if (!activeSource) {
    return false;
  }

  activeSource.onended = null;
  try {
    activeSource.stop();
  } catch (_error) {
    // Ignore stop errors for already-finished sources.
  }
  activeSource.disconnect();
  activeSource = null;
  return true;
}

function stopAudioElement() {
  if (!activeAudioElement) {
    return false;
  }

  activeAudioElement.pause();
  cleanupAudioElement(activeAudioElement);
  activeAudioElement.removeAttribute("src");
  activeAudioElement.load();
  return true;
}

function stopActivePlayback() {
  const stoppedSource = stopSource();
  const stoppedElement = stopAudioElement();
  return stoppedSource || stoppedElement;
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

  stopActivePlayback();

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
      message: "Wiedergabe beendet.",
      progress: 1,
      isPlaying: false,
      isPaused: false,
      error: "",
    });
  };

  setState({
    phase: "playing",
    message: "Generiertes Audio wird abgespielt.",
    progress: 1,
    isPlaying: true,
    isPaused: false,
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

  stopActivePlayback();

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
      message: "Wiedergabe beendet.",
      progress: 1,
      isPlaying: false,
      isPaused: false,
      error: "",
    });
  };

  setState({
    phase: "playing",
    message: "Audio wird abgespielt.",
    progress: 1,
    isPlaying: true,
    isPaused: false,
    error: "",
  });

  source.start();
}

async function playHtmlAudio(url, token) {
  stopActivePlayback();

  const audio = ensureHtmlAudioElement();
  audio.src = url;
  audio.load();

  audio.onended = () => {
    cleanupAudioElement(audio);
    setState({
      phase: "ready",
      message: "Wiedergabe beendet.",
      progress: 1,
      isPlaying: false,
      isPaused: false,
      error: "",
    });
  };

  audio.onpause = () => {
    if (audio.ended || activeAudioElement !== audio) {
      return;
    }

    setState({
      phase: "paused",
      message: "Wiedergabe pausiert.",
      progress: 1,
      isPlaying: false,
      isPaused: true,
      error: "",
    });
  };

  audio.onerror = () => {
    cleanupAudioElement(audio);
    setState({
      phase: "error",
      message: "Audio konnte nicht abgespielt werden.",
      progress: 0,
      isPlaying: false,
      isPaused: false,
      error: "HTML audio playback failed.",
    });
  };

  if (token !== generationToken) {
    cleanupAudioElement(audio);
    audio.removeAttribute("src");
    audio.load();
    return;
  }

  setState({
    phase: "playing",
    message: "Audio wird abgespielt.",
    progress: 1,
    isPlaying: true,
    isPaused: false,
    error: "",
  });

  try {
    await audio.play();
  } catch (error) {
    cleanupAudioElement(audio);
    audio.removeAttribute("src");
    audio.load();
    setState({
      phase: "error",
      message: "Audio konnte nicht abgespielt werden.",
      progress: 0,
      isPlaying: false,
      isPaused: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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
        isPaused: false,
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
      message: "Der Modell-Worker ist abgestuerzt.",
      progress: 0,
      isPlaying: false,
      isPaused: false,
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
  stopActivePlayback();

  setState({
    phase: "generating",
    message: "Deutsches Audio wird erzeugt.",
    progress: 1,
    isPlaying: false,
    isPaused: false,
    error: "",
  });

  const payload = await runWorkerCommand({ command: "generate", text, speed });
  setState({
    phase: "ready",
    message: "Audio ist bereit zur Wiedergabe.",
    progress: 1,
    isPlaying: false,
    isPaused: false,
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
    message: "Vorgefertigtes Audio wird geladen.",
    progress: 1,
    isPlaying: false,
    isPaused: false,
    error: "",
  });

  await playHtmlAudio(url, token);
}

export async function speakText(text, { speed = 0.75 } = {}) {
  const payload = await generateSpeech(text, { speed });
  await playGeneratedAudio(payload);
  return payload;
}

export async function pausePlayback() {
  if (activeAudioElement) {
    activeAudioElement.pause();
    return;
  }

  if (!audioContext || !activeSource || audioContext.state !== "running") {
    return;
  }

  await audioContext.suspend();
  setState({
    phase: "paused",
    message: "Wiedergabe pausiert.",
    progress: 1,
    isPlaying: false,
    isPaused: true,
    error: "",
  });
}

export async function resumePlayback() {
  if (activeAudioElement) {
    await activeAudioElement.play();
    setState({
      phase: "playing",
      message: "Audio wird abgespielt.",
      progress: 1,
      isPlaying: true,
      isPaused: false,
      error: "",
    });
    return;
  }

  if (!audioContext || !activeSource || audioContext.state !== "suspended") {
    return;
  }

  await audioContext.resume();
  setState({
    phase: "playing",
    message: "Audio wird abgespielt.",
    progress: 1,
    isPlaying: true,
    isPaused: false,
    error: "",
  });
}

export function stopPlayback() {
  generationToken += 1;
  stopActivePlayback();
  setState({
    phase: worker ? "ready" : "idle",
    message: worker ? "Wiedergabe gestoppt." : "Modell ist noch nicht geladen.",
    progress: worker ? 1 : 0,
    isPlaying: false,
    isPaused: false,
    error: "",
  });
}
