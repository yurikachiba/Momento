import { type FC } from 'react';
import type { Photo } from '../types/photo';

interface PhotoGridProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

const PhotoGrid: FC<PhotoGridProps> = ({
  photos,
  onSelect,
  selectMode,
  selectedIds,
  onToggleSelect,
}) => {
  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">📷</p>
        <p>まだ写真がありません</p>
        <p className="empty-hint">下のボタンから写真を追加してね</p>
      </div>
    );
  }

  return (
    <div className="photo-grid">
      {photos.map((photo) => {
        const isSelected = selectedIds.has(photo.id);
        return (
          <button
            key={photo.id}
            className={`photo-cell${selectMode ? ' select-mode' : ''}${isSelected ? ' selected' : ''}`}
            onClick={() => {
              if (selectMode) {
                onToggleSelect(photo.id);
              } else {
                onSelect(photo);
              }
            }}
            onContextMenu={(e) => {
              if (!selectMode) {
                e.preventDefault();
                onToggleSelect(photo.id);
              }
            }}
            aria-label={photo.name}
          >
            <img src={photo.thumbnailUrl} alt={photo.name} loading="lazy" />
            {selectMode && (
              <span className={`select-check${isSelected ? ' active' : ''}`}>
                {isSelected ? '✓' : ''}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PhotoGrid;
