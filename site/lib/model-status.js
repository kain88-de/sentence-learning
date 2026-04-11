const listeners = new Set();
const state = {
  phase: "idle",
  message: "Modell ist noch nicht geladen.",
  progress: 0,
  error: "",
};

function notify() {
  const snapshot = getModelStatusSnapshot();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function setModelStatus(patch) {
  Object.assign(state, patch);
  notify();
}

export function getModelStatusSnapshot() {
  return { ...state };
}

export function subscribeModelStatus(listener) {
  listeners.add(listener);
  listener(getModelStatusSnapshot());
  return () => listeners.delete(listener);
}
