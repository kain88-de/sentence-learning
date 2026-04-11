import { loadBuiltinSentences, normalizeSentence, sortSentences } from "./builtin-sentences.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "./db.js";

const _encoder = new TextEncoder();
async function hashText(text) {
  const bytes = _encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

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

export async function createUserSentence(text) {
  const normalizedText = normalizeSentence(text);
  if (!normalizedText) {
    return null;
  }

  const audioKey = await hashText(normalizedText);
  const record = {
    id: crypto.randomUUID(),
    text: normalizedText,
    source: "user",
    createdAt: Date.now(),
    audioKey,
  };

  await addUserSentence(record);
  return record;
}

export async function removeUserSentence(id) {
  await deleteUserSentence(id);
}
