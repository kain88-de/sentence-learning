import { allSentences, loadSentenceCollections, playSentenceAudio } from "../shared/app-support.js";
import { pausePlayback, resumePlayback } from "../shared/audio-playback.js";
import { getAudioSnapshot, subscribeAudioState } from "../shared/audio-state.js";
import { PREBUILT_AUDIO_SPEED } from "../shared/data.js";

const playButton = document.querySelector("#play-button");
const randomButton = document.querySelector("#random-button");
const revealButton = document.querySelector("#reveal-button");
const revealCard = document.querySelector("#reveal-card");
const revealedText = document.querySelector("#revealed-text");

let builtinSentences = [];
let userSentences = [];
let currentSentenceId = null;
let revealVisible = false;
let isWorking = false;
let modelState = getAudioSnapshot();
let hasInitialized = false;
const generatedAudio = new Map();

function currentSentence() {
  return allSentences(builtinSentences, userSentences).find(
    (sentence) => sentence.id === currentSentenceId,
  );
}

function chooseRandomSentence() {
  const sentences = allSentences(builtinSentences, userSentences);
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

function render() {
  const sentence = currentSentence();
  const playLabel = modelState.isPaused || modelState.isPlaying ? "Pausieren" : "Abspielen";

  playButton.disabled = !sentence || isWorking;
  randomButton.disabled = !sentence || isWorking;
  revealButton.disabled = !sentence;
  playButton.querySelector(".button-icon").textContent =
    modelState.isPaused || modelState.isPlaying ? "❚❚" : "▶";
  playButton.querySelector(".button-label").textContent = playLabel;
  revealButton.textContent = revealVisible ? "Lösung ausblenden" : "Lösung zeigen";
  revealedText.textContent = sentence ? sentence.text : "Hier erscheint die Lösung.";
  revealCard.classList.toggle("is-revealed", Boolean(sentence && revealVisible));
  revealedText.classList.toggle("is-blurred", !sentence || !revealVisible);
}

randomButton.addEventListener("click", () => {
  chooseRandomSentence();
  render();
});

playButton.addEventListener("click", async () => {
  const sentence = currentSentence();
  if (!sentence) return;

  if (modelState.isPaused) {
    await resumePlayback();
    render();
    return;
  }

  if (modelState.isPlaying) {
    await pausePlayback();
    render();
    return;
  }

  isWorking = true;
  render();

  try {
    await playSentenceAudio(sentence, PREBUILT_AUDIO_SPEED, generatedAudio);
  } finally {
    isWorking = false;
    render();
  }
});

revealButton.addEventListener("click", () => {
  revealVisible = !revealVisible;
  render();
});

subscribeAudioState((snapshot) => {
  modelState = snapshot;
  if (!hasInitialized) return;
  render();
});

({ builtinSentences, userSentences } = await loadSentenceCollections());
chooseRandomSentence();
hasInitialized = true;
render();
