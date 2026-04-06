import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { env, pipeline } from "@huggingface/transformers";

import {
  PREBUILT_AUDIO_SPEED,
  loadBuiltinSentencesForBuild,
  loadBuiltinWordsForBuild,
} from "../shared/data.js";

const repoRoot = process.cwd();
const audioDir = path.join(repoRoot, "audio");
const cacheDir = path.join(repoRoot, ".cache");
const manifestPath = path.join(cacheDir, "prebuilt-audio-cache.json");
const modelCacheDir = path.join(cacheDir, "transformers");
const modelId = "Xenova/mms-tts-deu";

env.allowRemoteModels = true;
env.cacheDir = modelCacheDir;

function entryHash(entry) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: entry.id,
        text: entry.text,
        speed: PREBUILT_AUDIO_SPEED,
        modelId,
      }),
    )
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
const builtInSentences = await loadBuiltinSentencesForBuild(readFile);
const builtInWords = await loadBuiltinWordsForBuild(readFile);

console.log(`Preparing built-in audio at speed ${PREBUILT_AUDIO_SPEED} with model ${modelId}`);

const synthesizer = await pipeline("text-to-speech", modelId);

for (const entry of [...builtInSentences, ...builtInWords]) {
  const outputPath = path.join(audioDir, `${entry.id}.wav`);
  const hash = entryHash(entry);
  const cached = manifest[entry.id];

  if (cached?.hash === hash && (await fileExists(outputPath))) {
    nextManifest[entry.id] = cached;
    console.log(`skip ${entry.id}`);
    continue;
  }

  console.log(`generate ${entry.id}`);
  const output = await synthesizer(entry.text, { speed: PREBUILT_AUDIO_SPEED });
  const wav = encodeWav(output.audio, output.sampling_rate);
  await writeFile(outputPath, wav);

  nextManifest[entry.id] = {
    hash,
    file: `audio/${entry.id}.wav`,
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
