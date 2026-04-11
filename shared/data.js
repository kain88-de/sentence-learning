export const PREBUILT_AUDIO_SPEED = 0.55;

const BUILTIN_SENTENCES_FILE = new URL("../data/builtin-sentences.txt", import.meta.url);

function audioUrl(fileName) {
  return new URL(`../audio/${fileName}`, import.meta.url).href;
}

function parseBuiltinLines(content, { idPrefix, filePrefix }) {
  return content
    .split(/\r?\n/)
    .map((line) => normalizeSentence(line))
    .filter((line) => line && !line.startsWith("#"))
    .map((text, index) => ({
      id: `${idPrefix}-${index + 1}`,
      text,
      source: "builtin",
      audioSrc: audioUrl(`${filePrefix}-${index + 1}.wav`),
    }));
}

function parseBuiltinSentenceLines(content) {
  return parseBuiltinLines(content, { idPrefix: "builtin", filePrefix: "builtin" });
}

export async function loadBuiltinSentences() {
  const response = await fetch(BUILTIN_SENTENCES_FILE);
  if (!response.ok) {
    throw new Error(`Failed to load built-in sentences: ${response.status}`);
  }

  return parseBuiltinSentenceLines(await response.text());
}

export async function loadBuiltinSentencesForBuild(readFile) {
  const content = await readFile(BUILTIN_SENTENCES_FILE, "utf8");
  return parseBuiltinSentenceLines(content);
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
