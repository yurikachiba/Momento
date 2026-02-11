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
  addPhoto,
  deletePhoto,
  getPhoto,
  getAllCategories,
  addCategory,
  deleteCategory,
} from './lib/db';
import { processImage } from './lib/image';
import type { Photo, Category } from './types/photo';

function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
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

  // Load photos
  const loadPhotos = useCallback(async () => {
    const data =
      activeCategoryId === 'all'
        ? await getAllPhotos()
        : await getPhotosByCategory(activeCategoryId);
    setPhotos(data);
  }, [activeCategoryId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

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
    [activeCategoryId, loadPhotos]
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
        activeCategoryId={activeCategoryId}
        onSelect={setActiveCategoryId}
        onAdd={handleAddCategory}
        onDelete={handleDeleteCategory}
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
          }}
        />
      )}

      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          categories={categories}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
          onChangeCategory={handleChangeCategory}
        />
      )}
    </div>
  );
}

export default App;
