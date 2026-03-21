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
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const detailSource = document.querySelector("#detail-source");
const detailTheme = document.querySelector("#detail-theme");
const detailText = document.querySelector("#detail-text");
const generateButton = document.querySelector("#generate-button");
const playButton = document.querySelector("#play-button");
const stopButton = document.querySelector("#stop-button");
const deleteButton = document.querySelector("#delete-button");
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

function getSelectedSentence() {
  return allSentences().find((sentence) => sentence.id === selectedSentenceId) ?? null;
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

function renderDetail() {
  const sentence = getSelectedSentence();

  if (!sentence) {
    detailSource.textContent = "No sentence";
    detailTheme.textContent = "Empty";
    detailText.textContent = "Add or select a sentence.";
    deleteButton.hidden = true;
    return;
  }

  detailSource.textContent = sentence.source === "builtin" ? "Built-in" : "Custom";
  detailTheme.textContent = sentence.theme ?? "User sentence";
  detailText.innerHTML = escapeHtml(sentence.text);
  deleteButton.hidden = sentence.source !== "user";
}

function renderList() {
  sentenceList.innerHTML = allSentences()
    .map((sentence) => {
      const isActive = sentence.id === selectedSentenceId;
      return `
        <article class="row ${isActive ? "active" : ""}">
          <span class="row-tag">${sentence.source === "builtin" ? "Built-in" : "Custom"}</span>
          <p>${escapeHtml(sentence.text)}</p>
          <button data-id="${sentence.id}">${isActive ? "Selected" : "Open"}</button>
        </article>
      `;
    })
    .join("");
}

function render() {
  const currentSpeed = Number(rateInput.value);
  const cached = generatedAudio.get(selectedSentenceId);
  const selectedSentence = getSelectedSentence();
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
  generateButton.textContent =
    activeSentenceId === selectedSentenceId && modelState.phase === "generating"
      ? "Generating..."
      : "Generate";
  playButton.disabled = !hasPlayableAudio;
  playButton.textContent =
    playbackSentenceId === selectedSentenceId && modelState.phase === "playing"
      ? "Playing..."
      : "Play";
  renderDetail();
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

function generateSelectedSentence() {
  const sentence = getSelectedSentence();
  if (!sentence) {
    return;
  }

  activeSentenceId = sentence.id;
  playbackSentenceId = null;
  render();

  generateSpeech(sentence.text, { speed: Number(rateInput.value) })
    .then((audio) => {
      generatedAudio.set(sentence.id, { ...audio, speed: Number(rateInput.value) });
    })
    .catch(() => {})
    .finally(() => {
      activeSentenceId = null;
      render();
    });
}

function playSelectedSentence() {
  const cached = generatedAudio.get(selectedSentenceId);
  const sentence = getSelectedSentence();
  if (!sentence) {
    return;
  }

  playbackSentenceId = selectedSentenceId;
  render();

  const playback =
    cached && cached.speed === Number(rateInput.value)
      ? playGeneratedAudio(cached)
      : sentence.audioSrc && Number(rateInput.value) === PREBUILT_AUDIO_SPEED
        ? playAudioUrl(sentence.audioSrc)
        : Promise.resolve();

  playback
    .catch(() => {})
    .finally(() => {
      playbackSentenceId = null;
      render();
    });
}

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

rateInput.addEventListener("input", render);
prepareButton.addEventListener("click", async () => {
  await preloadModel();
});
generateButton.addEventListener("click", generateSelectedSentence);
playButton.addEventListener("click", playSelectedSentence);
stopButton.addEventListener("click", () => {
  stopPlayback();
  activeSentenceId = null;
  playbackSentenceId = null;
  render();
});

deleteButton.addEventListener("click", async () => {
  const sentence = getSelectedSentence();
  if (!sentence || sentence.source !== "user") {
    return;
  }

  if (activeSentenceId === sentence.id || playbackSentenceId === sentence.id) {
    stopPlayback();
    activeSentenceId = null;
    playbackSentenceId = null;
  }

  generatedAudio.delete(sentence.id);
  await deleteUserSentence(sentence.id);
  await refreshUserSentences();
});

sentenceList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) {
    return;
  }

  selectedSentenceId = button.dataset.id;
  render();
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
