import { createStore } from "./store.js";

const store = createStore({ isPlaying: false, isPaused: false, error: "" });

export const setPlaybackState = (patch) => store.set(patch);
export const getPlaybackSnapshot = () => store.get();
export const subscribePlaybackState = (fn) => store.subscribe(fn);
