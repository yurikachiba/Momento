import {
  type FC,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { Photo, Album } from '../types/photo';

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  albums: Album[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleAlbum: (photoId: string, albumId: string) => void;
}

const canShare =
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function';

/** Number of photos to preload in each direction */
const PRELOAD_COUNT = 2;

const PhotoViewer: FC<PhotoViewerProps> = ({
  photos,
  initialIndex,
  albums,
  onClose,
  onDelete,
  onToggleAlbum,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMenu, setShowMenu] = useState(false);

  // --- Swipe state ---
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const touchMovedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const photo = photos[currentIndex];

  // --- Preload cache: Map<photoId, objectURL> ---
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  /** Get or create an object URL for a photo blob */
  const getUrl = useCallback((p: Photo): string => {
    const cache = urlCacheRef.current;
    let url = cache.get(p.id);
    if (!url) {
      url = URL.createObjectURL(p.blob);
      cache.set(p.id, url);
    }
    return url;
  }, []);

  /** Preload photos around the current index */
  useEffect(() => {
    const start = Math.max(0, currentIndex - PRELOAD_COUNT);
    const end = Math.min(photos.length - 1, currentIndex + PRELOAD_COUNT);

    // Preload by creating object URLs + triggering browser image decode
    for (let i = start; i <= end; i++) {
      const p = photos[i];
      const url = getUrl(p);
      // Trigger browser decode for off-screen images
      if (i !== currentIndex) {
        const img = new Image();
        img.src = url;
      }
    }

    // Evict URLs that are far from the current view
    const cache = urlCacheRef.current;
    const activeIds = new Set(
      photos.slice(start, end + 1).map((p) => p.id)
    );
    for (const [id, url] of cache) {
      if (!activeIds.has(id)) {
        URL.revokeObjectURL(url);
        cache.delete(id);
      }
    }
  }, [currentIndex, photos, getUrl]);

  // Cleanup all URLs on unmount
  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
    };
  }, []);

  const currentUrl = useMemo(() => getUrl(photo), [photo, getUrl]);

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
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
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

      // If vertical movement is dominant, don't swipe
      if (!touchMovedRef.current && Math.abs(dy) > Math.abs(dx)) {
        touchStartRef.current = null;
        return;
      }

      touchMovedRef.current = true;
      setIsSwiping(true);

      // Add resistance at edges
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
    const velocity = Math.abs(offsetX) / elapsed; // px/ms

    // Threshold: 30% of width or fast flick (velocity > 0.3 px/ms)
    const threshold = width * 0.3;
    const shouldAdvance =
      Math.abs(offsetX) > threshold || velocity > 0.3;

    if (shouldAdvance && offsetX < 0 && currentIndex < photos.length - 1) {
      // Swipe left → next
      setIsAnimating(true);
      setOffsetX(-width);
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setOffsetX(0);
        setIsAnimating(false);
        setIsSwiping(false);
      }, 250);
    } else if (shouldAdvance && offsetX > 0 && currentIndex > 0) {
      // Swipe right → prev
      setIsAnimating(true);
      setOffsetX(width);
      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setOffsetX(0);
        setIsAnimating(false);
        setIsSwiping(false);
      }, 250);
    } else {
      // Snap back
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
  const handleSave = () => {
    const a = document.createElement('a');
    a.href = currentUrl;
    a.download = `${photo.name}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    const file = new File([photo.blob], `${photo.name}.webp`, {
      type: 'image/webp',
    });
    try {
      await navigator.share({ files: [file] });
    } catch {
      // User cancelled
    }
  };

  // Adjacent photo URLs for the swipe track
  const prevUrl =
    currentIndex > 0 ? getUrl(photos[currentIndex - 1]) : null;
  const nextUrl =
    currentIndex < photos.length - 1
      ? getUrl(photos[currentIndex + 1])
      : null;

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
            {/* Previous image (off-screen left) */}
            <div className="viewer-slide viewer-slide-prev">
              {prevUrl && <img src={prevUrl} alt="" className="viewer-image" />}
            </div>
            {/* Current image */}
            <div className="viewer-slide viewer-slide-current">
              <img src={currentUrl} alt={photo.name} className="viewer-image" />
            </div>
            {/* Next image (off-screen right) */}
            <div className="viewer-slide viewer-slide-next">
              {nextUrl && <img src={nextUrl} alt="" className="viewer-image" />}
            </div>
          </div>

          {/* Arrow buttons (desktop) */}
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
