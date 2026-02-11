import { openDB, type IDBPDatabase } from 'idb';
import type { Photo, Category, Album } from '../types/photo';

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

// --- Photos ---

export async function addPhoto(photo: Photo): Promise<void> {
  const db = await getDB();
  // Ensure albumIds always exists
  if (!photo.albumIds) photo.albumIds = [];
  await db.put('photos', photo);
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const db = await getDB();
  const photo = await db.get('photos', id);
  if (photo && !photo.albumIds) photo.albumIds = [];
  return photo;
}

export async function getAllPhotos(): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  for (const p of all) {
    if (!p.albumIds) p.albumIds = [];
  }
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPhotosByCategory(categoryId: string): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('photos', 'categoryId', categoryId);
  for (const p of all) {
    if (!p.albumIds) p.albumIds = [];
  }
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPhotosByAlbum(albumId: string): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  return all
    .filter((p) => p.albumIds?.includes(albumId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('photos', id);
}

// --- Categories ---

export async function addCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put('categories', category);
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB();
  const all = await db.getAll('categories');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  // Move photos in this category to "all"
  const photos = await getPhotosByCategory(id);
  const tx = db.transaction(['photos', 'categories'], 'readwrite');
  for (const photo of photos) {
    await tx.objectStore('photos').put({ ...photo, categoryId: 'all' });
  }
  await tx.objectStore('categories').delete(id);
  await tx.done;
}

export async function updateCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put('categories', category);
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
  // Remove album id from all photos
  const photos = await getPhotosByAlbum(id);
  const tx = db.transaction(['photos', 'albums'], 'readwrite');
  for (const photo of photos) {
    await tx.objectStore('photos').put({
      ...photo,
      albumIds: photo.albumIds.filter((aid: string) => aid !== id),
    });
  }
  await tx.objectStore('albums').delete(id);
  await tx.done;
}
