import { env, pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";

const MODEL_ID = "Xenova/mms-tts-deu";

env.allowRemoteModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.numThreads = 1;

let synthesizerPromise = null;

function progressToRatio(progressEvent) {
  if (typeof progressEvent?.progress === "number") {
    return Math.max(0, Math.min(1, progressEvent.progress / 100));
  }

  if (
    typeof progressEvent?.loaded === "number" &&
    typeof progressEvent?.total === "number" &&
    progressEvent.total > 0
  ) {
    return Math.max(0, Math.min(1, progressEvent.loaded / progressEvent.total));
  }

  return 0;
}

function postStatus({ phase, message, progress = 0, error = "" }) {
  self.postMessage({
    type: "status",
    phase,
    message,
    progress,
    error,
  });
}

async function loadSynthesizer() {
  if (!synthesizerPromise) {
    postStatus({
      phase: "loading",
      message: "Downloading and preparing the German model.",
      progress: 0,
    });

    synthesizerPromise = pipeline("text-to-speech", MODEL_ID, {
      progress_callback(progressEvent) {
        postStatus({
          phase: "loading",
          message: progressEvent?.status ? `${progressEvent.status}.` : "Downloading model files.",
          progress: progressToRatio(progressEvent),
        });
      },
    })
      .then((synthesizer) => {
        postStatus({
          phase: "ready",
          message: "German model ready.",
          progress: 1,
        });
        return synthesizer;
      })
      .catch((error) => {
        synthesizerPromise = null;
        postStatus({
          phase: "error",
          message: "Model load failed.",
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      });
  }

  return synthesizerPromise;
}

self.addEventListener("message", async (event) => {
  const { id, command, text, speed } = event.data;

  try {
    if (command === "preload") {
      await loadSynthesizer();
      self.postMessage({ type: "result", id, payload: { ok: true } });
      return;
    }

    if (command === "generate") {
      const synthesizer = await loadSynthesizer();
      const output = await synthesizer(text, { speed });
      self.postMessage(
        {
          type: "result",
          id,
          payload: {
            audio: output.audio,
            sampling_rate: output.sampling_rate,
          },
        },
        [output.audio.buffer],
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
