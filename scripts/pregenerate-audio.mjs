import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { env, pipeline } from "@huggingface/transformers";

import { PREBUILT_AUDIO_SPEED, normalizeSentence } from "../site/lib/builtin-sentences.js";

const repoRoot = process.cwd();
const sentencesPath = path.join(repoRoot, "sentences.txt");
const builtInSentencesPath = path.join(repoRoot, "site/assets/data/builtin-sentences.json");
const audioDir = path.join(repoRoot, "site/assets/audio");
const modelId = "Xenova/mms-tts-deu";

env.allowRemoteModels = true;

function parseSentenceLines(content) {
  return content
    .split(/\r?\n/)
    .map((line) => normalizeSentence(line))
    .filter((line) => line && !line.startsWith("#"))
    .map((text, index) => ({
      id: `builtin-${index + 1}`,
      text,
      audioSrc: `../assets/audio/builtin-${index + 1}.wav`,
    }));
}

function outputFileNameFor(entry) {
  return path.basename(entry.audioSrc);
}

function encodeWav(float32Audio, sampleRate) {
  const channelCount = 1;
  const bytesPerSample = 2;
  const dataSize = float32Audio.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of float32Audio) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return Buffer.from(buffer);
}

await mkdir(audioDir, { recursive: true });

const sentenceSource = await readFile(sentencesPath, "utf8");
const builtInSentences = parseSentenceLines(sentenceSource);
const builtInEntries = [...builtInSentences];
const expectedFileNames = new Set(builtInEntries.map(outputFileNameFor));

await writeFile(builtInSentencesPath, `${JSON.stringify(builtInEntries, null, 2)}\n`);

console.log(`Preparing built-in audio at speed ${PREBUILT_AUDIO_SPEED} with model ${modelId}`);

const synthesizer = await pipeline("text-to-speech", modelId);

for (const entry of builtInEntries) {
  const outputFileName = outputFileNameFor(entry);
  const outputPath = path.join(audioDir, outputFileName);

  console.log(`generate ${entry.id}`);
  const output = await synthesizer(entry.text, { speed: PREBUILT_AUDIO_SPEED });
  const wav = encodeWav(output.audio, output.sampling_rate);
  await writeFile(outputPath, wav);
}

for (const fileName of await readdir(audioDir)) {
  const isBuiltInAudio =
    /^builtin(?:-word)?-\d+\.wav$/u.test(fileName);

  if (isBuiltInAudio && !expectedFileNames.has(fileName)) {
    await rm(path.join(audioDir, fileName), { force: true });
  }
}

console.log("Built-in audio generation complete.");
