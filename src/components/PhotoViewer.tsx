import {
  type FC,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { Photo, Album } from '../types/photo';

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  albums: Album[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleAlbum: (photoId: string, albumId: string) => void;
  onUpdateMemo: (photoId: string, memo: string) => void;
}

const canShare =
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function';

const PRELOAD_COUNT = 2;

const PhotoViewer: FC<PhotoViewerProps> = ({
  photos,
  initialIndex,
  albums,
  onClose,
  onDelete,
  onToggleAlbum,
  onUpdateMemo,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMenu, setShowMenu] = useState(false);
  const [memo, setMemo] = useState('');

  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const touchMovedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const photo = photos[currentIndex];

  // Sync memo with current photo
  useEffect(() => {
    setMemo(photo.memo || '');
  }, [photo.id, photo.memo]);

  // Preload adjacent images
  useEffect(() => {
    const start = Math.max(0, currentIndex - PRELOAD_COUNT);
    const end = Math.min(photos.length - 1, currentIndex + PRELOAD_COUNT);
    for (let i = start; i <= end; i++) {
      if (i !== currentIndex) {
        const img = new Image();
        img.src = photos[i].url;
      }
    }
  }, [currentIndex, photos]);

  // --- Navigation ---
  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= photos.length) return;
      setIsAnimating(true);
      const direction = index > currentIndex ? -1 : 1;
      const width = containerRef.current?.offsetWidth ?? window.innerWidth;
      setOffsetX(direction * width);

      requestAnimationFrame(() => {
        setTimeout(() => {
          setCurrentIndex(index);
          setOffsetX(0);
          setIsAnimating(false);
        }, 250);
      });
    },
    [currentIndex, photos.length]
  );

  const goPrev = useCallback(
    () => goTo(currentIndex - 1),
    [currentIndex, goTo]
  );
  const goNext = useCallback(
    () => goTo(currentIndex + 1),
    [currentIndex, goTo]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose]);

  // --- Touch handlers ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimating || showMenu) return;
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchMovedRef.current = false;
      setIsSwiping(false);
    },
    [isAnimating, showMenu]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || isAnimating || showMenu) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (!touchMovedRef.current && Math.abs(dy) > Math.abs(dx)) {
        touchStartRef.current = null;
        return;
      }

      touchMovedRef.current = true;
      setIsSwiping(true);

      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === photos.length - 1 && dx < 0;
      const dampened = atStart || atEnd ? dx * 0.3 : dx;

      setOffsetX(dampened);
    },
    [isAnimating, showMenu, currentIndex, photos.length]
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchMovedRef.current) {
      touchStartRef.current = null;
      return;
    }

    const width = containerRef.current?.offsetWidth ?? window.innerWidth;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(offsetX) / elapsed;

    const threshold = width * 0.3;
    const shouldAdvance = Math.abs(offsetX) > threshold || velocity > 0.3;

    if (shouldAdvance && offsetX < 0 && currentIndex < photos.length - 1) {
      setIsAnimating(true);
      setOffsetX(-width);
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setOffsetX(0);
        setIsAnimating(false);
        setIsSwiping(false);
      }, 250);
    } else if (shouldAdvance && offsetX > 0 && currentIndex > 0) {
      setIsAnimating(true);
      setOffsetX(width);
      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setOffsetX(0);
        setIsAnimating(false);
        setIsSwiping(false);
      }, 250);
    } else {
      setIsAnimating(true);
      setOffsetX(0);
      setTimeout(() => {
        setIsAnimating(false);
        setIsSwiping(false);
      }, 250);
    }

    touchStartRef.current = null;
  }, [offsetX, currentIndex, photos.length]);

  // --- Actions ---
  const handleSave = async () => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${photo.name}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(photo.url, '_blank');
    }
  };

  const handleShare = async () => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const file = new File([blob], `${photo.name}.jpg`, { type: blob.type });
      await navigator.share({ files: [file] });
    } catch {
      // User cancelled
    }
  };

  const handleMemoBlur = () => {
    if (memo !== (photo.memo || '')) {
      onUpdateMemo(photo.id, memo);
    }
  };

  const prevUrl = currentIndex > 0 ? photos[currentIndex - 1].url : null;
  const nextUrl =
    currentIndex < photos.length - 1 ? photos[currentIndex + 1].url : null;

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <button className="btn-icon" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
          <span className="viewer-name">{photo.name}</span>
          <div className="viewer-header-right">
            <span className="viewer-counter">
              {currentIndex + 1} / {photos.length}
            </span>
            <button
              className="btn-icon"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="メニュー"
            >
              ⋯
            </button>
          </div>
        </div>

        {/* Swipe area */}
        <div
          ref={containerRef}
          className="viewer-swipe-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="viewer-swipe-track"
            style={{
              transform: `translateX(${offsetX}px)`,
              transition:
                isAnimating && !isSwiping
                  ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  : isSwiping
                    ? 'none'
                    : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            <div className="viewer-slide viewer-slide-prev">
              {prevUrl && <img src={prevUrl} alt="" className="viewer-image" />}
            </div>
            <div className="viewer-slide viewer-slide-current">
              <img src={photo.url} alt={photo.name} className="viewer-image" />
            </div>
            <div className="viewer-slide viewer-slide-next">
              {nextUrl && <img src={nextUrl} alt="" className="viewer-image" />}
            </div>
          </div>

          {currentIndex > 0 && (
            <button
              className="viewer-arrow viewer-arrow-left"
              onClick={goPrev}
              aria-label="前の写真"
            >
              ‹
            </button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              className="viewer-arrow viewer-arrow-right"
              onClick={goNext}
              aria-label="次の写真"
            >
              ›
            </button>
          )}
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
            <div className="viewer-menu-section">
              <p className="viewer-menu-label">メモ</p>
              <textarea
                className="memo-input"
                placeholder="メモを追加..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                onBlur={handleMemoBlur}
                rows={2}
              />
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
                        <span className="album-toggle-check">
                          {inAlbum ? '✓' : ''}
                        </span>
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
