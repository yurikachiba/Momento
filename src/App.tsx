import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import PhotoGrid from './components/PhotoGrid';
import PhotoViewer from './components/PhotoViewer';
import PhotoPicker from './components/PhotoPicker';
import CategoryBar from './components/CategoryBar';
import AddPhotoButton from './components/AddPhotoButton';
import SettingsMenu from './components/SettingsMenu';
import UsageBar from './components/UsageBar';
import {
  getPhotos,
  uploadPhoto,
  deletePhotoApi,
  getAlbums,
  createAlbum,
  deleteAlbumApi,
  addPhotoToAlbum,
  removePhotoFromAlbum,
  getUsage,
  updatePhotoMeta,
} from './lib/api';
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
  const [usage, setUsage] = useState<{
    count: number;
    totalSize: number;
    limit: number;
  } | null>(null);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('momento-dark', String(darkMode));
  }, [darkMode]);

  const loadAlbums = useCallback(async () => {
    try {
      setAlbums(await getAlbums());
    } catch {
      /* ignore */
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    try {
      setPhotos(await getPhotos(activeAlbumId));
    } catch {
      /* ignore */
    }
  }, [activeAlbumId]);

  const loadUsage = useCallback(async () => {
    try {
      setUsage(await getUsage());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadAlbums();
    loadUsage();
  }, [loadAlbums, loadUsage]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // --- Handlers ---

  const handleSelectAll = useCallback(() => setActiveAlbumId(null), []);
  const handleSelectAlbum = useCallback((id: string) => setActiveAlbumId(id), []);

  const handleAddFiles = useCallback(
    async (files: FileList, quality: string) => {
      const fileArray = Array.from(files);
      const total = fileArray.length;
      if (total === 0) return;

      setUploadProgress({ total, done: 0, failed: 0 });

      let done = 0;
      let failed = 0;

      for (const file of fileArray) {
        try {
          const name = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
          await uploadPhoto(file, activeAlbumId, quality, name);
        } catch {
          failed++;
        }
        done++;
        setUploadProgress({ total, done, failed });
      }

      await loadPhotos();
      await loadUsage();
      setTimeout(() => setUploadProgress(null), 800);
    },
    [activeAlbumId, loadPhotos, loadUsage]
  );

  const handleSelectPhoto = useCallback(
    (photo: Photo) => {
      const idx = photos.findIndex((p) => p.id === photo.id);
      if (idx !== -1) setSelectedPhotoIndex(idx);
    },
    [photos]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deletePhotoApi(id);
      setSelectedPhotoIndex(null);
      await loadPhotos();
      await loadUsage();
    },
    [loadPhotos, loadUsage]
  );

  const handleToggleAlbum = useCallback(
    async (photoId: string, albumId: string) => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) return;
      if (photo.albumIds.includes(albumId)) {
        await removePhotoFromAlbum(photoId, albumId);
      } else {
        await addPhotoToAlbum(photoId, albumId);
      }
      await loadPhotos();
    },
    [photos, loadPhotos]
  );

  const handleUpdateMemo = useCallback(
    async (photoId: string, memo: string) => {
      await updatePhotoMeta(photoId, { memo });
      await loadPhotos();
    },
    [loadPhotos]
  );

  const handleOpenPicker = useCallback(async () => {
    try {
      setAllPhotos(await getPhotos(null));
      setShowPicker(true);
    } catch {
      /* ignore */
    }
  }, []);

  const handleAddPhotosToAlbum = useCallback(
    async (photoIds: string[]) => {
      if (!activeAlbumId) return;
      for (const id of photoIds) {
        await addPhotoToAlbum(id, activeAlbumId);
      }
      setShowPicker(false);
      await loadPhotos();
    },
    [activeAlbumId, loadPhotos]
  );

  const handleAddAlbum = useCallback(
    async (name: string, icon: string) => {
      await createAlbum(name, icon);
      await loadAlbums();
    },
    [loadAlbums]
  );

  const handleDeleteAlbum = useCallback(
    async (id: string) => {
      await deleteAlbumApi(id);
      if (activeAlbumId === id) setActiveAlbumId(null);
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
              aria-label="設定"
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

      {usage && <UsageBar usage={usage} />}

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
        <SettingsMenu onClose={() => setShowSettings(false)} usage={usage} />
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
            <p className="upload-title">写真をアップロード中…</p>
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
          onUpdateMemo={handleUpdateMemo}
        />
      )}
    </div>
  );
}

export default App;
