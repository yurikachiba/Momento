import { type FC, useMemo, useState, useRef, useCallback } from 'react';
import type { Photo } from '../types/photo';

interface PhotoPickerProps {
  photos: Photo[];
  albumId: string;
  onConfirm: (photoIds: string[]) => void;
  onClose: () => void;
}

const PhotoPicker: FC<PhotoPickerProps> = ({
  photos,
  albumId,
  onConfirm,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const available = useMemo(
    () => photos.filter((p) => !p.albumIds.includes(albumId)),
    [photos, albumId]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  const handleSelectAll = useCallback(() => {
    const allIds = available.map((p) => p.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [available, selectedIds]);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < available.length) {
        setCurrentIndex(index);
      }
    },
    [available.length]
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (isHorizontalSwipe.current) {
      setSwipeOffset(dx);
    }
  }, [isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const threshold = 60;
    if (swipeOffset > threshold) {
      goPrev();
    } else if (swipeOffset < -threshold) {
      goNext();
    }

    setSwipeOffset(0);
    isHorizontalSwipe.current = null;
  }, [isSwiping, swipeOffset, goPrev, goNext]);

  // Thumbnail strip ref for auto-scroll
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollToThumb = useCallback((index: number) => {
    if (!stripRef.current) return;
    const container = stripRef.current;
    const thumb = container.children[index] as HTMLElement | undefined;
    if (thumb) {
      const left = thumb.offsetLeft - container.clientWidth / 2 + thumb.clientWidth / 2;
      container.scrollTo({ left, behavior: 'smooth' });
    }
  }, []);

  const handleThumbClick = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      scrollToThumb(index);
    },
    [scrollToThumb]
  );

  // Auto-scroll strip when currentIndex changes via swipe/arrows
  const prevIndex = useRef(currentIndex);
  if (prevIndex.current !== currentIndex) {
    prevIndex.current = currentIndex;
    requestAnimationFrame(() => scrollToThumb(currentIndex));
  }

  const currentPhoto = available[currentIndex];
  const isSelected = currentPhoto ? selectedIds.has(currentPhoto.id) : false;

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-fullscreen" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="picker-header">
          <button className="picker-close-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
          <span className="picker-title">写真を追加</span>
          <span className="picker-counter">
            {available.length > 0
              ? `${currentIndex + 1} / ${available.length}`
              : ''}
          </span>
        </div>

        {/* Select All bar */}
        {available.length > 0 && (
          <div className="picker-select-all-bar">
            <button
              className="picker-select-all-btn"
              onClick={handleSelectAll}
            >
              {available.length > 0 && available.every((p) => selectedIds.has(p.id))
                ? '全解除'
                : `全選択（${available.length}枚）`}
            </button>
          </div>
        )}

        {available.length === 0 ? (
          <div className="picker-empty-full">
            <p>追加できる写真がありません</p>
          </div>
        ) : (
          <>
            {/* Main image area */}
            <div
              className="picker-main"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Prev arrow (desktop) */}
              {currentIndex > 0 && (
                <button
                  className="picker-arrow picker-arrow-left"
                  onClick={goPrev}
                  aria-label="前の写真"
                >
                  ‹
                </button>
              )}

              {/* Photo display */}
              <div
                className="picker-image-wrapper"
                style={{
                  transform: isSwiping ? `translateX(${swipeOffset}px)` : undefined,
                  transition: isSwiping ? 'none' : 'transform 0.25s ease',
                }}
              >
                <img
                  src={currentPhoto?.url || currentPhoto?.thumbnailUrl}
                  alt={currentPhoto?.name}
                  className="picker-large-image"
                  draggable={false}
                />
              </div>

              {/* Next arrow (desktop) */}
              {currentIndex < available.length - 1 && (
                <button
                  className="picker-arrow picker-arrow-right"
                  onClick={goNext}
                  aria-label="次の写真"
                >
                  ›
                </button>
              )}
            </div>

            {/* Select toggle button */}
            <div className="picker-select-area">
              <button
                className={`picker-select-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => currentPhoto && toggle(currentPhoto.id)}
              >
                {isSelected ? '✓ 選択済み' : '○ タップして選択'}
              </button>
              {currentPhoto?.name && (
                <p className="picker-photo-name">{currentPhoto.name}</p>
              )}
            </div>

            {/* Thumbnail strip */}
            <div className="picker-strip" ref={stripRef}>
              {available.map((photo, i) => (
                <button
                  key={photo.id}
                  className={`picker-thumb ${i === currentIndex ? 'active' : ''} ${selectedIds.has(photo.id) ? 'selected' : ''}`}
                  onClick={() => handleThumbClick(i)}
                  aria-label={photo.name}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.name}
                    loading="lazy"
                    draggable={false}
                  />
                  {selectedIds.has(photo.id) && (
                    <span className="picker-thumb-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Bottom actions */}
        <div className="picker-bottom-actions">
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
