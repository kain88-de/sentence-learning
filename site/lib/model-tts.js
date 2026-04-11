import { setModelStatus } from "./model-status.js";

let worker = null;
let requestId = 0;

const pendingRequests = new Map();

function ensureWorker() {
  if (worker) {
    return worker;
  }

  worker = new Worker(new URL("./model-tts.worker.js", import.meta.url), { type: "module" });

  worker.addEventListener("message", (event) => {
    const data = event.data;

    if (data.type === "status") {
      setModelStatus({
        phase: data.phase,
        message: data.message,
        progress: data.progress,
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
    setModelStatus({
      phase: "error",
      message: "Der Modell-Worker ist abgestuerzt.",
      progress: 0,
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

export async function preloadModel() {
  await runWorkerCommand({ command: "preload" });
}

export async function generateSpeech(text) {
  setModelStatus({
    phase: "generating",
    message: "Deutsches Audio wird erzeugt.",
    progress: 1,
    error: "",
  });

  const payload = await runWorkerCommand({ command: "generate", text, speed: 0.55 });
  setModelStatus({
    phase: "ready",
    message: "Audio ist bereit zur Wiedergabe.",
    progress: 1,
    error: "",
  });
  return payload;
}
