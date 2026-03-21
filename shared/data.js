export const BUILTIN_SENTENCES = [
  {
    id: "builtin-1",
    text: "Guten Morgen. Heute ueben wir ein langsames Diktat auf Deutsch.",
    source: "builtin",
    theme: "Warm-up",
  },
  {
    id: "builtin-2",
    text: "Der Zug nach Muenchen kommt heute zehn Minuten spaeter an.",
    source: "builtin",
    theme: "Travel",
  },
  {
    id: "builtin-3",
    text: "Bitte legen Sie das blaue Notizbuch auf den grossen Holztisch.",
    source: "builtin",
    theme: "Objects",
  },
  {
    id: "builtin-4",
    text: "Am Samstag gehen wir mit unseren Freunden in den Stadtpark spazieren.",
    source: "builtin",
    theme: "Weekend",
  },
  {
    id: "builtin-5",
    text: "Meine Schwester kocht heute Abend eine heisse Kartoffelsuppe.",
    source: "builtin",
    theme: "Food",
  },
  {
    id: "builtin-6",
    text: "Um Viertel nach acht beginnt der Unterricht im zweiten Stock.",
    source: "builtin",
    theme: "Schedule",
  },
  {
    id: "builtin-7",
    text: "Wenn es morgen regnet, bleiben wir lieber zu Hause und lesen.",
    source: "builtin",
    theme: "Weather",
  },
  {
    id: "builtin-8",
    text: "Kannst du die Rechnung bitte noch einmal langsam vorlesen?",
    source: "builtin",
    theme: "Conversation",
  },
];

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
