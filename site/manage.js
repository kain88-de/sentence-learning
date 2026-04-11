import { playSentence } from "./lib/audio-playback.js";
import { deleteUserAudio, putUserAudio } from "./lib/db.js";
import { getModelStatusSnapshot, subscribeModelStatus } from "./lib/model-status.js";
import { generateSpeech, preloadModel } from "./lib/model-tts.js";
import {
  allSentences,
  createUserSentence,
  loadSentenceCollections,
  removeUserSentence,
} from "./lib/sentences.js";

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const prepareButton = document.querySelector("#prepare-button");
const modelSpinner = document.querySelector("#model-spinner");
const modelStatus = document.querySelector("#model-status");
const modelProgress = document.querySelector("#model-progress");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceCount = document.querySelector("#sentence-count");
const sentenceList = document.querySelector("#sentence-list");
const composerStatus = document.querySelector("#composer-status");

let builtinSentences = [];
let userSentences = [];
let isWorking = false;
let currentStatus = "Gib einen Satz ein. Das Audio wird direkt danach gespeichert.";
let modelState = getModelStatusSnapshot();

function render() {
  const sentences = allSentences(builtinSentences, userSentences);

  sentenceCount.textContent = `${sentences.length} ${sentences.length === 1 ? "Satz" : "Sätze"}`;
  composerStatus.textContent = currentStatus;
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

sentenceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isWorking) return;

  isWorking = true;
  currentStatus = "Satz wird gespeichert...";
  render();

  try {
    const sentence = await createUserSentence(sentenceInput.value);
    if (!sentence) {
      currentStatus = "Bitte gib einen Satz ein.";
      return;
    }

    sentenceInput.value = "";
    currentStatus = "Audio wird erzeugt und in der Datenbank gespeichert...";
    render();

    try {
      const generated = await generateSpeech(sentence.text);
      await putUserAudio({
        key: sentence.audioKey,
        sentenceId: sentence.id,
        text: sentence.text,
        audio: generated.audio,
        samplingRate: generated.sampling_rate,
        createdAt: Date.now(),
      });
    } catch (error) {
      await removeUserSentence(sentence.id);
      throw error;
    }

    currentStatus = "Satz und Audio wurden gespeichert.";
    await refreshSentences();
  } catch (error) {
    console.error(error);
    currentStatus = "Audio konnte nicht gespeichert werden.";
  } finally {
    isWorking = false;
    render();
  }
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
      await playSentence(sentence);
    } catch (error) {
      console.error(error);
      currentStatus = "Audio für diesen Satz fehlt oder ist fehlerhaft.";
    } finally {
      isWorking = false;
      render();
    }
    return;
  }

  const deleteButton = event.target.closest("button[data-action='delete']");
  if (!deleteButton || isWorking) return;

  const sentence = userSentences.find((entry) => entry.id === deleteButton.dataset.id);
  if (!sentence) return;

  isWorking = true;
  currentStatus = "Satz und gespeichertes Audio werden gelöscht...";
  render();

  try {
    await removeUserSentence(sentence.id);
    await deleteUserAudio(sentence.audioKey);
    currentStatus = "Satz gelöscht.";
    await refreshSentences();
  } finally {
    isWorking = false;
    render();
  }
});

subscribeModelStatus((snapshot) => {
  modelState = snapshot;
  render();
});

await refreshSentences();
