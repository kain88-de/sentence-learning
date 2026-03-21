import { BUILTIN_SENTENCES, normalizeSentence, sortSentences } from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import {
  getSnapshot,
  preloadModel,
  speakText,
  stopPlayback,
  subscribe,
} from "../shared/model-tts.js";

const prepareButton = document.querySelector("#prepare-button");
const modelStatus = document.querySelector("#model-status");
const modelProgress = document.querySelector("#model-progress");
const rateInput = document.querySelector("#rate-input");
const rateOutput = document.querySelector("#rate-output");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const detailSource = document.querySelector("#detail-source");
const detailTheme = document.querySelector("#detail-theme");
const detailText = document.querySelector("#detail-text");
const playButton = document.querySelector("#play-button");
const stopButton = document.querySelector("#stop-button");
const deleteButton = document.querySelector("#delete-button");
const sentenceList = document.querySelector("#sentence-list");

let userSentences = [];
let selectedSentenceId = BUILTIN_SENTENCES[0].id;
let activeSentenceId = null;
let modelState = getSnapshot();

function allSentences() {
  return sortSentences([...BUILTIN_SENTENCES, ...userSentences]);
}

function getSelectedSentence() {
  return allSentences().find((sentence) => sentence.id === selectedSentenceId) ?? null;
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
  rateOutput.textContent = `${Number(rateInput.value).toFixed(2)}x`;
  modelStatus.textContent = modelState.error
    ? `${modelState.message} ${modelState.error}`
    : modelState.message;
  modelProgress.style.width = `${Math.round((modelState.progress ?? 0) * 100)}%`;
  prepareButton.disabled = modelState.phase === "loading" || modelState.phase === "generating";
  prepareButton.textContent =
    modelState.phase === "ready" || modelState.phase === "playing"
      ? "Model cached"
      : "Prepare German model";
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

function playSelectedSentence() {
  const sentence = getSelectedSentence();
  if (!sentence) {
    return;
  }

  activeSentenceId = sentence.id;
  render();

  speakText(sentence.text, { speed: Number(rateInput.value) })
    .catch(() => {})
    .finally(() => {
      activeSentenceId = null;
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
playButton.addEventListener("click", playSelectedSentence);
stopButton.addEventListener("click", () => {
  stopPlayback();
  activeSentenceId = null;
  render();
});

deleteButton.addEventListener("click", async () => {
  const sentence = getSelectedSentence();
  if (!sentence || sentence.source !== "user") {
    return;
  }

  if (activeSentenceId === sentence.id) {
    stopPlayback();
    activeSentenceId = null;
  }

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
    activeSentenceId = null;
  }
  render();
});

refreshUserSentences();
render();
