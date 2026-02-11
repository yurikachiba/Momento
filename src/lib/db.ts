import { openDB, type IDBPDatabase } from 'idb';
import type { Photo, Album } from '../types/photo';
import { getKey, encryptBlob, decryptToBlob } from './crypto';
import { reprocessBlob } from './image';

const DB_NAME = 'momento-photos';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('categoryId', 'categoryId');
        photoStore.createIndex('createdAt', 'createdAt');
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('albums', { keyPath: 'id' });
      }
    },
  });
  return dbInstance;
}

// --- Encryption helpers ---

async function encryptPhoto(photo: Photo): Promise<Record<string, unknown>> {
  const encBlob = await encryptBlob(photo.blob);
  const encThumb = await encryptBlob(photo.thumbnail);
  return { ...photo, blob: encBlob, thumbnail: encThumb, encrypted: true };
}

async function decryptPhotoRecord(record: Record<string, unknown>): Promise<Photo> {
  if (record.encrypted && getKey()) {
    const blob = await decryptToBlob(record.blob as ArrayBuffer, 'image/webp');
    const thumbnail = await decryptToBlob(record.thumbnail as ArrayBuffer, 'image/webp');
    const { encrypted: _, ...rest } = record;
    return { ...rest, blob, thumbnail } as Photo;
  }
  return record as unknown as Photo;
}

// --- Photos ---

export async function addPhoto(photo: Photo): Promise<void> {
  const db = await getDB();
  if (!photo.albumIds) photo.albumIds = [];
  if (getKey()) {
    await db.put('photos', await encryptPhoto(photo));
  } else {
    await db.put('photos', photo);
  }
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const db = await getDB();
  const record = await db.get('photos', id);
  if (!record) return undefined;
  if (!record.albumIds) record.albumIds = [];
  return decryptPhotoRecord(record);
}

export async function getAllPhotos(): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  const photos: Photo[] = [];
  for (const r of all) {
    if (!r.albumIds) r.albumIds = [];
    photos.push(await decryptPhotoRecord(r));
  }
  return photos.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPhotosByAlbum(albumId: string): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  const filtered = all.filter((p) => p.albumIds?.includes(albumId));
  const photos: Photo[] = [];
  for (const r of filtered) {
    photos.push(await decryptPhotoRecord(r));
  }
  return photos.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('photos', id);
}

/**
 * Encrypt all existing unencrypted photos. Used when setting up encryption.
 */
export async function encryptAllPhotos(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('photos');
  const unencrypted = all.filter((r) => !r.encrypted);
  let done = 0;
  for (const record of unencrypted) {
    if (!record.albumIds) record.albumIds = [];
    // record is already a plain Photo (unencrypted Blob)
    const encrypted = await encryptPhoto(record as unknown as Photo);
    await db.put('photos', encrypted);
    done++;
    onProgress?.(done, unencrypted.length);
  }
  return done;
}

/**
 * Decrypt all encrypted photos. Used when removing encryption.
 */
export async function decryptAllPhotos(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('photos');
  const encrypted = all.filter((r) => r.encrypted);
  let done = 0;
  for (const record of encrypted) {
    const photo = await decryptPhotoRecord(record);
    await db.put('photos', photo);
    done++;
    onProgress?.(done, encrypted.length);
  }
  return done;
}

// --- Albums ---

export async function addAlbum(album: Album): Promise<void> {
  const db = await getDB();
  await db.put('albums', album);
}

export async function getAllAlbums(): Promise<Album[]> {
  const db = await getDB();
  const all = await db.getAll('albums');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteAlbum(id: string): Promise<void> {
  const db = await getDB();
  const photos = await getPhotosByAlbum(id);
  const tx = db.transaction(['photos', 'albums'], 'readwrite');
  for (const photo of photos) {
    const updated = { ...photo, albumIds: photo.albumIds.filter((aid: string) => aid !== id) };
    if (getKey()) {
      await tx.objectStore('photos').put(await encryptPhoto(updated));
    } else {
      await tx.objectStore('photos').put(updated);
    }
  }
  await tx.objectStore('albums').delete(id);
  await tx.done;
}

/**
 * Re-compress all photos using the current storage mode settings.
 * This re-encodes each photo's blob and thumbnail to reduce storage.
 */
export async function recompressAllPhotos(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('photos');
  const total = all.length;
  let done = 0;

  for (const record of all) {
    if (!record.albumIds) record.albumIds = [];
    // Decrypt if needed to get the raw blob
    const photo = record.encrypted && getKey()
      ? await decryptPhotoRecord(record)
      : record as unknown as Photo;

    const { blob, thumbnail, width, height } = await reprocessBlob(photo.blob);
    const updated: Photo = { ...photo, blob, thumbnail, width, height };

    if (getKey()) {
      await db.put('photos', await encryptPhoto(updated));
    } else {
      await db.put('photos', updated);
    }
    done++;
    onProgress?.(done, total);
  }
  return done;
}

/**
 * Estimate total storage used by photos in IndexedDB.
 */
export async function estimateStorageUsage(): Promise<{ totalBytes: number; photoCount: number }> {
  const db = await getDB();
  const all = await db.getAll('photos');
  let totalBytes = 0;
  for (const record of all) {
    // For encrypted records, blob/thumbnail are ArrayBuffers
    if (record.encrypted) {
      if (record.blob instanceof ArrayBuffer) totalBytes += record.blob.byteLength;
      if (record.thumbnail instanceof ArrayBuffer) totalBytes += record.thumbnail.byteLength;
    } else {
      if (record.blob instanceof Blob) totalBytes += record.blob.size;
      if (record.thumbnail instanceof Blob) totalBytes += record.thumbnail.size;
    }
  }
  return { totalBytes, photoCount: all.length };
}
