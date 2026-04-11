import { playAudioUrl, playGeneratedAudio } from "./audio-playback.js";
import { generateSpeech } from "./model-tts.js";
import {
  getUserAudioRecord,
  listUserAudioRecords,
  removeUserAudioRecord,
  saveUserAudioRecord,
} from "./user-audio.js";

export function audioBytesText(records) {
  let bytes = 0;
  for (const record of records) {
    bytes += record.audio.byteLength;
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function getUserAudioUsageText() {
  const records = await listUserAudioRecords();
  return audioBytesText(records);
}

export async function ensureUserSentenceAudio(sentence) {
  const existing = await getUserAudioRecord(sentence.audioKey);

  if (existing) {
    if (existing.sentenceId !== sentence.id || existing.text !== sentence.text) {
      console.warn("Audio hash collision detected.", {
        audioKey: sentence.audioKey,
        storedSentenceId: existing.sentenceId,
        requestedSentenceId: sentence.id,
        storedText: existing.text,
        requestedText: sentence.text,
      });
      throw new Error("Audio hash collision detected.");
    }

    return existing;
  }

  const generated = await generateSpeech(sentence.text);
  const record = {
    key: sentence.audioKey,
    sentenceId: sentence.id,
    text: sentence.text,
    audio: generated.audio,
    samplingRate: generated.sampling_rate,
    createdAt: Date.now(),
  };

  await saveUserAudioRecord(record);
  return record;
}

export async function playSentence(sentence) {
  if (sentence.source === "builtin") {
    await playAudioUrl(sentence.audioSrc);
    return;
  }

  const record = await getUserAudioRecord(sentence.audioKey);
  if (!record) {
    throw new Error("Stored audio for this sentence is missing.");
  }

  if (record.text !== sentence.text) {
    console.warn("Audio hash collision detected.", {
      audioKey: sentence.audioKey,
      storedSentenceId: record.sentenceId,
      requestedSentenceId: sentence.id,
      storedText: record.text,
      requestedText: sentence.text,
    });
    throw new Error("Audio hash collision detected.");
  }

  await playGeneratedAudio({
    audio: record.audio,
    sampling_rate: record.samplingRate,
  });
}

export async function deleteSentenceAudio(sentence) {
  if (sentence.source !== "user" || !sentence.audioKey) {
    return;
  }

  await removeUserAudioRecord(sentence.audioKey);
}
