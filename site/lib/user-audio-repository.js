import { deleteUserAudio, getAllUserAudio, getUserAudio, putUserAudio } from "./db.js";

export async function getUserAudioRecord(audioKey) {
  return getUserAudio(audioKey);
}

export async function saveUserAudioRecord(record) {
  return putUserAudio(record);
}

export async function removeUserAudioRecord(audioKey) {
  await deleteUserAudio(audioKey);
}

export async function listUserAudioRecords() {
  return getAllUserAudio();
}
