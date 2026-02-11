import { uploadPhoto, downloadPhoto, deleteCloudPhoto } from './firebase';
import { addPhoto, getPhoto, getAllPhotos } from './db';
import type { Photo } from '../types/photo';

// Tiny 1x1 transparent webp placeholder (~60 bytes)
const PLACEHOLDER_BLOB = new Blob([], { type: 'image/webp' });

/**
 * Upload a photo to cloud and free local full-res blob.
 * Keeps the thumbnail locally for fast grid browsing.
 */
export async function uploadToCloud(photoId: string): Promise<void> {
  const photo = await getPhoto(photoId);
  if (!photo) throw new Error('写真が見つかりません');
  if (photo.cloudPath) return; // Already uploaded

  const cloudPath = await uploadPhoto(photoId, photo.blob);
  await addPhoto({ ...photo, cloudPath, blob: PLACEHOLDER_BLOB });
}

/**
 * Download a full-res photo from cloud (on-demand viewing).
 * Returns the blob, but doesn't store it locally to save space.
 */
export async function fetchFromCloud(photo: Photo): Promise<Blob> {
  if (!photo.cloudPath) throw new Error('クラウドに保存されていません');
  return downloadPhoto(photo.cloudPath);
}

/**
 * Download from cloud AND restore to local storage.
 */
export async function restoreFromCloud(photoId: string): Promise<void> {
  const photo = await getPhoto(photoId);
  if (!photo || !photo.cloudPath) return;

  const blob = await downloadPhoto(photo.cloudPath);
  await addPhoto({ ...photo, blob });
}

/**
 * Delete cloud copy (keep local).
 */
export async function removeFromCloud(photoId: string): Promise<void> {
  const photo = await getPhoto(photoId);
  if (!photo?.cloudPath) return;

  await deleteCloudPhoto(photo.cloudPath);
  await addPhoto({ ...photo, cloudPath: undefined });
}

/**
 * Upload all local photos to cloud and free space.
 */
export async function uploadAllToCloud(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const photos = await getAllPhotos();
  const toUpload = photos.filter((p) => !p.cloudPath && p.blob.size > 0);
  let done = 0;

  for (const photo of toUpload) {
    const cloudPath = await uploadPhoto(photo.id, photo.blob);
    await addPhoto({ ...photo, cloudPath, blob: PLACEHOLDER_BLOB });
    done++;
    onProgress?.(done, toUpload.length);
  }

  return done;
}

/**
 * Check if a photo's full-res blob is available locally.
 */
export function isLocallyAvailable(photo: Photo): boolean {
  return photo.blob.size > 100; // Placeholder is tiny
}
