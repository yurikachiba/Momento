import { type FC, useMemo, useState } from 'react';
import type { Photo, Category } from '../types/photo';

interface PhotoViewerProps {
  photo: Photo;
  categories: Category[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onChangeCategory: (photoId: string, categoryId: string) => void;
}

const PhotoViewer: FC<PhotoViewerProps> = ({
  photo,
  categories,
  onClose,
  onDelete,
  onChangeCategory,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob]);

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
