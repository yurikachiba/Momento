import type { Photo, Album } from '../types/photo';

const API_BASE = '/api';

function getUserId(): string {
  let id = localStorage.getItem('momento-user-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('momento-user-id', id);
  }
  return id;
}

function headers(): Record<string, string> {
  return { 'X-User-Id': getUserId() };
}

export async function uploadPhoto(
  file: File,
  albumId: string | null,
  quality: string = 'auto',
  name?: string
): Promise<Photo> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('quality', quality);
  if (albumId) formData.append('albumId', albumId);
  if (name) formData.append('name', name);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': getUserId() },
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getPhotos(albumId?: string | null): Promise<Photo[]> {
  const params = albumId ? `?albumId=${albumId}` : '';
  const res = await fetch(`${API_BASE}/photos${params}`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch photos');
  return res.json();
}

export async function updatePhotoMeta(
  id: string,
  meta: { name?: string; memo?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  if (!res.ok) throw new Error('Failed to update photo');
}

export async function deletePhotoApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to delete photo');
}

export async function getAlbums(): Promise<Album[]> {
  const res = await fetch(`${API_BASE}/albums`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch albums');
  return res.json();
}

export async function createAlbum(name: string, icon: string): Promise<Album> {
  const res = await fetch(`${API_BASE}/albums`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon }),
  });
  if (!res.ok) throw new Error('Failed to create album');
  return res.json();
}

export async function deleteAlbumApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/albums/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to delete album');
}

export async function addPhotoToAlbum(
  photoId: string,
  albumId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${photoId}/albums/${albumId}`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to add photo to album');
}

export async function removePhotoFromAlbum(
  photoId: string,
  albumId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${photoId}/albums/${albumId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to remove photo from album');
}

export async function getUsage(): Promise<{
  count: number;
  totalSize: number;
  limit: number;
}> {
  const res = await fetch(`${API_BASE}/usage`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch usage');
  return res.json();
}

export function getLocalUserId(): string {
  return getUserId();
}

export function resetLocalUserId(): void {
  localStorage.removeItem('momento-user-id');
}
