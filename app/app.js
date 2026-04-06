import {
  PREBUILT_AUDIO_SPEED,
  loadBuiltinSentences,
  normalizeSentence,
  sortSentences,
} from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import {
  generateSpeech,
  getSnapshot,
  pausePlayback,
  playAudioUrl,
  playGeneratedAudio,
  preloadModel,
  resumePlayback,
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
const promptState = document.querySelector("#prompt-state");
const revealCard = document.querySelector("#reveal-card");
const revealedText = document.querySelector("#revealed-text");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceCount = document.querySelector("#sentence-count");
const sentenceList = document.querySelector("#sentence-list");
const debugCacheSize = document.querySelector("#debug-cache-size");
const wordPromptState = document.querySelector("#word-prompt-state");
const wordGrid = document.querySelector("#word-grid");
const wordRevealButton = document.querySelector("#word-reveal-button");
const wordRandomButton = document.querySelector("#word-random-button");
const wordRevealCard = document.querySelector("#word-reveal-card");
const revealedWords = document.querySelector("#revealed-words");

const BUILTIN_WORDS = [
  "Haus",
  "Baum",
  "Katze",
  "Schule",
  "Sonne",
  "Blume",
  "Tisch",
  "Brot",
  "Wasser",
  "Garten",
  "Apfel",
  "Lampe",
];

let currentTab = "practice";
let builtinSentences = [];
let userSentences = [];
let currentSentenceId = null;
let revealVisible = false;
let currentWords = [];
let wordsRevealVisible = false;
let activeWord = "";
let isWorking = false;
let isPlaying = false;
let modelState = getSnapshot();
const generatedAudio = new Map();

function allSentences() {
  return sortSentences([...builtinSentences, ...userSentences]);
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

function chooseRandomWords() {
  const shuffled = [...BUILTIN_WORDS].sort(() => Math.random() - 0.5);
  currentWords = shuffled.slice(0, 5);
  wordsRevealVisible = false;
  activeWord = "";
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

async function playWord(word) {
  const speed = Number(rateInput.value);
  const cacheKey = `word:${word}`;
  const cached = generatedAudio.get(cacheKey);

  if (cached && cached.speed === speed) {
    await playGeneratedAudio(cached);
    return;
  }

  const audio = await generateSpeech(word, { speed });
  generatedAudio.set(cacheKey, { ...audio, speed });
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

  rateOutput.textContent = `${speed.toFixed(2)}x`;
  promptState.textContent = sentence
    ? isWorking
      ? "Audio wird vorbereitet..."
      : modelState.isPaused
        ? "Pausiert. Druecke auf Play, wenn du bereit bist."
        : isPlaying
          ? "Schreibe auf, was du hoerst, und pruefe es dann unten."
          : "Druecke auf Play, schreibe den Satz und pruefe ihn dann unten."
    : "Fuege unter Verwalten einen Satz hinzu, um zu beginnen.";
  playButton.disabled = !sentence || isWorking;
  revealButton.disabled = !sentence;
  playButton.textContent = modelState.isPaused || isPlaying ? "❚❚" : "▶";
  revealedText.textContent = sentence ? sentence.text : "Hier erscheint die Loesung.";
  revealCard.classList.toggle("is-revealed", Boolean(sentence && revealVisible));
  revealedText.classList.toggle("is-blurred", !sentence || !revealVisible);
}

function renderWords() {
  const speed = Number(rateInput.value);

  rateOutput.textContent = `${speed.toFixed(2)}x`;
  wordPromptState.textContent = currentWords.length
    ? isWorking
      ? "Audio wird vorbereitet..."
      : activeWord
        ? `Tippe weiter oder decke die Woerter spaeter auf. Zuletzt gehoert: ${activeWord}.`
        : "Tippe auf ein Feld, hoere das Wort und decke die Woerter spaeter selbst auf."
    : "Es sind noch keine Woerter verfuegbar.";
  wordRandomButton.disabled = !currentWords.length || isWorking;
  wordRevealButton.disabled = !currentWords.length;
  wordGrid.innerHTML = currentWords
    .map((word, index) => {
      return `
        <button class="word-tile" data-action="play-word" data-word="${escapeHtml(word)}" type="button">
          <span class="word-number">${index + 1}</span>
          <span class="word-icon">▶</span>
        </button>
      `;
    })
    .join("");
  revealedWords.innerHTML = currentWords
    .map((word) => {
      return `<span class="revealed-word ${wordsRevealVisible ? "" : "is-blurred"}">${escapeHtml(word)}</span>`;
    })
    .join("");
  wordRevealCard.classList.toggle(
    "is-revealed",
    Boolean(currentWords.length && wordsRevealVisible),
  );
}

function renderManage() {
  const sentences = allSentences();
  sentenceCount.textContent = `${sentences.length} Satz${sentences.length === 1 ? "" : "e"}`;
  debugCacheSize.textContent = `Audio-Zwischenspeicher: ${cacheSizeText()}`;
  modelStatus.textContent = modelState.error
    ? `${modelState.message} ${modelState.error}`
    : modelState.message;
  modelProgress.style.width = `${Math.round((modelState.progress ?? 0) * 100)}%`;
  modelSpinner.hidden = !(modelState.phase === "loading" || modelState.phase === "generating");
  prepareButton.disabled = modelState.phase === "loading" || modelState.phase === "generating";

  sentenceList.innerHTML = sentences
    .map((sentence) => {
      return `
        <article class="sentence-row">
          <div class="sentence-copy">
            <p>${escapeHtml(sentence.text)}</p>
            <div class="meta">${sentence.source === "builtin" ? "Vorlage" : "Eigen"}</div>
          </div>
          ${
            sentence.source === "user"
              ? `<button class="delete" data-action="delete" data-id="${sentence.id}" type="button">Loeschen</button>`
              : `<span class="meta">Nur lesen</span>`
          }
        </article>
      `;
    })
    .join("");
}

function render() {
  renderTabs();
  renderPractice();
  renderWords();
  renderManage();
}

async function refreshUserSentences() {
  userSentences = await getUserSentences();
  if (!currentSentence()) chooseRandomSentence();
  render();
}

async function initializeBuiltinSentences() {
  try {
    builtinSentences = await loadBuiltinSentences();
  } catch (error) {
    builtinSentences = [];
    console.error(error);
  }
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
  isPlaying = false;
  render();
});

wordRandomButton.addEventListener("click", () => {
  chooseRandomWords();
  isPlaying = false;
  render();
});

playButton.addEventListener("click", async () => {
  const sentence = currentSentence();
  if (!sentence) return;

  if (modelState.isPaused) {
    await resumePlayback();
    isPlaying = true;
    render();
    return;
  }

  if (isPlaying) {
    await pausePlayback();
    isPlaying = false;
    render();
    return;
  }

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
  render();
});

wordRevealButton.addEventListener("click", () => {
  wordsRevealVisible = !wordsRevealVisible;
  render();
});

wordGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='play-word']");
  if (!button) return;

  const word = button.dataset.word;
  if (!word) return;

  activeWord = word;
  isWorking = true;
  render();

  try {
    await playWord(word);
    isPlaying = true;
  } finally {
    isWorking = false;
    render();
  }
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
    !snapshot.isPaused &&
    snapshot.phase === "ready" &&
    snapshot.message === "Wiedergabe beendet."
  ) {
    isPlaying = false;
  }
  render();
});

chooseRandomSentence();
chooseRandomWords();
await initializeBuiltinSentences();
await refreshUserSentences();
render();
