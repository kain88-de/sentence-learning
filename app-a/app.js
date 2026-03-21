import { BUILTIN_SENTENCES, normalizeSentence, sortSentences } from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import {
  generateSpeech,
  getSnapshot,
  playGeneratedAudio,
  preloadModel,
  stopPlayback,
  subscribe,
} from "../shared/model-tts.js";

const prepareButton = document.querySelector("#prepare-button");
const modelSpinner = document.querySelector("#model-spinner");
const modelStatus = document.querySelector("#model-status");
const modelProgress = document.querySelector("#model-progress");
const rateInput = document.querySelector("#rate-input");
const rateOutput = document.querySelector("#rate-output");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceList = document.querySelector("#sentence-list");
const debugCacheSize = document.querySelector("#debug-cache-size");

let userSentences = [];
let activeSentenceId = null;
let playbackSentenceId = null;
let modelState = getSnapshot();
const generatedAudio = new Map();

function allSentences() {
  return sortSentences([...BUILTIN_SENTENCES, ...userSentences]);
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function formatCacheSize() {
  let bytes = 0;
  for (const entry of generatedAudio.values()) {
    bytes += entry.audio.byteLength;
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function render() {
  rateOutput.textContent = `${Number(rateInput.value).toFixed(2)}x`;
  modelStatus.textContent = modelState.error
    ? `${modelState.message} ${modelState.error}`
    : modelState.message;
  modelProgress.style.width = `${Math.round((modelState.progress ?? 0) * 100)}%`;
  modelSpinner.hidden = !(modelState.phase === "loading" || modelState.phase === "generating");
  prepareButton.disabled = modelState.phase === "loading" || modelState.phase === "generating";
  prepareButton.textContent =
    modelState.phase === "ready" || modelState.phase === "playing"
      ? "Model cached"
      : "Prepare German model";
  debugCacheSize.textContent = `Generated audio cache: ${formatCacheSize()}`;

  const currentSpeed = Number(rateInput.value);
  const sentences = allSentences();
  sentenceList.innerHTML = sentences
    .map((sentence) => {
      const isGenerating = sentence.id === activeSentenceId && modelState.phase === "generating";
      const isPlaying = sentence.id === playbackSentenceId && modelState.phase === "playing";
      const description = sentence.theme ?? "Custom";
      const cached = generatedAudio.get(sentence.id);
      const hasPlayableAudio = Boolean(cached && cached.speed === currentSpeed);

      return `
        <article class="sentence-card">
          <div class="sentence-meta">
            <span class="badge">${sentence.source === "builtin" ? "Built-in" : "Your sentence"}</span>
            <span class="badge">${description}</span>
            ${hasPlayableAudio ? '<span class="badge">Audio cached</span>' : ""}
            ${isGenerating ? '<span class="badge">Generating</span>' : ""}
            ${isPlaying ? '<span class="badge">Playing</span>' : ""}
          </div>
          <p class="sentence-text">${escapeHtml(sentence.text)}</p>
          <div class="actions">
            <button data-action="generate" data-id="${sentence.id}">
              ${isGenerating ? "Generating..." : "Generate"}
            </button>
            <button class="secondary" data-action="play" data-id="${sentence.id}" ${
              hasPlayableAudio ? "" : "disabled"
            }>
              ${isPlaying ? "Playing..." : "Play"}
            </button>
            <button class="secondary" data-action="stop" data-id="${sentence.id}">Stop</button>
            ${
              sentence.source === "user"
                ? `<button class="delete" data-action="delete" data-id="${sentence.id}">Delete</button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

async function refreshUserSentences() {
  userSentences = await getUserSentences();
  render();
}

rateInput.addEventListener("input", render);
prepareButton.addEventListener("click", async () => {
  await preloadModel();
});

sentenceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = normalizeSentence(sentenceInput.value);

  if (!text) {
    return;
  }

  await addUserSentence(text);
  sentenceInput.value = "";
  await refreshUserSentences();
});

sentenceList.addEventListener("click", async (event) => {
  const trigger = event.target.closest("button[data-action]");
  if (!trigger) {
    return;
  }

  const { action, id } = trigger.dataset;
  const sentence = allSentences().find((entry) => entry.id === id);
  if (!sentence) {
    return;
  }

  if (action === "generate") {
    activeSentenceId = sentence.id;
    playbackSentenceId = null;
    render();

    try {
      const audio = await generateSpeech(sentence.text, { speed: Number(rateInput.value) });
      generatedAudio.set(sentence.id, { ...audio, speed: Number(rateInput.value) });
    } finally {
      activeSentenceId = null;
      render();
    }
  }

  if (action === "play") {
    const cached = generatedAudio.get(sentence.id);
    if (!cached || cached.speed !== Number(rateInput.value)) {
      return;
    }

    playbackSentenceId = sentence.id;
    render();
    try {
      await playGeneratedAudio(cached);
    } finally {
      playbackSentenceId = null;
      render();
    }
  }

  if (action === "stop") {
    stopPlayback();
    activeSentenceId = null;
    playbackSentenceId = null;
    render();
  }

  if (action === "delete" && sentence.source === "user") {
    await deleteUserSentence(id);
    if (activeSentenceId === id || playbackSentenceId === id) {
      stopPlayback();
      activeSentenceId = null;
      playbackSentenceId = null;
    }
    generatedAudio.delete(id);
    await refreshUserSentences();
  }
});

subscribe((snapshot) => {
  modelState = snapshot;
  if (
    !snapshot.isPlaying &&
    snapshot.phase === "ready" &&
    snapshot.message === "Playback finished."
  ) {
    playbackSentenceId = null;
  }
  render();
});

refreshUserSentences();
render();
