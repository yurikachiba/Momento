import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import PhotoGrid from './components/PhotoGrid';
import PhotoViewer from './components/PhotoViewer';
import PhotoPicker from './components/PhotoPicker';
import CategoryBar from './components/CategoryBar';
import AddPhotoButton from './components/AddPhotoButton';
import SettingsMenu from './components/SettingsMenu';
import {
  getAllPhotos,
  getPhotosByAlbum,
  addPhoto,
  deletePhoto,
  getPhoto,
  getAllAlbums,
  addAlbum,
  deleteAlbum,
} from './lib/db';
import { processImage } from './lib/image';
import { sanitizeFileName } from './lib/sanitize';
import type { Photo, Album } from './types/photo';

function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    done: number;
    failed: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('momento-dark') === 'true';
  });

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('momento-dark', String(darkMode));
  }, [darkMode]);

  // Load albums
  const loadAlbums = useCallback(async () => {
    const albs = await getAllAlbums();
    setAlbums(albs);
  }, []);

  // Load photos
  const loadPhotos = useCallback(async () => {
    let data: Photo[];
    if (activeAlbumId) {
      data = await getPhotosByAlbum(activeAlbumId);
    } else {
      data = await getAllPhotos();
    }
    setPhotos(data);
  }, [activeAlbumId]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Select all photos (clears album selection)
  const handleSelectAll = useCallback(() => {
    setActiveAlbumId(null);
  }, []);

  // Select an album
  const handleSelectAlbum = useCallback((id: string) => {
    setActiveAlbumId(id);
  }, []);

  // Add photos from file input — parallel processing with progress
  const handleAddFiles = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);
      const total = fileArray.length;
      if (total === 0) return;

      setUploadProgress({ total, done: 0, failed: 0 });

      const CONCURRENCY = 3;
      let done = 0;
      let failed = 0;
      let cursor = 0;

      const processOne = async () => {
        while (cursor < fileArray.length) {
          const idx = cursor++;
          const file = fileArray[idx];
          try {
            const { blob, thumbnail, width, height } = await processImage(file);
            const photo: Photo = {
              id: crypto.randomUUID(),
              blob,
              thumbnail,
              name: sanitizeFileName(file.name.replace(/\.[^.]+$/, '')),
              albumIds: activeAlbumId ? [activeAlbumId] : [],
              createdAt: Date.now(),
              width,
              height,
            };
            await addPhoto(photo);
          } catch {
            failed++;
          }
          done++;
          setUploadProgress({ total, done, failed });
        }
      };

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, total) },
        () => processOne()
      );
      await Promise.all(workers);
      await loadPhotos();

      // Keep the progress visible briefly so user sees completion
      setTimeout(() => setUploadProgress(null), 800);
    },
    [activeAlbumId, loadPhotos]
  );

  // Select a photo by finding its index
  const handleSelectPhoto = useCallback(
    (photo: Photo) => {
      const idx = photos.findIndex((p) => p.id === photo.id);
      if (idx !== -1) setSelectedPhotoIndex(idx);
    },
    [photos]
  );

  // Delete a photo
  const handleDelete = useCallback(
    async (id: string) => {
      await deletePhoto(id);
      setSelectedPhotoIndex(null);
      await loadPhotos();
    },
    [loadPhotos]
  );

  // Toggle album membership for a photo
  const handleToggleAlbum = useCallback(
    async (photoId: string, albumId: string) => {
      const photo = await getPhoto(photoId);
      if (!photo) return;
      const albumIds = photo.albumIds.includes(albumId)
        ? photo.albumIds.filter((id) => id !== albumId)
        : [...photo.albumIds, albumId];
      const updated = { ...photo, albumIds };
      await addPhoto(updated);
      // Refresh the current viewer photo data
      if (selectedPhotoIndex !== null && photos[selectedPhotoIndex]?.id === photoId) {
        // Photo will be refreshed by loadPhotos
      }
      await loadPhotos();
    },
    [loadPhotos, selectedPhotoIndex, photos]
  );

  // Open photo picker for current album
  const handleOpenPicker = useCallback(async () => {
    const all = await getAllPhotos();
    setAllPhotos(all);
    setShowPicker(true);
  }, []);

  // Add selected photos to current album
  const handleAddPhotosToAlbum = useCallback(
    async (photoIds: string[]) => {
      if (!activeAlbumId) return;
      for (const id of photoIds) {
        const photo = await getPhoto(id);
        if (!photo) continue;
        if (!photo.albumIds.includes(activeAlbumId)) {
          const updated = { ...photo, albumIds: [...photo.albumIds, activeAlbumId] };
          await addPhoto(updated);
        }
      }
      setShowPicker(false);
      await loadPhotos();
    },
    [activeAlbumId, loadPhotos]
  );

  // Add an album
  const handleAddAlbum = useCallback(
    async (name: string, icon: string) => {
      const alb: Album = {
        id: crypto.randomUUID(),
        name,
        icon,
        createdAt: Date.now(),
      };
      await addAlbum(alb);
      await loadAlbums();
    },
    [loadAlbums]
  );

  // Delete an album
  const handleDeleteAlbum = useCallback(
    async (id: string) => {
      await deleteAlbum(id);
      if (activeAlbumId === id) {
        setActiveAlbumId(null);
      }
      await loadAlbums();
      await loadPhotos();
    },
    [activeAlbumId, loadAlbums, loadPhotos]
  );

  return (
    <div className="app">
      <Header
        title="Momento"
        rightAction={
          <div className="header-actions">
            <button
              className="btn-icon"
              onClick={() => setShowSettings(true)}
              aria-label="データ管理"
            >
              ⚙️
            </button>
            <button
              className="btn-icon"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'ライトモード' : 'ダークモード'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        }
      />

      <CategoryBar
        albums={albums}
        activeAlbumId={activeAlbumId}
        onSelectAll={handleSelectAll}
        onSelectAlbum={handleSelectAlbum}
        onAddAlbum={handleAddAlbum}
        onDeleteAlbum={handleDeleteAlbum}
      />

      <main className="main-content">
        {activeAlbumId && (
          <button className="add-to-album-btn" onClick={handleOpenPicker}>
            + 既存の写真を追加
          </button>
        )}
        <PhotoGrid photos={photos} onSelect={handleSelectPhoto} />
      </main>

      <AddPhotoButton onFiles={handleAddFiles} />

      {showSettings && (
        <SettingsMenu
          onClose={() => setShowSettings(false)}
          onDataChanged={() => {
            loadPhotos();
            loadAlbums();
          }}
        />
      )}

      {showPicker && activeAlbumId && (
        <PhotoPicker
          photos={allPhotos}
          albumId={activeAlbumId}
          onConfirm={handleAddPhotosToAlbum}
          onClose={() => setShowPicker(false)}
        />
      )}

      {uploadProgress && (
        <div className="upload-overlay">
          <div className="upload-dialog">
            <p className="upload-title">写真を追加中…</p>
            <div className="upload-bar-track">
              <div
                className="upload-bar-fill"
                style={{
                  width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="upload-count">
              {uploadProgress.done} / {uploadProgress.total}
              {uploadProgress.failed > 0 && (
                <span className="upload-failed">
                  （{uploadProgress.failed}件失敗）
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {selectedPhotoIndex !== null && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={selectedPhotoIndex}
          albums={albums}
          onClose={() => setSelectedPhotoIndex(null)}
          onDelete={handleDelete}
          onToggleAlbum={handleToggleAlbum}
        />
      )}
    </div>
  );
}

export default App;
