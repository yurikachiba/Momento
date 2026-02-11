import JSZip from 'jszip';
import { getAllPhotos, addPhoto, getAllAlbums, addAlbum } from './db';
import type { Photo, Album } from '../types/photo';
import { stripHtmlTags, sanitizeFileName } from './sanitize';

interface ExportMetadata {
  version: 2;
  exportedAt: number;
  albums: Album[];
  photos: Array<Omit<Photo, 'blob' | 'thumbnail'>>;
}

/**
 * Export all photos and albums as a .zip file and trigger download.
 */
export async function exportData(
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const photos = await getAllPhotos();
  const albums = await getAllAlbums();

  // Metadata (everything except blobs)
  const metadata: ExportMetadata = {
    version: 2,
    exportedAt: Date.now(),
    albums,
    photos: photos.map(({ blob: _b, thumbnail: _t, ...rest }) => rest),
  };
  zip.file('metadata.json', JSON.stringify(metadata));

  // Photo files
  const photosFolder = zip.folder('photos')!;
  const thumbsFolder = zip.folder('thumbs')!;

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    photosFolder.file(`${p.id}.webp`, p.blob);
    thumbsFolder.file(`${p.id}.webp`, p.thumbnail);
    onProgress?.(i + 1, photos.length);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `momento-backup-${date}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import photos and albums from a .zip file.
 * Returns the count of imported items.
 */
export async function importData(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<{ photosImported: number; albumsImported: number }> {
  const zip = await JSZip.loadAsync(file);

  const metaFile = zip.file('metadata.json');
  if (!metaFile) {
    throw new Error('このZIPファイルはMomentoのバックアップではありません');
  }

  const metadata = JSON.parse(await metaFile.async('text')) as ExportMetadata;

  // Import albums (skip duplicates by id) — sanitize imported names
  const existingAlbums = await getAllAlbums();
  const existingAlbumIds = new Set(existingAlbums.map((a) => a.id));
  let albumsImported = 0;

  for (const album of metadata.albums ?? []) {
    if (!existingAlbumIds.has(album.id)) {
      const sanitizedAlbum: Album = {
        ...album,
        name: stripHtmlTags(album.name).slice(0, 50),
        icon: stripHtmlTags(album.icon),
      };
      await addAlbum(sanitizedAlbum);
      albumsImported++;
    }
  }

  // Import photos (skip duplicates by id) — sanitize imported names
  const existingPhotos = await getAllPhotos();
  const existingPhotoIds = new Set(existingPhotos.map((p) => p.id));
  let photosImported = 0;
  const total = metadata.photos.length;

  for (let i = 0; i < metadata.photos.length; i++) {
    const photoMeta = { ...metadata.photos[i], name: sanitizeFileName(metadata.photos[i].name) };
    onProgress?.(i + 1, total);

    if (existingPhotoIds.has(photoMeta.id)) continue;

    const blobFile = zip.file(`photos/${photoMeta.id}.webp`);
    const thumbFile = zip.file(`thumbs/${photoMeta.id}.webp`);
    if (!blobFile || !thumbFile) continue;

    const blob = await blobFile.async('blob');
    const thumbnail = await thumbFile.async('blob');

    const photo: Photo = {
      ...photoMeta,
      albumIds: photoMeta.albumIds ?? [],
      blob,
      thumbnail,
    };
    await addPhoto(photo);
    photosImported++;
  }

  return { photosImported, albumsImported };
}
