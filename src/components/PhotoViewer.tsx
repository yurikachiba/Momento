import { type FC, useMemo, useState } from 'react';
import type { Photo, Album } from '../types/photo';

interface PhotoViewerProps {
  photo: Photo;
  albums: Album[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleAlbum: (photoId: string, albumId: string) => void;
}

const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

const PhotoViewer: FC<PhotoViewerProps> = ({
  photo,
  albums,
  onClose,
  onDelete,
  onToggleAlbum,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob]);

  const handleSave = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${photo.name}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    const file = new File([photo.blob], `${photo.name}.webp`, { type: 'image/webp' });
    try {
      await navigator.share({ files: [file] });
    } catch {
      // User cancelled – ignore
    }
  };

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <button className="btn-icon" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
          <span className="viewer-name">{photo.name}</span>
          <button
            className="btn-icon"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="メニュー"
          >
            ⋯
          </button>
        </div>
        <div className="viewer-image-wrap">
          <img src={url} alt={photo.name} className="viewer-image" />
        </div>

        <div className="viewer-actions">
          <button className="viewer-action-btn" onClick={handleSave}>
            <span className="viewer-action-icon">💾</span>
            保存
          </button>
          {canShare && (
            <button className="viewer-action-btn" onClick={handleShare}>
              <span className="viewer-action-icon">↗</span>
              共有
            </button>
          )}
        </div>

        {showMenu && (
          <div className="viewer-menu">
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
