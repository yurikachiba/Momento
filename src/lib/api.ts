import type { Photo, Album } from '../types/photo';

const API_BASE = '/api';

/**
 * レスポンスを安全にJSONとしてパースする。
 * HTMLエラーページなど非JSONレスポンスが返された場合にわかりやすいエラーを投げる。
 */
export async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `サーバーから予期しないレスポンスが返されました（${res.status} ${res.statusText}）`
    );
  }
}

function getToken(): string | null {
  return localStorage.getItem('momento-token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
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
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');
  return safeJson<Photo>(res);
}

export async function getPhotos(albumId?: string | null): Promise<Photo[]> {
  const params = albumId ? `?albumId=${albumId}` : '';
  const res = await fetch(`${API_BASE}/photos${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch photos');
  return safeJson<Photo[]>(res);
}

export async function updatePhotoMeta(
  id: string,
  meta: { name?: string; memo?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  if (!res.ok) throw new Error('Failed to update photo');
}

export async function deletePhotoApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete photo');
}

export async function getAlbums(): Promise<Album[]> {
  const res = await fetch(`${API_BASE}/albums`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch albums');
  return safeJson<Album[]>(res);
}

export async function createAlbum(name: string, icon: string): Promise<Album> {
  const res = await fetch(`${API_BASE}/albums`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon }),
  });
  if (!res.ok) throw new Error('Failed to create album');
  return safeJson<Album>(res);
}

export async function deleteAlbumApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/albums/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete album');
}

export async function addPhotoToAlbum(
  photoId: string,
  albumId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${photoId}/albums/${albumId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to add photo to album');
}

export async function removePhotoFromAlbum(
  photoId: string,
  albumId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/photos/${photoId}/albums/${albumId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to remove photo from album');
}

export async function getUsage(): Promise<{
  count: number;
  totalSize: number;
  limit: number;
}> {
  const res = await fetch(`${API_BASE}/usage`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch usage');
  return safeJson<{ count: number; totalSize: number; limit: number }>(res);
}
