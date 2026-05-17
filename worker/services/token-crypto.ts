type EnvWithSecrets = {
  JWT_SECRET_KEY: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
};

function encoder() {
  return new TextEncoder();
}

async function importAesKey(env: EnvWithSecrets): Promise<CryptoKey> {
  const raw = env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? env.JWT_SECRET_KEY;
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Returns base64(iv || ciphertext) for storage in D1. */
export async function encryptSecret(plaintext: string, env: EnvWithSecrets): Promise<string> {
  const key = await importAesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptSecret(encoded: string, env: EnvWithSecrets): Promise<string> {
  const key = await importAesKey(env);
  const bin = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  if (bin.length < 13) throw new Error("Invalid ciphertext");
  const iv = bin.slice(0, 12);
  const data = bin.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(pt);
}
