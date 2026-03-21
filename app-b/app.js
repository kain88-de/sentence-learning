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
const playCurrentButton = document.querySelector("#play-current");
const stopCurrentButton = document.querySelector("#stop-current");
const currentText = document.querySelector("#current-text");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceList = document.querySelector("#sentence-list");

let userSentences = [];
let selectedSentenceId = BUILTIN_SENTENCES[0].id;
let activeSentenceId = null;
let modelState = getSnapshot();

function allSentences() {
  return sortSentences([...BUILTIN_SENTENCES, ...userSentences]);
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderCurrentSentence() {
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  currentText.innerHTML = sentence
    ? escapeHtml(sentence.text)
    : "Choose a sentence to start slow playback.";
}

function renderList() {
  sentenceList.innerHTML = allSentences()
    .map((sentence) => {
      const selected = sentence.id === selectedSentenceId;
      const active = sentence.id === activeSentenceId;
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
            <button class="secondary" data-action="play" data-id="${sentence.id}">
              ${active ? "Working..." : "Generate now"}
            </button>
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

async function playSelectedSentence() {
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  if (!sentence) {
    return;
  }

  activeSentenceId = sentence.id;
  render();

  try {
    await speakText(sentence.text, { speed: Number(rateInput.value) });
  } finally {
    activeSentenceId = null;
    render();
  }
}

rateInput.addEventListener("input", render);
prepareButton.addEventListener("click", async () => {
  await preloadModel();
});
playCurrentButton.addEventListener("click", playSelectedSentence);
stopCurrentButton.addEventListener("click", () => {
  stopPlayback();
  activeSentenceId = null;
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

  if (action === "play") {
    selectedSentenceId = id;
    await playSelectedSentence();
  }

  if (action === "delete" && sentence.source === "user") {
    if (activeSentenceId === id) {
      stopPlayback();
      activeSentenceId = null;
    }
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
    activeSentenceId = null;
  }
  render();
});

refreshUserSentences();
render();
