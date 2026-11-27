// Supabase session storage in the iOS Keychain (expo-secure-store).
// Sessions can exceed SecureStore's recommended 2 KB per value, so values are split into chunks.
// The web preview has no Keychain and falls back to localStorage (dev only).
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHUNK = 1800;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
// SecureStore keys allow only [A-Za-z0-9._-]
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

async function getItem(key: string): Promise<string | null> {
  const k = safe(key);
  const count = await SecureStore.getItemAsync(`${k}.n`, opts);
  if (count == null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(count); i++) {
    const part = await SecureStore.getItemAsync(`${k}.${i}`, opts);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function removeItem(key: string): Promise<void> {
  const k = safe(key);
  const count = Number((await SecureStore.getItemAsync(`${k}.n`, opts)) ?? 0);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
  await SecureStore.deleteItemAsync(`${k}.n`, opts);
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key);
  const k = safe(key);
  const n = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
  await SecureStore.setItemAsync(`${k}.n`, String(n), opts);
}

const webStorage = {
  getItem: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
  setItem: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
  removeItem: async (k: string) => globalThis.localStorage?.removeItem(k),
};

export const sessionStorage = Platform.OS === "web" ? webStorage : { getItem, setItem, removeItem };
