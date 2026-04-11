const listeners = new Set();
const state = {
  isPlaying: false,
  isPaused: false,
  error: "",
};

function notify() {
  const snapshot = getPlaybackSnapshot();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function setPlaybackState(patch) {
  Object.assign(state, patch);
  notify();
}

export function getPlaybackSnapshot() {
  return { ...state };
}

export function subscribePlaybackState(listener) {
  listeners.add(listener);
  listener(getPlaybackSnapshot());
  return () => listeners.delete(listener);
}
