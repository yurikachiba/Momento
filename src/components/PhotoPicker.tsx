import { type FC, useMemo, useState } from 'react';
import type { Photo } from '../types/photo';

interface PhotoPickerProps {
  photos: Photo[];
  albumId: string;
  onConfirm: (photoIds: string[]) => void;
  onClose: () => void;
}

const PhotoPicker: FC<PhotoPickerProps> = ({ photos, albumId, onConfirm, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter to photos NOT already in this album
  const available = useMemo(
    () => photos.filter((p) => !p.albumIds.includes(albumId)),
    [photos, albumId]
  );

  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of available) {
      map.set(p.id, URL.createObjectURL(p.thumbnail));
    }
    return map;
  }, [available]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>写真を追加</h3>
        {available.length === 0 ? (
          <p className="picker-empty">追加できる写真がありません</p>
        ) : (
          <>
            <p className="picker-hint">
              追加する写真をタップして選択してください
            </p>
            <div className="picker-grid">
              {available.map((photo) => (
                <button
                  key={photo.id}
                  className={`picker-cell ${selectedIds.has(photo.id) ? 'selected' : ''}`}
                  onClick={() => toggle(photo.id)}
                  aria-label={photo.name}
                >
                  <img src={urls.get(photo.id)} alt={photo.name} loading="lazy" />
                  {selectedIds.has(photo.id) && (
                    <span className="picker-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            追加（{selectedIds.size}枚）
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoPicker;
