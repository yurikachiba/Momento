import { type FC, useMemo, useState, useEffect } from 'react';
import type { Photo, Category, Album } from '../types/photo';
import { isCloudConfigured } from '../lib/firebase';
import { uploadToCloud, fetchFromCloud, isLocallyAvailable } from '../lib/cloud';

interface PhotoViewerProps {
  photo: Photo;
  categories: Category[];
  albums: Album[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onChangeCategory: (photoId: string, categoryId: string) => void;
  onToggleAlbum: (photoId: string, albumId: string) => void;
  onPhotoUpdated: () => void;
}

const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

const PhotoViewer: FC<PhotoViewerProps> = ({
  photo,
  categories,
  albums,
  onClose,
  onDelete,
  onChangeCategory,
  onToggleAlbum,
  onPhotoUpdated,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [cloudBlob, setCloudBlob] = useState<Blob | null>(null);

  const local = isLocallyAvailable(photo);
  const displayBlob = local ? photo.blob : cloudBlob;
  const url = useMemo(
    () => (displayBlob ? URL.createObjectURL(displayBlob) : null),
    [displayBlob]
  );

  // Auto-fetch from cloud when viewing a cloud-only photo
  useEffect(() => {
    if (!local && photo.cloudPath && !cloudBlob) {
      setCloudStatus('クラウドから読み込み中...');
      fetchFromCloud(photo)
        .then((blob) => {
          setCloudBlob(blob);
          setCloudStatus(null);
        })
        .catch(() => setCloudStatus('読み込みに失敗しました'));
    }
  }, [local, photo, cloudBlob]);

  const handleSave = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${photo.name}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    const blob = displayBlob ?? photo.blob;
    const file = new File([blob], `${photo.name}.webp`, { type: 'image/webp' });
    try {
      await navigator.share({ files: [file] });
    } catch {
      // User cancelled – ignore
    }
  };

  const handleUploadToCloud = async () => {
    setCloudBusy(true);
    setCloudStatus('アップロード中...');
    try {
      await uploadToCloud(photo.id);
      setCloudStatus('クラウドに保存しました');
      onPhotoUpdated();
    } catch (e) {
      setCloudStatus(e instanceof Error ? e.message : 'アップロード失敗');
    } finally {
      setCloudBusy(false);
    }
  };

  const cloudConfigured = isCloudConfigured();

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <button className="btn-icon" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
          <span className="viewer-name">
            {photo.cloudPath && <span className="cloud-badge">☁️</span>}
            {photo.name}
          </span>
          <button
            className="btn-icon"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="メニュー"
          >
            ⋯
          </button>
        </div>
        <div className="viewer-image-wrap">
          {url ? (
            <img src={url} alt={photo.name} className="viewer-image" />
          ) : (
            <div className="viewer-loading">
              {cloudStatus || '読み込み中...'}
            </div>
          )}
        </div>

        <div className="viewer-actions">
          <button className="viewer-action-btn" onClick={handleSave} disabled={!url}>
            <span className="viewer-action-icon">💾</span>
            保存
          </button>
          {canShare && (
            <button className="viewer-action-btn" onClick={handleShare} disabled={!displayBlob}>
              <span className="viewer-action-icon">↗</span>
              共有
            </button>
          )}
          {cloudConfigured && !photo.cloudPath && (
            <button
              className="viewer-action-btn"
              onClick={handleUploadToCloud}
              disabled={cloudBusy}
            >
              <span className="viewer-action-icon">☁️</span>
              クラウド
            </button>
          )}
        </div>

        {cloudStatus && <div className="viewer-cloud-status">{cloudStatus}</div>}

        {showMenu && (
          <div className="viewer-menu">
            <div className="viewer-menu-section">
              <p className="viewer-menu-label">フォルダ移動</p>
              <div className="viewer-menu-categories">
                <button
                  className={`category-chip ${photo.categoryId === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    onChangeCategory(photo.id, 'all');
                    setShowMenu(false);
                  }}
                >
                  📁 すべて
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`category-chip ${photo.categoryId === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      onChangeCategory(photo.id, cat.id);
                      setShowMenu(false);
                    }}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {albums.length > 0 && (
              <div className="viewer-menu-section">
                <p className="viewer-menu-label">アルバムに追加</p>
                <div className="viewer-menu-albums">
                  {albums.map((album) => {
                    const inAlbum = photo.albumIds.includes(album.id);
                    return (
                      <button
                        key={album.id}
                        className={`album-toggle ${inAlbum ? 'active' : ''}`}
                        onClick={() => onToggleAlbum(photo.id, album.id)}
                      >
                        <span className="album-toggle-check">{inAlbum ? '✓' : ''}</span>
                        {album.icon} {album.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              className="btn-danger"
              onClick={() => {
                if (confirm('この写真を削除しますか？')) {
                  onDelete(photo.id);
                }
              }}
            >
              🗑 写真を削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoViewer;
