import { createStore } from "./store.js";

const store = createStore({
  phase: "idle",
  message: "Modell ist noch nicht geladen.",
  progress: 0,
  error: "",
});

export const setModelStatus = (patch) => store.set(patch);
export const getModelStatusSnapshot = () => store.get();
export const subscribeModelStatus = (fn) => store.subscribe(fn);
