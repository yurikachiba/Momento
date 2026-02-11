import { openDB, type IDBPDatabase } from 'idb';
import type { Photo, Category } from '../types/photo';

const DB_NAME = 'momento-photos';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('categoryId', 'categoryId');
        photoStore.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
    },
  });
  return dbInstance;
}

// --- Photos ---

export async function addPhoto(photo: Photo): Promise<void> {
  const db = await getDB();
  await db.put('photos', photo);
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const db = await getDB();
  return db.get('photos', id);
}

export async function getAllPhotos(): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPhotosByCategory(categoryId: string): Promise<Photo[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('photos', 'categoryId', categoryId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
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
