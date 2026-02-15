import { type FC, useRef, useState, useCallback, useEffect } from 'react';
import type { Photo } from '../types/photo';

interface PhotoGridProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onReorder?: (reorderedPhotos: Photo[]) => void;
  readOnly?: boolean;
}

const PhotoGrid: FC<PhotoGridProps> = ({
  photos,
  onSelect,
  selectMode,
  selectedIds,
  onToggleSelect,
  onReorder,
  readOnly,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const cellRectsRef = useRef<DOMRect[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<'mouse' | 'touch' | null>(null);

  const canDrag = !selectMode && !readOnly && !!onReorder && photos.length > 1;

  const getPreviewPhotos = useCallback((): Photo[] => {
    if (dragIndex === null || overIndex === null) return photos;
    const result = [...photos];
    const [dragged] = result.splice(dragIndex, 1);
    result.splice(overIndex, 0, dragged);
    return result;
  }, [photos, dragIndex, overIndex]);

  const updateCellRects = useCallback(() => {
    if (!gridRef.current) return;
    const cells = gridRef.current.querySelectorAll('.photo-cell');
    cellRectsRef.current = Array.from(cells).map((cell) =>
      cell.getBoundingClientRect()
    );
  }, []);

  const findDropIndex = useCallback((clientX: number, clientY: number): number | null => {
    for (let i = 0; i < cellRectsRef.current.length; i++) {
      const rect = cellRectsRef.current[i];
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return i;
      }
    }
    let minDist = Infinity;
    let closest = null;
    for (let i = 0; i < cellRectsRef.current.length; i++) {
      const rect = cellRectsRef.current[i];
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }, []);

  const createGhost = useCallback((index: number, x: number, y: number) => {
    if (!gridRef.current) return;
    const cells = gridRef.current.querySelectorAll('.photo-cell');
    const cell = cells[index] as HTMLElement;
    if (!cell) return;

    const rect = cell.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${x - rect.width / 2}px`;
    ghost.style.top = `${y - rect.height / 2}px`;

    const img = cell.querySelector('img');
    if (img) {
      const imgClone = document.createElement('img');
      imgClone.src = img.src;
      imgClone.style.width = '100%';
      imgClone.style.height = '100%';
      imgClone.style.objectFit = 'cover';
      imgClone.style.borderRadius = '4px';
      imgClone.draggable = false;
      ghost.appendChild(imgClone);
    }

    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
  }, []);

  const moveGhost = useCallback((x: number, y: number) => {
    if (!dragGhostRef.current) return;
    const ghost = dragGhostRef.current;
    const w = parseFloat(ghost.style.width);
    const h = parseFloat(ghost.style.height);
    ghost.style.left = `${x - w / 2}px`;
    ghost.style.top = `${y - h / 2}px`;
  }, []);

  const removeGhost = useCallback(() => {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }, []);

  const endDrag = useCallback(() => {
    const di = dragIndexRef.current;
    const oi = overIndexRef.current;
    if (di !== null && oi !== null && di !== oi) {
      const result = [...photos];
      const [dragged] = result.splice(di, 1);
      result.splice(oi, 0, dragged);
      onReorder?.(result);
    }
    dragIndexRef.current = null;
    overIndexRef.current = null;
    pointerTypeRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
    setIsDragging(false);
    removeGhost();
  }, [photos, onReorder, removeGhost]);

  const startDrag = useCallback(
    (index: number, x: number, y: number) => {
      dragIndexRef.current = index;
      overIndexRef.current = index;
      setDragIndex(index);
      setOverIndex(index);
      setIsDragging(true);
      updateCellRects();
      createGhost(index, x, y);
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    },
    [updateCellRects, createGhost]
  );

  // マウスドラッグ（ハンドルから開始）
  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      if (!canDrag) return;
      e.preventDefault();
      e.stopPropagation();
      pointerTypeRef.current = 'mouse';
      startDrag(index, e.clientX, e.clientY);
    },
    [canDrag, startDrag]
  );

  // タッチドラッグ（ハンドルから開始）
  const handleGripTouchStart = useCallback(
    (e: React.TouchEvent, index: number) => {
      if (!canDrag) return;
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      pointerTypeRef.current = 'touch';
      startDrag(index, touch.clientX, touch.clientY);
    },
    [canDrag, startDrag]
  );

  // マウスドラッグ中・終了のグローバルイベント
  useEffect(() => {
    if (!isDragging || pointerTypeRef.current !== 'mouse') return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      const idx = findDropIndex(e.clientX, e.clientY);
      if (idx !== null && idx !== overIndexRef.current) {
        overIndexRef.current = idx;
        setOverIndex(idx);
      }
    };

    const handleMouseUp = () => {
      endDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, moveGhost, findDropIndex, endDrag]);

  // タッチドラッグ中・終了のグローバルイベント
  useEffect(() => {
    if (!isDragging || pointerTypeRef.current !== 'touch') return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      moveGhost(touch.clientX, touch.clientY);
      const idx = findDropIndex(touch.clientX, touch.clientY);
      if (idx !== null && idx !== overIndexRef.current) {
        overIndexRef.current = idx;
        setOverIndex(idx);
      }
    };

    const handleTouchEnd = () => {
      endDrag();
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, moveGhost, findDropIndex, endDrag]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      removeGhost();
    };
  }, [removeGhost]);

  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">📷</p>
        <p>まだ写真がありません</p>
        <p className="empty-hint">下のボタンから写真を追加してね</p>
      </div>
    );
  }

  const displayPhotos = isDragging ? getPreviewPhotos() : photos;

  return (
    <div
      className={`photo-grid${isDragging ? ' dragging' : ''}`}
      ref={gridRef}
    >
      {displayPhotos.map((photo) => {
        const originalIndex = photos.findIndex((p) => p.id === photo.id);
        const isSelected = selectedIds.has(photo.id);
        const isBeingDragged = isDragging && photo.id === photos[dragIndex!]?.id;

        return (
          <button
            key={photo.id}
            className={`photo-cell${selectMode ? ' select-mode' : ''}${isSelected ? ' selected' : ''}${isBeingDragged ? ' drag-source' : ''}`}
            onClick={() => {
              if (isDragging) return;
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
            <img src={photo.thumbnailUrl} alt={photo.name} loading="lazy" draggable={false} />
            {canDrag && (
              <span
                className="drag-handle"
                onMouseDown={(e) => handleGripMouseDown(e, originalIndex)}
                onTouchStart={(e) => handleGripTouchStart(e, originalIndex)}
              >
                <span className="drag-handle-dots">
                  <span /><span /><span />
                  <span /><span /><span />
                </span>
              </span>
            )}
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
