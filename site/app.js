import { pausePlayback, resumePlayback } from "./lib/audio-playback.js";
import { getPlaybackSnapshot, subscribePlaybackState } from "./lib/playback-state.js";
import { playSentence } from "./lib/sentence-playback.js";
import { allSentences, loadSentenceCollections } from "./lib/sentences.js";

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
let playbackState = getPlaybackSnapshot();
let hasInitialized = false;

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
  const playLabel = playbackState.isPaused || playbackState.isPlaying ? "Pausieren" : "Abspielen";

  playButton.disabled = !sentence || isWorking;
  randomButton.disabled = !sentence || isWorking;
  revealButton.disabled = !sentence;
  playButton.querySelector(".button-icon").textContent =
    playbackState.isPaused || playbackState.isPlaying ? "❚❚" : "▶";
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

  if (playbackState.isPaused) {
    await resumePlayback();
    render();
    return;
  }

  if (playbackState.isPlaying) {
    await pausePlayback();
    render();
    return;
  }

  isWorking = true;
  render();

  try {
    await playSentence(sentence);
  } catch (error) {
    console.error(error);
  } finally {
    isWorking = false;
    render();
  }
});

revealButton.addEventListener("click", () => {
  revealVisible = !revealVisible;
  render();
});

subscribePlaybackState((snapshot) => {
  playbackState = snapshot;
  if (!hasInitialized) return;
  render();
});

({ builtinSentences, userSentences } = await loadSentenceCollections());
chooseRandomSentence();
hasInitialized = true;
render();
