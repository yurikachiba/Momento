import { createBackupBlob } from './sync';
import { markBackupDone } from './storage';

/**
 * Auto-backup module using the File System Access API.
 *
 * When the user selects a local folder, the app writes a backup ZIP there
 * automatically after data changes. Because the file lives on disk (not in
 * the browser), it survives even when the user clears browsing data.
 *
 * The directory handle is persisted in a dedicated IndexedDB store so it
 * survives across page reloads (but not across data clears — in that case
 * the user simply re-selects the folder and restores from the ZIP).
 */

const DB_NAME = 'momento-autobackup';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'backup-dir';

// Minimum interval between auto-backups (ms)
const MIN_INTERVAL_MS = 30_000; // 30 seconds

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastBackupTime = 0;

// ──────────────────────────────────────────────
// Feature detection
// ──────────────────────────────────────────────

export function isFileSystemAccessSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

// ──────────────────────────────────────────────
// Handle storage (separate IndexedDB database so it doesn't interfere
// with the main DB and can be version-upgraded independently)
// ──────────────────────────────────────────────

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function removeDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────
// Check if auto-backup is configured
// ──────────────────────────────────────────────

export async function isAutoBackupEnabled(): Promise<boolean> {
  const handle = await getDirectoryHandle();
  return handle !== null;
}

// ──────────────────────────────────────────────
// Setup: show directory picker and store handle
// ──────────────────────────────────────────────

export async function setupAutoBackup(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  try {
    const handle = await window.showDirectoryPicker({
      id: 'momento-backup',
      mode: 'readwrite',
      startIn: 'downloads',
    });
    await saveDirectoryHandle(handle);
    return true;
  } catch {
    // User cancelled the picker
    return false;
  }
}

// ──────────────────────────────────────────────
// Disable auto-backup
// ──────────────────────────────────────────────

export async function disableAutoBackup(): Promise<void> {
  cancelScheduledBackup();
  await removeDirectoryHandle();
}

// ──────────────────────────────────────────────
// Verify permission on the stored handle
// ──────────────────────────────────────────────

async function verifyPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

// ──────────────────────────────────────────────
// Perform auto-backup: write ZIP to the folder
// ──────────────────────────────────────────────

export async function performAutoBackup(
  onStatus?: (msg: string) => void,
): Promise<boolean> {
  const handle = await getDirectoryHandle();
  if (!handle) return false;

  try {
    if (!(await verifyPermission(handle))) {
      onStatus?.('バックアップフォルダへのアクセス権がありません');
      return false;
    }

    onStatus?.('自動バックアップ中...');

    const blob = await createBackupBlob();
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `momento-backup-${date}.zip`;

    // Write the file (overwrites same-day backups)
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    markBackupDone();
    lastBackupTime = Date.now();
    onStatus?.('自動バックアップ完了');
    return true;
  } catch (e) {
    console.error('Auto-backup failed:', e);
    onStatus?.('自動バックアップに失敗しました');
    return false;
  }
}

// ──────────────────────────────────────────────
// Schedule a debounced auto-backup
// ──────────────────────────────────────────────

export function cancelScheduledBackup(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

/**
 * Schedule an auto-backup after a short delay. Multiple calls within
 * the delay window are coalesced. A minimum interval between actual
 * backups prevents excessive disk writes.
 */
export function scheduleAutoBackup(
  onStatus?: (msg: string) => void,
): void {
  cancelScheduledBackup();

  const elapsed = Date.now() - lastBackupTime;
  const delay = Math.max(5_000, MIN_INTERVAL_MS - elapsed);

  pendingTimer = setTimeout(async () => {
    pendingTimer = null;
    const enabled = await isAutoBackupEnabled();
    if (enabled) {
      await performAutoBackup(onStatus);
    }
  }, delay);
}
