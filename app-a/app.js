import { BUILTIN_SENTENCES, normalizeSentence, sortSentences } from "../shared/data.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "../shared/db.js";
import { createSpeechController } from "../shared/speech.js";

const voiceSelect = document.querySelector("#voice-select");
const rateInput = document.querySelector("#rate-input");
const rateOutput = document.querySelector("#rate-output");
const sentenceForm = document.querySelector("#sentence-form");
const sentenceInput = document.querySelector("#sentence-input");
const sentenceList = document.querySelector("#sentence-list");

let userSentences = [];
let activeSentenceId = null;
let boundaryIndex = null;

const speech = createSpeechController({
  onVoices(voices) {
    voiceSelect.innerHTML = "";

    if (!voices.length) {
      const option = new Option("No German voice available", "");
      voiceSelect.add(option);
      return;
    }

    for (const voice of voices) {
      const label = `${voice.name} (${voice.lang})`;
      voiceSelect.add(new Option(label, voice.name));
    }
  },
  onBoundary(charIndex) {
    boundaryIndex = charIndex;
    render();
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
  if (boundaryIndex == null || boundaryIndex < 0 || boundaryIndex >= text.length) {
    return escapeHtml(text);
  }

  const start = escapeHtml(text.slice(0, boundaryIndex));
  const endBoundary = text.indexOf(" ", boundaryIndex);
  const currentWord = escapeHtml(
    text.slice(boundaryIndex, endBoundary === -1 ? text.length : endBoundary),
  );
  const end = escapeHtml(text.slice(endBoundary === -1 ? text.length : endBoundary));
  return `${start}<mark>${currentWord}</mark>${end}`;
}

function render() {
  const sentences = allSentences();

  sentenceList.innerHTML = sentences
    .map((sentence) => {
      const isActive = sentence.id === activeSentenceId;
      const description = sentence.theme ?? "Custom";
      const textMarkup = isActive ? highlightText(sentence.text) : escapeHtml(sentence.text);

      return `
        <article class="sentence-card">
          <div class="sentence-meta">
            <span class="badge">${sentence.source === "builtin" ? "Built-in" : "Your sentence"}</span>
            <span class="badge">${description}</span>
          </div>
          <p class="sentence-text">${textMarkup}</p>
          <div class="actions">
            <button data-action="play" data-id="${sentence.id}">
              ${isActive ? "Playing..." : "Play slowly"}
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

rateInput.addEventListener("input", () => {
  rateOutput.textContent = `${Number(rateInput.value).toFixed(2)}x`;
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
    boundaryIndex = null;
    render();
    speech.speak({
      text: sentence.text,
      voiceName: voiceSelect.value,
      rate: rateInput.value,
    });
  }

  if (action === "stop") {
    speech.stop();
    activeSentenceId = null;
    boundaryIndex = null;
    render();
  }

  if (action === "delete" && sentence?.source === "user") {
    await deleteUserSentence(id);
    if (activeSentenceId === id) {
      speech.stop();
      activeSentenceId = null;
      boundaryIndex = null;
    }
    await refreshUserSentences();
  }
});

refreshUserSentences();
render();
