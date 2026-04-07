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
  const snapshot = getAudioSnapshot();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function setAudioState(patch) {
  Object.assign(state, patch);
  notify();
}

export function getAudioSnapshot() {
  return { ...state };
}

export function subscribeAudioState(listener) {
  listeners.add(listener);
  listener(getAudioSnapshot());
  return () => listeners.delete(listener);
}
