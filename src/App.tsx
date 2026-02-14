import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import PhotoGrid from './components/PhotoGrid';
import PhotoViewer from './components/PhotoViewer';
import PhotoPicker from './components/PhotoPicker';
import CategoryBar from './components/CategoryBar';
import AddPhotoButton from './components/AddPhotoButton';
import SettingsMenu from './components/SettingsMenu';
import UsageBar from './components/UsageBar';
import Toast from './components/Toast';
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
  bulkAddToAlbum,
  bulkRemoveFromAlbum,
  updateAlbum,
  getUsage,
  updatePhotoMeta,
  getSharedAlbums,
  getSharedAlbumPhotos,
} from './lib/api';
import { sanitizeFileName } from './lib/sanitize';
import type { Photo, Album, SharedAlbum } from './types/photo';

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
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(null);
    // 一旦リセットしてから再表示（連続削除対応）
    requestAnimationFrame(() => setToast(message));
  }, []);

  // 共有アルバム関連
  const [sharedAlbums, setSharedAlbums] = useState<SharedAlbum[]>([]);
  const [activeSharedAlbumId, setActiveSharedAlbumId] = useState<string | null>(null);

  // 読み取り専用モード（共有アルバム閲覧時）
  const isReadOnly = activeSharedAlbumId !== null;

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

  const loadSharedAlbums = useCallback(async () => {
    try {
      setSharedAlbums(await getSharedAlbums());
    } catch {
      /* ignore */
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    try {
      if (activeSharedAlbumId) {
        setPhotos(await getSharedAlbumPhotos(activeSharedAlbumId));
      } else {
        setPhotos(await getPhotos(activeAlbumId));
      }
    } catch {
      /* ignore */
    }
  }, [activeAlbumId, activeSharedAlbumId]);

  const loadUsage = useCallback(async () => {
    try {
      setUsage(await getUsage());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadAlbums();
    loadSharedAlbums();
    loadUsage();
  }, [loadAlbums, loadSharedAlbums, loadUsage]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // --- Handlers ---

  const handleSelectAll = useCallback(() => {
    setActiveAlbumId(null);
    setActiveSharedAlbumId(null);
  }, []);

  const handleSelectAlbum = useCallback((id: string) => {
    setActiveAlbumId(id);
    setActiveSharedAlbumId(null);
  }, []);

  const handleSelectSharedAlbum = useCallback((id: string) => {
    setActiveSharedAlbumId(id);
    setActiveAlbumId(null);
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

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
      // 楽観的にUIから即座に削除
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setSelectedPhotoIndex(null);
      setUsage((prev) =>
        prev ? { ...prev, count: Math.max(0, prev.count - 1) } : prev
      );
      showToast('写真を削除しました');
      // API呼び出しはバックグラウンドで実行
      deletePhotoApi(id).catch(() => {
        // 失敗時はリロードして整合性を回復
        loadPhotos();
        loadUsage();
      });
    },
    [loadPhotos, loadUsage, showToast]
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
    const idsToDelete = Array.from(selectedIds);
    // 楽観的にUIから即座に削除
    setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectMode(false);
    setSelectedIds(new Set());
    setUsage((prev) =>
      prev ? { ...prev, count: Math.max(0, prev.count - count) } : prev
    );
    showToast(`${count}枚の写真を削除しました`);
    // API呼び出しはバックグラウンドで実行
    deletePhotosApi(idsToDelete).catch(() => {
      loadPhotos();
      loadUsage();
    });
  }, [selectedIds, loadPhotos, loadUsage, showToast]);

  const handleBulkRemoveFromAlbum = useCallback(async () => {
    if (selectedIds.size === 0 || !activeAlbumId) return;
    const count = selectedIds.size;
    if (!confirm(`${count}枚の写真をアルバムから外しますか？`)) return;
    const idsToRemove = Array.from(selectedIds);
    const albumId = activeAlbumId;
    // 楽観的にUIから即座に削除
    setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectMode(false);
    setSelectedIds(new Set());
    showToast(`${count}枚の写真をアルバムから外しました`);
    // 一括API呼び出し（N回→1回に削減）
    bulkRemoveFromAlbum(albumId, idsToRemove).catch(() => {
      loadPhotos();
    });
  }, [selectedIds, activeAlbumId, loadPhotos, showToast]);

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
      if (!activeAlbumId || photoIds.length === 0) return;
      await bulkAddToAlbum(activeAlbumId, photoIds);
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

  const handleRenameAlbum = useCallback(
    async (id: string, name: string, icon: string) => {
      await updateAlbum(id, { name, icon });
      await loadAlbums();
    },
    [loadAlbums]
  );

  const handleDeleteAlbum = useCallback(
    async (id: string) => {
      await deleteAlbumApi(id);
      await loadAlbums();
      showToast('アルバムを削除しました');
      if (activeAlbumId === id) {
        // setActiveAlbumId triggers loadPhotos via useEffect
        setActiveAlbumId(null);
      } else {
        await loadPhotos();
      }
    },
    [activeAlbumId, loadAlbums, loadPhotos, showToast]
  );

  // 現在閲覧中の共有アルバム情報
  const currentSharedAlbum = sharedAlbums.find((a) => a.id === activeSharedAlbumId);

  return (
    <div className="app">
      <Header
        title="MomentoLite"
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

      {usage && !isReadOnly && <UsageBar usage={usage} />}

      <CategoryBar
        albums={albums}
        activeAlbumId={activeAlbumId}
        onSelectAll={handleSelectAll}
        onSelectAlbum={handleSelectAlbum}
        onAddAlbum={handleAddAlbum}
        onRenameAlbum={handleRenameAlbum}
        onDeleteAlbum={handleDeleteAlbum}
        sharedAlbums={sharedAlbums}
        activeSharedAlbumId={activeSharedAlbumId}
        onSelectSharedAlbum={handleSelectSharedAlbum}
      />

      {/* 共有アルバム閲覧時のバナー */}
      {isReadOnly && currentSharedAlbum && (
        <div className="shared-banner">
          <span className="shared-banner-icon">👥</span>
          <span className="shared-banner-text">
            {currentSharedAlbum.ownerDisplayName}さんの共有アルバム
          </span>
          <span className="shared-banner-hint">閲覧のみ</span>
        </div>
      )}

      {selectMode && !isReadOnly && (
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
            {activeAlbumId && (
              <button
                className="select-toolbar-btn"
                onClick={handleBulkRemoveFromAlbum}
                disabled={selectedIds.size === 0}
              >
                アルバムから外す
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
        {activeAlbumId && !selectMode && !isReadOnly && (
          <button className="add-to-album-btn" onClick={handleOpenPicker}>
            + 既存の写真を追加
          </button>
        )}
        {!selectMode && !isReadOnly && photos.length > 0 && (
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
          selectMode={selectMode && !isReadOnly}
          selectedIds={selectedIds}
          onToggleSelect={isReadOnly ? () => {} : handleToggleSelect}
        />
      </main>

      {!selectMode && !isReadOnly && <AddPhotoButton onFiles={handleAddFiles} />}

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

      <Toast
        message={toast ?? ''}
        visible={toast !== null}
        onHide={() => setToast(null)}
      />

      {selectedPhotoIndex !== null && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={selectedPhotoIndex}
          albums={albums}
          onClose={() => setSelectedPhotoIndex(null)}
          onDelete={handleDelete}
          onToggleAlbum={handleToggleAlbum}
          onUpdateMemo={handleUpdateMemo}
          readOnly={isReadOnly}
          sharedAlbumId={activeSharedAlbumId}
        />
      )}
    </div>
  );
}

export default App;
