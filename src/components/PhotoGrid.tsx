import { type FC, useMemo } from 'react';
import type { Photo } from '../types/photo';

interface PhotoGridProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
}

const PhotoGrid: FC<PhotoGridProps> = ({ photos, onSelect }) => {
  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of photos) {
      map.set(p.id, URL.createObjectURL(p.thumbnail));
    }
    return map;
  }, [photos]);

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
      {photos.map((photo) => (
        <button
          key={photo.id}
          className="photo-cell"
          onClick={() => onSelect(photo)}
          aria-label={photo.name}
        >
          <img
            src={urls.get(photo.id)}
            alt={photo.name}
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
};

export default PhotoGrid;
