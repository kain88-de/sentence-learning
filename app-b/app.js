import {
  BUILTIN_SENTENCES,
  PREBUILT_AUDIO_SPEED,
  normalizeSentence,
  sortSentences,
} from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import {
  generateSpeech,
  getSnapshot,
  playAudioUrl,
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
const generateCurrentButton = document.querySelector("#generate-current");
const playCurrentButton = document.querySelector("#play-current");
const stopCurrentButton = document.querySelector("#stop-current");
const currentText = document.querySelector("#current-text");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceList = document.querySelector("#sentence-list");
const debugCacheSize = document.querySelector("#debug-cache-size");

let userSentences = [];
let selectedSentenceId = BUILTIN_SENTENCES[0].id;
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

function renderCurrentSentence() {
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  currentText.innerHTML = sentence
    ? escapeHtml(sentence.text)
    : "Choose a sentence to start slow playback.";
}

function renderList() {
  const currentSpeed = Number(rateInput.value);
  sentenceList.innerHTML = allSentences()
    .map((sentence) => {
      const selected = sentence.id === selectedSentenceId;
      const isGenerating = sentence.id === activeSentenceId && modelState.phase === "generating";
      const cached = generatedAudio.get(sentence.id);
      const hasGeneratedAudio = Boolean(cached && cached.speed === currentSpeed);
      const hasPrebuiltAudio =
        sentence.source === "builtin" && sentence.audioSrc && currentSpeed === PREBUILT_AUDIO_SPEED;
      return `
        <article class="item ${selected ? "active" : ""}">
          <div class="item-top">
            <span class="pill">${sentence.source === "builtin" ? "Built-in" : "Custom"}</span>
            <span class="pill">${sentence.theme ?? "User sentence"}</span>
          </div>
          <p>${escapeHtml(sentence.text)}</p>
          <div class="item-actions">
            <button data-action="select" data-id="${sentence.id}">
              ${selected ? "Selected" : "Select"}
            </button>
            <button class="secondary" data-action="generate" data-id="${sentence.id}">
              ${isGenerating ? "Generating..." : "Generate now"}
            </button>
            ${hasGeneratedAudio ? '<span class="pill">Cached</span>' : ""}
            ${hasPrebuiltAudio ? '<span class="pill">Prebuilt</span>' : ""}
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

function render() {
  const currentSpeed = Number(rateInput.value);
  const cached = generatedAudio.get(selectedSentenceId);
  const selectedSentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  const hasPlayableAudio = Boolean(
    (cached && cached.speed === currentSpeed) ||
      (selectedSentence?.audioSrc && currentSpeed === PREBUILT_AUDIO_SPEED),
  );

  rateOutput.textContent = `${currentSpeed.toFixed(2)}x`;
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
  generateCurrentButton.textContent =
    activeSentenceId === selectedSentenceId && modelState.phase === "generating"
      ? "Generating..."
      : "Generate selected sentence";
  playCurrentButton.disabled = !hasPlayableAudio;
  playCurrentButton.textContent =
    playbackSentenceId === selectedSentenceId && modelState.phase === "playing"
      ? "Playing..."
      : "Play generated audio";
  renderCurrentSentence();
  renderList();
}

async function refreshUserSentences() {
  userSentences = await getUserSentences();
  const sentences = allSentences();
  if (!sentences.some((sentence) => sentence.id === selectedSentenceId)) {
    selectedSentenceId = sentences[0]?.id ?? null;
  }
  render();
}

async function generateSelectedSentence() {
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  if (!sentence) {
    return;
  }

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

async function playSelectedSentence() {
  const cached = generatedAudio.get(selectedSentenceId);
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  if (!sentence) {
    return;
  }

  playbackSentenceId = selectedSentenceId;
  render();

  try {
    if (cached && cached.speed === Number(rateInput.value)) {
      await playGeneratedAudio(cached);
    } else if (sentence.audioSrc && Number(rateInput.value) === PREBUILT_AUDIO_SPEED) {
      await playAudioUrl(sentence.audioSrc);
    } else {
      return;
    }
  } finally {
    playbackSentenceId = null;
    render();
  }
}

rateInput.addEventListener("input", render);
prepareButton.addEventListener("click", async () => {
  await preloadModel();
});
generateCurrentButton.addEventListener("click", generateSelectedSentence);
playCurrentButton.addEventListener("click", playSelectedSentence);
stopCurrentButton.addEventListener("click", () => {
  stopPlayback();
  activeSentenceId = null;
  playbackSentenceId = null;
  render();
});

sentenceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = normalizeSentence(sentenceInput.value);
  if (!text) {
    return;
  }

  const created = await addUserSentence(text);
  sentenceInput.value = "";
  selectedSentenceId = created.id;
  await refreshUserSentences();
});

sentenceList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  const sentence = allSentences().find((entry) => entry.id === id);
  if (!sentence) {
    return;
  }

  if (action === "select") {
    selectedSentenceId = id;
    render();
  }

  if (action === "generate") {
    selectedSentenceId = id;
    await generateSelectedSentence();
  }

  if (action === "delete" && sentence.source === "user") {
    if (activeSentenceId === id || playbackSentenceId === id) {
      stopPlayback();
      activeSentenceId = null;
      playbackSentenceId = null;
    }
    generatedAudio.delete(id);
    await deleteUserSentence(id);
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
