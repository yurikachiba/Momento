import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import PhotoGrid from './components/PhotoGrid';
import PhotoViewer from './components/PhotoViewer';
import CategoryBar from './components/CategoryBar';
import AddPhotoButton from './components/AddPhotoButton';
import SettingsMenu from './components/SettingsMenu';
import {
  getAllPhotos,
  getPhotosByCategory,
  getPhotosByAlbum,
  addPhoto,
  deletePhoto,
  getPhoto,
  getAllCategories,
  addCategory,
  deleteCategory,
  getAllAlbums,
  addAlbum,
  deleteAlbum,
} from './lib/db';
import { processImage } from './lib/image';
import type { Photo, Category, Album } from './types/photo';

function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('momento-dark') === 'true';
  });

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('momento-dark', String(darkMode));
  }, [darkMode]);

  // Load categories
  const loadCategories = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
  }, []);

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
    } else if (activeCategoryId === 'all') {
      data = await getAllPhotos();
    } else {
      data = await getPhotosByCategory(activeCategoryId);
    }
    setPhotos(data);
  }, [activeCategoryId, activeAlbumId]);

  useEffect(() => {
    loadCategories();
    loadAlbums();
  }, [loadCategories, loadAlbums]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Select a category (clears album selection)
  const handleSelectCategory = useCallback((id: string) => {
    setActiveAlbumId(null);
    setActiveCategoryId(id);
  }, []);

  // Select an album (clears category selection)
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
            categoryId: activeCategoryId === 'all' ? 'all' : activeCategoryId,
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
    [activeCategoryId, activeAlbumId, loadPhotos]
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

  // Change a photo's category
  const handleChangeCategory = useCallback(
    async (photoId: string, categoryId: string) => {
      const photo = await getPhoto(photoId);
      if (!photo) return;
      await addPhoto({ ...photo, categoryId });
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto({ ...photo, categoryId });
      }
      await loadPhotos();
    },
    [loadPhotos, selectedPhoto]
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

  // Add a category
  const handleAddCategory = useCallback(
    async (name: string, icon: string) => {
      const cat: Category = {
        id: crypto.randomUUID(),
        name,
        icon,
        createdAt: Date.now(),
      };
      await addCategory(cat);
      await loadCategories();
    },
    [loadCategories]
  );

  // Delete a category
  const handleDeleteCategory = useCallback(
    async (id: string) => {
      await deleteCategory(id);
      if (activeCategoryId === id) {
        setActiveCategoryId('all');
      }
      await loadCategories();
      await loadPhotos();
    },
    [activeCategoryId, loadCategories, loadPhotos]
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
        categories={categories}
        albums={albums}
        activeCategoryId={activeCategoryId}
        activeAlbumId={activeAlbumId}
        onSelectCategory={handleSelectCategory}
        onSelectAlbum={handleSelectAlbum}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddAlbum={handleAddAlbum}
        onDeleteAlbum={handleDeleteAlbum}
      />

      <main className="main-content">
        {loading && (
          <div className="loading-bar">
            <div className="loading-bar-inner" />
          </div>
        )}
        <PhotoGrid photos={photos} onSelect={setSelectedPhoto} />
      </main>

      <AddPhotoButton onFiles={handleAddFiles} />

      {showSettings && (
        <SettingsMenu
          onClose={() => setShowSettings(false)}
          onDataChanged={() => {
            loadPhotos();
            loadCategories();
            loadAlbums();
          }}
        />
      )}

      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          categories={categories}
          albums={albums}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
          onChangeCategory={handleChangeCategory}
          onToggleAlbum={handleToggleAlbum}
          onPhotoUpdated={loadPhotos}
        />
      )}
    </div>
  );
}

export default App;
