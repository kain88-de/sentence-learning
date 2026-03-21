import { BUILTIN_SENTENCES, normalizeSentence, sortSentences } from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import { createSpeechController } from "../shared/speech.js";

const voiceSelect = document.querySelector("#voice-select");
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
let boundaryIndex = null;

const speech = createSpeechController({
  onVoices(voices) {
    voiceSelect.innerHTML = "";
    if (!voices.length) {
      voiceSelect.add(new Option("No German voice available", ""));
      return;
    }

    for (const voice of voices) {
      voiceSelect.add(new Option(`${voice.name} (${voice.lang})`, voice.name));
    }
  },
  onBoundary(charIndex) {
    boundaryIndex = charIndex;
    renderCurrentSentence();
  },
  onStart() {
    render();
  },
  onEnd() {
    activeSentenceId = null;
    boundaryIndex = null;
    render();
  },
});

function allSentences() {
  return sortSentences([...BUILTIN_SENTENCES, ...userSentences]);
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function highlightText(text) {
  if (boundaryIndex == null || boundaryIndex >= text.length) {
    return escapeHtml(text);
  }

  const first = escapeHtml(text.slice(0, boundaryIndex));
  const nextSpace = text.indexOf(" ", boundaryIndex);
  const current = escapeHtml(text.slice(boundaryIndex, nextSpace === -1 ? text.length : nextSpace));
  const rest = escapeHtml(text.slice(nextSpace === -1 ? text.length : nextSpace));
  return `${first}<mark>${current}</mark>${rest}`;
}

function renderCurrentSentence() {
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  if (!sentence) {
    currentText.textContent = "Choose a sentence to start slow playback.";
    return;
  }

  currentText.innerHTML =
    sentence.id === activeSentenceId ? highlightText(sentence.text) : escapeHtml(sentence.text);
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
              ${active ? "Playing..." : "Play now"}
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

function playSelectedSentence() {
  const sentence = allSentences().find((entry) => entry.id === selectedSentenceId);
  if (!sentence) {
    return;
  }

  activeSentenceId = sentence.id;
  boundaryIndex = null;
  speech.speak({
    text: sentence.text,
    voiceName: voiceSelect.value,
    rate: rateInput.value,
  });
  render();
}

rateInput.addEventListener("input", render);
playCurrentButton.addEventListener("click", playSelectedSentence);
stopCurrentButton.addEventListener("click", () => {
  speech.stop();
  activeSentenceId = null;
  boundaryIndex = null;
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
    playSelectedSentence();
  }

  if (action === "delete" && sentence.source === "user") {
    if (activeSentenceId === id) {
      speech.stop();
      activeSentenceId = null;
      boundaryIndex = null;
    }
    await deleteUserSentence(id);
    await refreshUserSentences();
  }
});

refreshUserSentences();
render();
