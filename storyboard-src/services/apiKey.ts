// The Gemini API key is supplied by each user and kept in localStorage only.
// It must never be baked into the bundle — this site is public static hosting.
const STORAGE_KEY = "we-tools-gemini-key";

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}
