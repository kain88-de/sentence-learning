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
const sentenceList = document.querySelector("#sentence-list");

let userSentences = [];
let activeSentenceId = null;
let modelState = getSnapshot();

function allSentences() {
  return sortSentences([...BUILTIN_SENTENCES, ...userSentences]);
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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

  const sentences = allSentences();
  sentenceList.innerHTML = sentences
    .map((sentence) => {
      const isActive = sentence.id === activeSentenceId;
      const description = sentence.theme ?? "Custom";

      return `
        <article class="sentence-card">
          <div class="sentence-meta">
            <span class="badge">${sentence.source === "builtin" ? "Built-in" : "Your sentence"}</span>
            <span class="badge">${description}</span>
            ${isActive ? '<span class="badge">Generating or playing</span>' : ""}
          </div>
          <p class="sentence-text">${escapeHtml(sentence.text)}</p>
          <div class="actions">
            <button data-action="play" data-id="${sentence.id}">
              ${isActive ? "Working..." : "Generate and play"}
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

  if (action === "play" && sentence) {
    activeSentenceId = sentence.id;
    render();

    try {
      await speakText(sentence.text, { speed: Number(rateInput.value) });
    } finally {
      activeSentenceId = null;
      render();
    }
  }

  if (action === "stop") {
    stopPlayback();
    activeSentenceId = null;
    render();
  }

  if (action === "delete" && sentence?.source === "user") {
    await deleteUserSentence(id);
    if (activeSentenceId === id) {
      stopPlayback();
      activeSentenceId = null;
    }
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
