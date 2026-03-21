import { BUILTIN_SENTENCES, normalizeSentence, sortSentences } from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import { createSpeechController } from "../shared/speech.js";

const voiceSelect = document.querySelector("#voice-select");
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
    renderDetail();
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

function getSelectedSentence() {
  return allSentences().find((sentence) => sentence.id === selectedSentenceId) ?? null;
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function highlightText(text) {
  if (boundaryIndex == null || boundaryIndex >= text.length) {
    return escapeHtml(text);
  }

  const before = escapeHtml(text.slice(0, boundaryIndex));
  const nextSpace = text.indexOf(" ", boundaryIndex);
  const focus = escapeHtml(text.slice(boundaryIndex, nextSpace === -1 ? text.length : nextSpace));
  const after = escapeHtml(text.slice(nextSpace === -1 ? text.length : nextSpace));
  return `${before}<mark>${focus}</mark>${after}`;
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
  detailText.innerHTML =
    sentence.id === activeSentenceId ? highlightText(sentence.text) : escapeHtml(sentence.text);
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
  boundaryIndex = null;
  speech.speak({
    text: sentence.text,
    voiceName: voiceSelect.value,
    rate: rateInput.value,
  });
  render();
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
playButton.addEventListener("click", playSelectedSentence);
stopButton.addEventListener("click", () => {
  speech.stop();
  activeSentenceId = null;
  boundaryIndex = null;
  render();
});

deleteButton.addEventListener("click", async () => {
  const sentence = getSelectedSentence();
  if (!sentence || sentence.source !== "user") {
    return;
  }

  if (activeSentenceId === sentence.id) {
    speech.stop();
    activeSentenceId = null;
    boundaryIndex = null;
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

refreshUserSentences();
render();
