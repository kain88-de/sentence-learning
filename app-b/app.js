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

const tabs = [...document.querySelectorAll(".tab")];
const views = [...document.querySelectorAll("[data-view]")];
const prepareButton = document.querySelector("#prepare-button");
const modelSpinner = document.querySelector("#model-spinner");
const modelStatus = document.querySelector("#model-status");
const modelProgress = document.querySelector("#model-progress");
const rateInput = document.querySelector("#rate-input");
const rateOutput = document.querySelector("#rate-output");
const randomButton = document.querySelector("#random-button");
const playButton = document.querySelector("#play-button");
const revealButton = document.querySelector("#reveal-button");
const stopButton = document.querySelector("#stop-button");
const promptState = document.querySelector("#prompt-state");
const revealCard = document.querySelector("#reveal-card");
const revealedText = document.querySelector("#revealed-text");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceCount = document.querySelector("#sentence-count");
const sentenceList = document.querySelector("#sentence-list");
const debugCacheSize = document.querySelector("#debug-cache-size");

let currentTab = "practice";
let userSentences = [];
let currentSentenceId = null;
let revealVisible = false;
let isWorking = false;
let isPlaying = false;
let modelState = getSnapshot();
const generatedAudio = new Map();

function allSentences() {
  return sortSentences([...BUILTIN_SENTENCES, ...userSentences]);
}

function currentSentence() {
  return allSentences().find((sentence) => sentence.id === currentSentenceId) ?? null;
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function cacheSizeText() {
  let bytes = 0;
  for (const entry of generatedAudio.values()) bytes += entry.audio.byteLength;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function chooseRandomSentence() {
  const sentences = allSentences();
  if (!sentences.length) {
    currentSentenceId = null;
    revealVisible = false;
    return;
  }

  const pool =
    sentences.length > 1
      ? sentences.filter((sentence) => sentence.id !== currentSentenceId)
      : sentences;
  currentSentenceId = pool[Math.floor(Math.random() * pool.length)].id;
  revealVisible = false;
}

async function playSentence(sentence) {
  const speed = Number(rateInput.value);
  const cached = generatedAudio.get(sentence.id);

  if (cached && cached.speed === speed) {
    await playGeneratedAudio(cached);
    return;
  }

  if (sentence.audioSrc && speed === PREBUILT_AUDIO_SPEED) {
    await playAudioUrl(sentence.audioSrc);
    return;
  }

  const audio = await generateSpeech(sentence.text, { speed });
  generatedAudio.set(sentence.id, { ...audio, speed });
  await playGeneratedAudio(audio);
}

function renderTabs() {
  for (const tab of tabs) {
    tab.classList.toggle("active", tab.dataset.tab === currentTab);
  }
  for (const view of views) {
    view.hidden = view.dataset.view !== currentTab;
  }
}

function renderPractice() {
  const sentence = currentSentence();
  const speed = Number(rateInput.value);
  const hasPlayableAudio = Boolean(
    sentence &&
      (generatedAudio.get(sentence.id)?.speed === speed ||
        (sentence.audioSrc && speed === PREBUILT_AUDIO_SPEED)),
  );

  rateOutput.textContent = `${speed.toFixed(2)}x`;
  modelStatus.textContent = modelState.error
    ? `${modelState.message} ${modelState.error}`
    : modelState.message;
  modelProgress.style.width = `${Math.round((modelState.progress ?? 0) * 100)}%`;
  modelSpinner.hidden = !(modelState.phase === "loading" || modelState.phase === "generating");
  prepareButton.disabled = modelState.phase === "loading" || modelState.phase === "generating";
  promptState.textContent = sentence
    ? isWorking
      ? "Preparing audio..."
      : isPlaying
        ? "Sentence is playing."
        : "Random sentence selected. Press play."
    : "No sentences available yet.";
  playButton.disabled = !sentence || isWorking;
  playButton.textContent =
    hasPlayableAudio && !isWorking ? "Play again" : isWorking ? "Working..." : "Play";
  revealButton.disabled = !sentence;
  revealCard.hidden = !sentence || !revealVisible;
  revealedText.textContent = revealVisible && sentence ? sentence.text : "";
}

function renderManage() {
  const sentences = allSentences();
  sentenceCount.textContent = `${sentences.length} sentence${sentences.length === 1 ? "" : "s"}`;
  debugCacheSize.textContent = `Generated audio cache: ${cacheSizeText()}`;
  sentenceList.innerHTML = sentences
    .map((sentence) => {
      const meta = sentence.source === "builtin" ? sentence.theme : "Custom";
      return `
        <article class="sentence-row">
          <div class="sentence-copy">
            <p>${escapeHtml(sentence.text)}</p>
            <div class="meta">${sentence.source === "builtin" ? "Built-in" : "Custom"} · ${escapeHtml(meta)}</div>
          </div>
          ${
            sentence.source === "user"
              ? `<button class="delete" data-action="delete" data-id="${sentence.id}" type="button">Delete</button>`
              : `<span class="meta">Read only</span>`
          }
        </article>
      `;
    })
    .join("");
}

function render() {
  renderTabs();
  renderPractice();
  renderManage();
}

async function refreshUserSentences() {
  userSentences = await getUserSentences();
  if (!currentSentence()) chooseRandomSentence();
  render();
}

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    currentTab = tab.dataset.tab;
    render();
  });
}

prepareButton.addEventListener("click", async () => {
  await preloadModel();
});

rateInput.addEventListener("input", render);

randomButton.addEventListener("click", () => {
  chooseRandomSentence();
  render();
});

playButton.addEventListener("click", async () => {
  const sentence = currentSentence();
  if (!sentence) return;
  isWorking = true;
  render();

  try {
    await playSentence(sentence);
    isPlaying = true;
  } finally {
    isWorking = false;
    render();
  }
});

revealButton.addEventListener("click", () => {
  revealVisible = !revealVisible;
  revealButton.textContent = revealVisible ? "Hide" : "Reveal";
  render();
});

stopButton.addEventListener("click", () => {
  stopPlayback();
  isPlaying = false;
  isWorking = false;
  render();
});

sentenceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = normalizeSentence(sentenceInput.value);
  if (!text) return;

  await addUserSentence(text);
  sentenceInput.value = "";
  await refreshUserSentences();
});

sentenceList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='delete']");
  if (!button) return;

  await deleteUserSentence(button.dataset.id);
  generatedAudio.delete(button.dataset.id);
  await refreshUserSentences();
});

subscribe((snapshot) => {
  modelState = snapshot;
  if (
    !snapshot.isPlaying &&
    snapshot.phase === "ready" &&
    snapshot.message === "Playback finished."
  ) {
    isPlaying = false;
  }
  render();
});

chooseRandomSentence();
refreshUserSentences();
render();
