export const PREBUILT_AUDIO_SPEED = 0.55;

const BUILTIN_SENTENCES_FILE = new URL("../assets/data/builtin-sentences.json", import.meta.url);

function normalizeBuiltinSentenceEntries(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    text: normalizeSentence(entry.text),
    source: "builtin",
    audioSrc: new URL(entry.audioSrc, import.meta.url).href,
  }));
}

export async function loadBuiltinSentences() {
  const response = await fetch(BUILTIN_SENTENCES_FILE);
  if (!response.ok) {
    throw new Error(`Failed to load built-in sentences: ${response.status}`);
  }

  return normalizeBuiltinSentenceEntries(await response.json());
}

export function normalizeSentence(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function sortSentences(sentences) {
  return [...sentences].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "builtin" ? -1 : 1;
    }

    if (left.createdAt && right.createdAt) {
      return right.createdAt - left.createdAt;
    }

    return left.text.localeCompare(right.text, "de");
  });
}
