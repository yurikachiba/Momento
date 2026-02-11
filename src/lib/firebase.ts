import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const STORAGE_KEY = 'momento-firebase-config';

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;

export function getSavedConfig(): FirebaseConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConfig(config: FirebaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // Reset instances so next call re-initializes
  app = null;
  storage = null;
}

export function clearConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  app = null;
  storage = null;
}

export function isCloudConfigured(): boolean {
  return getSavedConfig() !== null;
}

function getFirebaseStorage(): FirebaseStorage {
  if (storage) return storage;
  const config = getSavedConfig();
  if (!config) throw new Error('Firebaseが設定されていません');
  app = initializeApp(config);
  storage = getStorage(app);
  return storage;
}

/**
 * Upload a photo blob to Firebase Storage.
 * Returns the cloud path.
 */
export async function uploadPhoto(photoId: string, blob: Blob): Promise<string> {
  const s = getFirebaseStorage();
  const path = `photos/${photoId}.webp`;
  const storageRef = ref(s, path);
  await uploadBytes(storageRef, blob);
  return path;
}

/**
 * Download a photo blob from Firebase Storage.
 */
export async function downloadPhoto(cloudPath: string): Promise<Blob> {
  const s = getFirebaseStorage();
  const storageRef = ref(s, cloudPath);
  const url = await getDownloadURL(storageRef);
  const response = await fetch(url);
  return response.blob();
}

/**
 * Delete a photo from Firebase Storage.
 */
export async function deleteCloudPhoto(cloudPath: string): Promise<void> {
  const s = getFirebaseStorage();
  const storageRef = ref(s, cloudPath);
  try {
    await deleteObject(storageRef);
  } catch {
    // Already deleted or not found – ignore
  }
}
