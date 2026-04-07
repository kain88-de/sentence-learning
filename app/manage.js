import {
  allSentences,
  cacheSizeText,
  escapeHtml,
  loadSentenceCollections,
  playSentenceAudio,
} from "../shared/app-support.js";
import { normalizeSentence } from "../shared/data.js";
import { addUserSentence, deleteUserSentence } from "../shared/db.js";
import { getSnapshot, preloadModel, subscribe } from "../shared/model-tts.js";

const prepareButton = document.querySelector("#prepare-button");
const modelSpinner = document.querySelector("#model-spinner");
const modelStatus = document.querySelector("#model-status");
const modelProgress = document.querySelector("#model-progress");
const rateInput = document.querySelector("#rate-input");
const rateOutput = document.querySelector("#rate-output");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceCount = document.querySelector("#sentence-count");
const sentenceList = document.querySelector("#sentence-list");
const debugCacheSize = document.querySelector("#debug-cache-size");

let builtinSentences = [];
let userSentences = [];
let isWorking = false;
let modelState = getSnapshot();
const generatedAudio = new Map();

function render() {
  const sentences = allSentences(builtinSentences, userSentences);

  rateOutput.textContent = `${Number(rateInput.value).toFixed(2)}x`;
  sentenceCount.textContent = `${sentences.length} ${sentences.length === 1 ? "Satz" : "Sätze"}`;
  debugCacheSize.textContent = `Audio-Zwischenspeicher: ${cacheSizeText(generatedAudio)}`;
  modelStatus.textContent = modelState.error
    ? `${modelState.message} ${modelState.error}`
    : modelState.message;
  modelProgress.style.width = `${Math.round((modelState.progress ?? 0) * 100)}%`;
  modelSpinner.hidden = !(modelState.phase === "loading" || modelState.phase === "generating");
  prepareButton.disabled =
    isWorking || modelState.phase === "loading" || modelState.phase === "generating";

  sentenceList.innerHTML = sentences
    .map((sentence) => {
      return `
        <article class="sentence-row">
          <div class="sentence-copy">
            <p>${escapeHtml(sentence.text)}</p>
            <div class="meta">${sentence.source === "builtin" ? "Vorlage" : "Eigen"}</div>
          </div>
          <div class="sentence-actions">
            <button class="row-action" data-action="play-sentence" data-id="${sentence.id}" type="button">
              Abspielen
            </button>
            ${
              sentence.source === "user"
                ? `<button class="delete" data-action="delete" data-id="${sentence.id}" type="button">Löschen</button>`
                : `<span class="meta">Nur lesen</span>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

async function refreshSentences() {
  ({ builtinSentences, userSentences } = await loadSentenceCollections());
  render();
}

prepareButton.addEventListener("click", async () => {
  await preloadModel();
});

rateInput.addEventListener("input", render);

sentenceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = normalizeSentence(sentenceInput.value);
  if (!text) return;

  await addUserSentence(text);
  sentenceInput.value = "";
  await refreshSentences();
});

sentenceList.addEventListener("click", async (event) => {
  const playButton = event.target.closest("button[data-action='play-sentence']");
  if (playButton) {
    const sentence = allSentences(builtinSentences, userSentences).find(
      (entry) => entry.id === playButton.dataset.id,
    );
    if (!sentence || isWorking) return;

    isWorking = true;
    render();

    try {
      await playSentenceAudio(sentence, Number(rateInput.value), generatedAudio);
    } finally {
      isWorking = false;
      render();
    }
    return;
  }

  const deleteButton = event.target.closest("button[data-action='delete']");
  if (!deleteButton) return;

  await deleteUserSentence(deleteButton.dataset.id);
  generatedAudio.delete(deleteButton.dataset.id);
  await refreshSentences();
});

subscribe((snapshot) => {
  modelState = snapshot;
  render();
});

await refreshSentences();
