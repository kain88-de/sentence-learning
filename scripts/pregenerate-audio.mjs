import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { env, pipeline } from "@huggingface/transformers";

import { BUILTIN_SENTENCES, PREBUILT_AUDIO_SPEED } from "../shared/data.js";

const repoRoot = process.cwd();
const audioDir = path.join(repoRoot, "audio");
const cacheDir = path.join(repoRoot, ".cache");
const manifestPath = path.join(cacheDir, "prebuilt-audio-cache.json");
const modelCacheDir = path.join(cacheDir, "transformers");
const modelId = "Xenova/mms-tts-deu";

env.allowRemoteModels = true;
env.cacheDir = modelCacheDir;

function sentenceHash(sentence) {
  return createHash("sha256")
    .update(JSON.stringify({ id: sentence.id, text: sentence.text, speed: PREBUILT_AUDIO_SPEED, modelId }))
    .digest("hex");
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

async function loadManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return {};
  }
}

async function fileExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

await mkdir(audioDir, { recursive: true });
await mkdir(cacheDir, { recursive: true });
await mkdir(modelCacheDir, { recursive: true });

const manifest = await loadManifest();
const nextManifest = {};

console.log(`Preparing built-in audio at speed ${PREBUILT_AUDIO_SPEED} with model ${modelId}`);

const synthesizer = await pipeline("text-to-speech", modelId);

for (const sentence of BUILTIN_SENTENCES) {
  const outputPath = path.join(audioDir, `${sentence.id}.wav`);
  const hash = sentenceHash(sentence);
  const cached = manifest[sentence.id];

  if (cached?.hash === hash && (await fileExists(outputPath))) {
    nextManifest[sentence.id] = cached;
    console.log(`skip ${sentence.id}`);
    continue;
  }

  console.log(`generate ${sentence.id}`);
  const output = await synthesizer(sentence.text, { speed: PREBUILT_AUDIO_SPEED });
  const wav = encodeWav(output.audio, output.sampling_rate);
  await writeFile(outputPath, wav);

  nextManifest[sentence.id] = {
    hash,
    file: `audio/${sentence.id}.wav`,
    bytes: wav.byteLength,
    speed: PREBUILT_AUDIO_SPEED,
    modelId,
  };
}

for (const id of Object.keys(manifest)) {
  if (!nextManifest[id]) {
    await rm(path.join(audioDir, `${id}.wav`), { force: true });
  }
}

await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
console.log("Built-in audio generation complete.");
