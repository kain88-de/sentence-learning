import { playAudioUrl, playGeneratedAudio } from "./audio-playback.js";
import { PREBUILT_AUDIO_SPEED, loadBuiltinSentences, sortSentences } from "./data.js";
import { getUserSentences } from "./db.js";
import { generateSpeech } from "./model-tts.js";

export async function loadSentenceCollections() {
  let builtinSentences = [];

  try {
    builtinSentences = await loadBuiltinSentences();
  } catch (error) {
    console.error(error);
  }

  const userSentences = await getUserSentences();
  return { builtinSentences, userSentences };
}

export function allSentences(builtinSentences, userSentences) {
  return sortSentences([...builtinSentences, ...userSentences]);
}

export function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function cacheSizeText(generatedAudio) {
  let bytes = 0;
  for (const entry of generatedAudio.values()) bytes += entry.audio.byteLength;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function playSentenceAudio(sentence, speed, generatedAudio) {
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
