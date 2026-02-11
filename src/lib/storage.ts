const LS_LAST_BACKUP = 'momento-last-backup';
const REMINDER_DAYS = 7;

/**
 * Request persistent storage so the browser won't auto-evict IndexedDB data.
 * Returns true if persistence was granted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

/**
 * Check if persistent storage is currently granted.
 */
export async function isPersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  return navigator.storage.persisted();
}

/**
 * Record that a backup was just made (called after export).
 */
export function markBackupDone(): void {
  localStorage.setItem(LS_LAST_BACKUP, new Date().toISOString());
}

/**
 * Get the last backup timestamp, or null if never backed up.
 */
export function getLastBackupTime(): string | null {
  return localStorage.getItem(LS_LAST_BACKUP);
}

/**
 * Check if a backup reminder should be shown.
 * Returns true if never backed up, or last backup was more than REMINDER_DAYS ago.
 */
export function shouldShowBackupReminder(photoCount: number): boolean {
  if (photoCount === 0) return false;
  const last = localStorage.getItem(LS_LAST_BACKUP);
  if (!last) return true;
  const elapsed = Date.now() - new Date(last).getTime();
  return elapsed > REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Dismiss the backup reminder for now (snooze for REMINDER_DAYS).
 */
export function snoozeBackupReminder(): void {
  localStorage.setItem(LS_LAST_BACKUP, new Date().toISOString());
}

/**
 * Format the last backup time as a relative or absolute string.
 */
export function formatLastBackup(): string {
  const last = localStorage.getItem(LS_LAST_BACKUP);
  if (!last) return 'まだバックアップしていません';
  const date = new Date(last);
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return '今日';
  if (days === 1) return '昨日';
  if (days < 30) return `${days}日前`;
  return date.toLocaleDateString('ja-JP');
}
