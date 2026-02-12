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
  deletePhotosApi,
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
    currentFileProgress: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    async (files: File[], quality: string) => {
      const total = files.length;
      if (total === 0) return;

      setUploadProgress({ total, done: 0, failed: 0, currentFileProgress: 0 });

      let done = 0;
      let failed = 0;

      for (const file of files) {
        try {
          const name = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
          await uploadPhoto(file, activeAlbumId, quality, name, (progress) => {
            setUploadProgress({ total, done, failed, currentFileProgress: progress });
          });
        } catch {
          failed++;
        }
        done++;
        setUploadProgress({ total, done, failed, currentFileProgress: 0 });
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

  const handleToggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      if (!selectMode) setSelectMode(true);
    },
    [selectMode]
  );

  const handleSelectAllPhotos = useCallback(() => {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }, [photos]);

  const handleDeselectAllPhotos = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`${count}枚の写真を削除しますか？`)) return;
    await deletePhotosApi(Array.from(selectedIds));
    setSelectMode(false);
    setSelectedIds(new Set());
    await loadPhotos();
    await loadUsage();
  }, [selectedIds, loadPhotos, loadUsage]);

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
      await loadAlbums();
      if (activeAlbumId === id) {
        // setActiveAlbumId triggers loadPhotos via useEffect
        setActiveAlbumId(null);
      } else {
        await loadPhotos();
      }
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

      {selectMode && (
        <div className="select-toolbar">
          <button className="select-toolbar-close" onClick={handleExitSelectMode}>
            ✕
          </button>
          <span className="select-toolbar-count">{selectedIds.size}枚選択中</span>
          <div className="select-toolbar-actions">
            {selectedIds.size < photos.length ? (
              <button className="select-toolbar-btn" onClick={handleSelectAllPhotos}>
                全選択
              </button>
            ) : (
              <button className="select-toolbar-btn" onClick={handleDeselectAllPhotos}>
                全解除
              </button>
            )}
            <button
              className="select-toolbar-btn danger"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
            >
              削除
            </button>
          </div>
        </div>
      )}

      <main className="main-content">
        {activeAlbumId && !selectMode && (
          <button className="add-to-album-btn" onClick={handleOpenPicker}>
            + 既存の写真を追加
          </button>
        )}
        {!selectMode && photos.length > 0 && (
          <button
            className="select-mode-btn"
            onClick={() => setSelectMode(true)}
          >
            選択
          </button>
        )}
        <PhotoGrid
          photos={photos}
          onSelect={handleSelectPhoto}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      </main>

      {!selectMode && <AddPhotoButton onFiles={handleAddFiles} />}

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
                  width: `${Math.round(
                    ((uploadProgress.done + uploadProgress.currentFileProgress) /
                      uploadProgress.total) *
                      100
                  )}%`,
                }}
              />
            </div>
            <p className="upload-count">
              {uploadProgress.done - uploadProgress.failed} / {uploadProgress.total}
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
