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

const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD = 8;

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
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const cellRectsRef = useRef<DOMRect[]>([]);
  const dragStarted = useRef(false);

  const canDrag = !selectMode && !readOnly && !!onReorder && photos.length > 1;

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
    // 最も近いセルを探す
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
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const reordered = getPreviewPhotos();
      onReorder?.(reordered);
    }
    setDragIndex(null);
    setOverIndex(null);
    setIsDragging(false);
    dragStarted.current = false;
    removeGhost();
    clearLongPress();
  }, [dragIndex, overIndex, getPreviewPhotos, onReorder, removeGhost, clearLongPress]);

  // タッチイベントハンドラ
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, index: number) => {
      if (!canDrag) return;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      dragStarted.current = false;

      longPressTimer.current = setTimeout(() => {
        dragStarted.current = true;
        setDragIndex(index);
        setOverIndex(index);
        setIsDragging(true);
        updateCellRects();
        createGhost(index, touch.clientX, touch.clientY);

        // 触覚フィードバック
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
      }, LONG_PRESS_MS);
    },
    [canDrag, updateCellRects, createGhost]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];

      // 長押し判定前に指が動いたらキャンセル
      if (!dragStarted.current && touchStartPos.current) {
        const dx = touch.clientX - touchStartPos.current.x;
        const dy = touch.clientY - touchStartPos.current.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          clearLongPress();
        }
        return;
      }

      if (!dragStarted.current || dragIndex === null) return;

      e.preventDefault();
      moveGhost(touch.clientX, touch.clientY);

      const newOverIndex = findDropIndex(touch.clientX, touch.clientY);
      if (newOverIndex !== null && newOverIndex !== overIndex) {
        setOverIndex(newOverIndex);
      }
    },
    [dragIndex, overIndex, clearLongPress, moveGhost, findDropIndex]
  );

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    if (dragStarted.current) {
      endDrag();
    }
    touchStartPos.current = null;
  }, [clearLongPress, endDrag]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      clearLongPress();
      removeGhost();
    };
  }, [clearLongPress, removeGhost]);

  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">📷</p>
        <p>まだ写真がありません</p>
        <p className="empty-hint">下のボタンから写真を追加してね</p>
      </div>
    );
  }

  // ドラッグ中のプレビュー順序
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
            onTouchStart={(e) => handleTouchStart(e, originalIndex)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            aria-label={photo.name}
          >
            <img src={photo.thumbnailUrl} alt={photo.name} loading="lazy" draggable={false} />
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
