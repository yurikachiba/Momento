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
import type { Photo, Album } from './types/photo';

function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
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

  // Add photos from file input
  const handleAddFiles = useCallback(
    async (files: FileList) => {
      setLoading(true);
      try {
        for (const file of Array.from(files)) {
          const { blob, thumbnail, width, height } = await processImage(file);
          const photo: Photo = {
            id: crypto.randomUUID(),
            blob,
            thumbnail,
            name: file.name.replace(/\.[^.]+$/, ''),
            albumIds: activeAlbumId ? [activeAlbumId] : [],
            createdAt: Date.now(),
            width,
            height,
          };
          await addPhoto(photo);
        }
        await loadPhotos();
      } finally {
        setLoading(false);
      }
    },
    [activeAlbumId, loadPhotos]
  );

  // Delete a photo
  const handleDelete = useCallback(
    async (id: string) => {
      await deletePhoto(id);
      setSelectedPhoto(null);
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
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(updated);
      }
      await loadPhotos();
    },
    [loadPhotos, selectedPhoto]
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
        {loading && (
          <div className="loading-bar">
            <div className="loading-bar-inner" />
          </div>
        )}
        {activeAlbumId && (
          <button className="add-to-album-btn" onClick={handleOpenPicker}>
            + 既存の写真を追加
          </button>
        )}
        <PhotoGrid photos={photos} onSelect={setSelectedPhoto} />
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

      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          albums={albums}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
          onToggleAlbum={handleToggleAlbum}
          onPhotoUpdated={loadPhotos}
        />
      )}
    </div>
  );
}

export default App;
