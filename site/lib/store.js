export function createStore(initial) {
  const listeners = new Set();
  const state = { ...initial };
  const notify = () => {
    const snapshot = { ...state };
    for (const fn of listeners) fn(snapshot);
  };
  return {
    set(patch) {
      Object.assign(state, patch);
      notify();
    },
    get() {
      return { ...state };
    },
    subscribe(fn) {
      listeners.add(fn);
      fn({ ...state });
      return () => listeners.delete(fn);
    },
  };
}
