import { loadBuiltinSentences, normalizeSentence, sortSentences } from "./builtin-sentences.js";
import { addUserSentence, deleteUserSentence, getUserSentences } from "./db.js";
import { hashText } from "./hash.js";

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
