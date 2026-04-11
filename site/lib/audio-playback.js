import { getUserAudio } from "./db.js";
import { setPlaybackState } from "./playback-state.js";

let audioContext = null;
let activeSource = null;
let activeAudioElement = null;
let playbackToken = 0;

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
  if (token !== playbackToken) {
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
    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      error: "",
    });
  };

  setPlaybackState({
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
    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      error: "",
    });
  };

  audio.onpause = () => {
    if (audio.ended || activeAudioElement !== audio) {
      return;
    }

    setPlaybackState({
      isPlaying: false,
      isPaused: true,
      error: "",
    });
  };

  audio.onerror = () => {
    cleanupAudioElement(audio);
    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      error: "HTML audio playback failed.",
    });
  };

  if (token !== playbackToken) {
    cleanupAudioElement(audio);
    audio.removeAttribute("src");
    audio.load();
    return;
  }

  setPlaybackState({
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
    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function playGeneratedAudio(rawAudio) {
  playbackToken += 1;
  const token = playbackToken;
  await playRawAudio(rawAudio, token);
}

export async function playAudioUrl(url) {
  playbackToken += 1;
  const token = playbackToken;
  setPlaybackState({
    isPlaying: false,
    isPaused: false,
    error: "",
  });

  await playHtmlAudio(url, token);
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
  setPlaybackState({
    isPlaying: false,
    isPaused: true,
    error: "",
  });
}

export async function resumePlayback() {
  if (activeAudioElement) {
    await activeAudioElement.play();
    setPlaybackState({
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
  setPlaybackState({
    isPlaying: true,
    isPaused: false,
    error: "",
  });
}

function assertNoHashCollision(audioKey, existing, sentence) {
  if (existing.sentenceId !== sentence.id || existing.text !== sentence.text) {
    console.warn("Audio hash collision detected.", {
      audioKey,
      storedSentenceId: existing.sentenceId,
      requestedSentenceId: sentence.id,
      storedText: existing.text,
      requestedText: sentence.text,
    });
    throw new Error("Audio hash collision detected.");
  }
}

export async function playSentence(sentence) {
  if (sentence.source === "builtin") {
    await playAudioUrl(sentence.audioSrc);
    return;
  }

  const record = await getUserAudio(sentence.audioKey);
  if (!record) {
    throw new Error("Stored audio for this sentence is missing.");
  }

  assertNoHashCollision(sentence.audioKey, record, sentence);

  await playGeneratedAudio({
    audio: record.audio,
    sampling_rate: record.samplingRate,
  });
}
