const encoder = new TextEncoder();

export async function hashText(text) {
  const bytes = encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = [...new Uint8Array(digest)];
  return hashArray.map((value) => value.toString(16).padStart(2, "0")).join("");
}
