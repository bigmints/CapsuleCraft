// Desktop persistence bridge — real filesystem storage for the vault.
// When running inside Tauri, the vault is persisted to a JSON file in the
// per-user app data directory instead of (only) localStorage. Falls back
// gracefully to localStorage in a plain browser.
import { invoke } from '@tauri-apps/api/core';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

/** True when running inside the Tauri desktop shell. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

const VAULT_FILE = 'vault.json';
let cachedPath: string | null = null;

/** Resolve the vault file path (app data dir + vault.json). */
export async function resolveVaultPath(): Promise<string | null> {
  if (!isDesktop()) return null;
  if (cachedPath) return cachedPath;
  try {
    const dir = await invoke<string>('app_data_dir');
    cachedPath = `${dir}/${VAULT_FILE}`;
    return cachedPath;
  } catch (e) {
    console.warn('desktopStore: cannot resolve app data dir', e);
    return null;
  }
}

/** Load vault JSON from disk. Returns null if unavailable. */
export async function loadVaultFromDisk<T>(): Promise<T | null> {
  const path = await resolveVaultPath();
  if (!path) return null;
  try {
    const content = await invoke<string>('read_text_file', { path });
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as T) : null;
  } catch (e) {
    return null; // no file yet / parse error — caller falls back to seed
  }
}

/** Persist vault JSON to disk (fire-and-forget; localStorage is also kept). */
export async function saveVaultToDisk(data: unknown): Promise<boolean> {
  const path = await resolveVaultPath();
  if (!path) return false;
  try {
    await invoke('write_text_file', {
      path,
      content: JSON.stringify(data, null, 2),
    });
    return true;
  } catch (e) {
    console.warn('desktopStore: disk save failed', e);
    return false;
  }
}

/**
 * Pick a destination path via native Save-As dialog.
 * Returns chosen absolute path or null when cancelled.
 */
export async function pickSavePath(defaultName: string): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return await invoke<string | null>('pick_save_path', { defaultName });
  } catch (e) {
    console.warn('desktopStore: save dialog failed', e);
    return null;
  }
}

/**
 * Pick a file via native Open dialog (optional extension filter, e.g. ".eml").
 */
export async function pickOpenPath(filterExt?: string): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return await invoke<string | null>('pick_open_path', { filterExt });
  } catch (e) {
    console.warn('desktopStore: open dialog failed', e);
    return null;
  }
}

/** Read an arbitrary text file from disk (for .eml import). */
export async function readTextFile(path: string): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return await invoke<string>('read_text_file', { path });
  } catch (e) {
    console.warn('desktopStore: read failed', e);
    return null;
  }
}

/** Write an arbitrary text file to disk (for .eml export). */
export async function writeTextFile(path: string, content: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    await invoke('write_text_file', { path, content });
    return true;
  } catch (e) {
    console.warn('desktopStore: write failed', e);
    return false;
  }
}

/** Check if a path exists on disk. */
export async function pathExists(path: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    return await invoke<boolean>('path_exists', { path });
  } catch {
    return false;
  }
}
