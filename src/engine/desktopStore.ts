// Desktop persistence bridge — real filesystem storage for the vault.
// When running inside Tauri, the vault is persisted to a JSON file in the
// per-user app data directory instead of (only) localStorage. Falls back
// gracefully to localStorage in a plain browser.
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

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

/** Create directory (and parents). */
export async function mkdirDir(path: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    await invoke('mkdir_dir', { path });
    return true;
  } catch (e) {
    console.warn('desktopStore: mkdir failed', e);
    return false;
  }
}

/** List file names in a directory (files only, sorted). */
export async function listDir(path: string): Promise<string[]> {
  if (!isDesktop()) return [];
  try {
    return await invoke<string[]>('list_dir', { path });
  } catch (e) {
    console.warn('desktopStore: list_dir failed', e);
    return [];
  }
}

/** Delete a file (ignores missing). */
export async function deleteFile(path: string): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    await invoke('delete_file', { path });
    return true;
  } catch (e) {
    console.warn('desktopStore: delete failed', e);
    return false;
  }
}

// ── Folder vault (.eml per capsule) ─────────────────────────────────────────

const VAULT_DIR = 'vault';
let cachedDir: string | null = null;

/** Resolve the vault directory (app data dir / vault) and create it. */
export async function resolveVaultDir(): Promise<string | null> {
  if (!isDesktop()) return null;
  if (cachedDir) return cachedDir;
  try {
    const dir = await invoke<string>('app_data_dir');
    const vaultDir = `${dir}/${VAULT_DIR}`;
    await invoke('mkdir_dir', { path: vaultDir });
    cachedDir = vaultDir;
    return vaultDir;
  } catch (e) {
    console.warn('desktopStore: cannot resolve vault dir', e);
    return null;
  }
}

/** Scan the vault folder: returns [{fileName, rawEml}] for every *.eml. */
export async function scanVaultFolder(): Promise<Array<{ fileName: string; rawEml: string }>> {
  const vaultDir = await resolveVaultDir();
  if (!vaultDir) return [];
  const files = (await listDir(vaultDir)).filter((f) => f.toLowerCase().endsWith('.eml'));
  const out: Array<{ fileName: string; rawEml: string }> = [];
  for (const f of files) {
    try {
      const rawEml = await invoke<string>('read_text_file', { path: `${vaultDir}/${f}` });
      out.push({ fileName: f, rawEml });
    } catch (e) {
      console.warn(`desktopStore: cannot read ${f}`, e);
    }
  }
  return out;
}

/** Sanitize a messageId/subject into a safe file name. */
export function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(/[<>]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || 'capsule';
}

/** Write one capsule as an .eml file into the vault folder. */
export async function writeCapsuleEml(messageId: string, rawEml: string): Promise<string | null> {
  const vaultDir = await resolveVaultDir();
  if (!vaultDir) return null;
  const fileName = `${sanitizeFileName(messageId)}.eml`;
  try {
    await invoke('write_text_file', { path: `${vaultDir}/${fileName}`, content: rawEml });
    return fileName;
  } catch (e) {
    console.warn('desktopStore: write capsule eml failed', e);
    return null;
  }
}

/** Remove a capsule's .eml file (if any matches). */
export async function removeCapsuleEml(fileName: string): Promise<boolean> {
  const vaultDir = await resolveVaultDir();
  if (!vaultDir || !fileName) return false;
  return deleteFile(`${vaultDir}/${fileName}`);
}

/** Single file system change reported by native vault watcher. */
export interface VaultFsChange {
  path: string;
  fileName: string;
  kind: 'modify' | 'remove';
}

/** Read a single .eml file directly from the vault directory. */
export async function readVaultFile(fileName: string): Promise<string | null> {
  const vaultDir = await resolveVaultDir();
  if (!vaultDir || !fileName) return null;
  return readTextFile(`${vaultDir}/${fileName}`);
}

/** Subscribe to live native file system changes in the vault folder. */
export async function subscribeVaultChanges(
  callback: (changes: VaultFsChange[]) => void
): Promise<() => void> {
  try {
    const unlisten: UnlistenFn = await listen<VaultFsChange[]>('vault:fs-change', (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch (e) {
    // Non-Tauri (plain browser) fallback
    return () => {};
  }
}

