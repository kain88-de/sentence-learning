const DB_NAME = "german-dictation-app";
const DB_VERSION = 2;
const USER_SENTENCE_STORE = "user-sentences";
const USER_AUDIO_STORE = "user-audio";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(USER_SENTENCE_STORE)) {
        const sentenceStore = db.createObjectStore(USER_SENTENCE_STORE, { keyPath: "id" });
        sentenceStore.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(USER_AUDIO_STORE)) {
        const audioStore = db.createObjectStore(USER_AUDIO_STORE, { keyPath: "key" });
        audioStore.createIndex("sentenceId", "sentenceId");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runRequest(storeName, mode, callback) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getUserSentences() {
  return runRequest(USER_SENTENCE_STORE, "readonly", (store) => store.getAll());
}

export async function addUserSentence(record) {
  await runRequest(USER_SENTENCE_STORE, "readwrite", (store) => store.add(record));
  return record;
}

export async function deleteUserSentence(id) {
  await runRequest(USER_SENTENCE_STORE, "readwrite", (store) => store.delete(id));
}

export async function getUserAudio(key) {
  return runRequest(USER_AUDIO_STORE, "readonly", (store) => store.get(key));
}

export async function putUserAudio(record) {
  await runRequest(USER_AUDIO_STORE, "readwrite", (store) => store.put(record));
  return record;
}

export async function deleteUserAudio(key) {
  await runRequest(USER_AUDIO_STORE, "readwrite", (store) => store.delete(key));
}

export async function getAllUserAudio() {
  return runRequest(USER_AUDIO_STORE, "readonly", (store) => store.getAll());
}
