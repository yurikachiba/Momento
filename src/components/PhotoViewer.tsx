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
  readOnly?: boolean;
  sharedAlbumId?: string | null;
  activeAlbumId?: string | null;
}

const canShare =
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function';

const PRELOAD_COUNT = 2;
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_DELAY = 300;

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

/** Constrain translate so the image doesn't pan beyond its edges */
function clampTranslate(
  tx: number,
  ty: number,
  scale: number,
  container: HTMLElement | null,
): { x: number; y: number } {
  if (!container || scale <= 1) return { x: 0, y: 0 };
  const rect = container.getBoundingClientRect();
  const maxTx = (rect.width * (scale - 1)) / 2;
  const maxTy = (rect.height * (scale - 1)) / 2;
  return {
    x: clamp(tx, -maxTx, maxTx),
    y: clamp(ty, -maxTy, maxTy),
  };
}

function getTouchDistance(t1: React.Touch, t2: React.Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(t1: React.Touch, t2: React.Touch): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

const PhotoViewer: FC<PhotoViewerProps> = ({
  photos,
  initialIndex,
  albums,
  onClose,
  onDelete,
  onToggleAlbum,
  onUpdateMemo,
  readOnly = false,
  sharedAlbumId = null,
  activeAlbumId = null,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMenu, setShowMenu] = useState(false);
  const [memo, setMemo] = useState('');

  // Swipe navigation state
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const touchMovedRef = useRef(false);
  const skipTransitionRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [zoomTransition, setZoomTransition] = useState(false);

  // Zoom gesture refs
  const lastTapRef = useRef(0);
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartTranslateRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStartTranslateRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);

  // Keep refs in sync with state
  scaleRef.current = scale;
  translateXRef.current = translateX;
  translateYRef.current = translateY;

  const isZoomed = scale > 1.05;

  const photo = photos[currentIndex];

  // Reset zoom
  const resetZoom = useCallback((animate = true) => {
    if (animate) setZoomTransition(true);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    if (animate) setTimeout(() => setZoomTransition(false), 300);
  }, []);

  // Sync memo with current photo and reset zoom
  useEffect(() => {
    setMemo(photo.memo || '');
    resetZoom(false);
  }, [photo.id, photo.memo, resetZoom]);

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
      if (index < 0 || index >= photos.length || isAnimating) return;
      setIsAnimating(true);
      const direction = index > currentIndex ? -1 : 1;
      const width = containerRef.current?.offsetWidth ?? window.innerWidth;
      setOffsetX(direction * width);

      setTimeout(() => {
        skipTransitionRef.current = true;
        setCurrentIndex(index);
        setOffsetX(0);
        setIsAnimating(false);
        requestAnimationFrame(() => {
          skipTransitionRef.current = false;
        });
      }, 250);
    },
    [currentIndex, photos.length, isAnimating]
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
      else if (e.key === 'Escape') {
        if (isZoomed) resetZoom();
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose, isZoomed, resetZoom]);

  // --- Touch handlers ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimating || showMenu) return;

      // Pinch start (2 fingers)
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        isPanningRef.current = false;
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = scaleRef.current;
        pinchStartCenterRef.current = getTouchCenter(e.touches[0], e.touches[1]);
        pinchStartTranslateRef.current = { x: translateXRef.current, y: translateYRef.current };
        return;
      }

      // Single finger
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();

        // Double tap detection
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          lastTapRef.current = 0;
          if (isZoomed) {
            // Zoom out
            resetZoom();
          } else {
            // Zoom in to double-tap point
            setZoomTransition(true);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const cx = touch.clientX - rect.left - rect.width / 2;
              const cy = touch.clientY - rect.top - rect.height / 2;
              // Translate so the tapped point stays roughly centered
              const newTx = -cx * (DOUBLE_TAP_SCALE - 1);
              const newTy = -cy * (DOUBLE_TAP_SCALE - 1);
              const clamped = clampTranslate(newTx, newTy, DOUBLE_TAP_SCALE, containerRef.current);
              setScale(DOUBLE_TAP_SCALE);
              setTranslateX(clamped.x);
              setTranslateY(clamped.y);
            } else {
              setScale(DOUBLE_TAP_SCALE);
            }
            setTimeout(() => setZoomTransition(false), 300);
          }
          return;
        }
        lastTapRef.current = now;

        if (isZoomed) {
          // Start panning
          isPanningRef.current = true;
          panStartRef.current = { x: touch.clientX, y: touch.clientY };
          panStartTranslateRef.current = { x: translateXRef.current, y: translateYRef.current };
        } else {
          // Normal swipe start
          touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
          };
          touchMovedRef.current = false;
          setIsSwiping(false);
        }
      }
    },
    [isAnimating, showMenu, isZoomed, resetZoom]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimating || showMenu) return;

      // Pinch move
      if (isPinchingRef.current && e.touches.length === 2) {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const ratio = dist / pinchStartDistRef.current;
        const newScale = clamp(pinchStartScaleRef.current * ratio, MIN_SCALE, MAX_SCALE);

        // Translate to keep the pinch center stable
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        const dx = center.x - pinchStartCenterRef.current.x;
        const dy = center.y - pinchStartCenterRef.current.y;
        const newTx = pinchStartTranslateRef.current.x + dx;
        const newTy = pinchStartTranslateRef.current.y + dy;
        const clamped = clampTranslate(newTx, newTy, newScale, containerRef.current);

        setScale(newScale);
        setTranslateX(clamped.x);
        setTranslateY(clamped.y);
        return;
      }

      // Pan move (zoomed, single finger)
      if (isPanningRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - panStartRef.current.x;
        const dy = touch.clientY - panStartRef.current.y;
        const newTx = panStartTranslateRef.current.x + dx;
        const newTy = panStartTranslateRef.current.y + dy;
        const clamped = clampTranslate(newTx, newTy, scaleRef.current, containerRef.current);
        setTranslateX(clamped.x);
        setTranslateY(clamped.y);
        return;
      }

      // Normal swipe move (not zoomed)
      if (!touchStartRef.current || isZoomed) return;
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
    [isAnimating, showMenu, isZoomed, currentIndex, photos.length]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Pinch end
      if (isPinchingRef.current) {
        // If remaining touches < 2, end pinch
        if (e.touches.length < 2) {
          isPinchingRef.current = false;
          // Snap to 1 if close
          if (scaleRef.current < 1.1) {
            resetZoom();
          }
        }
        return;
      }

      // Pan end
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }

      // Normal swipe end
      if (!touchStartRef.current || !touchMovedRef.current) {
        touchStartRef.current = null;
        return;
      }

      const width = containerRef.current?.offsetWidth ?? window.innerWidth;
      const elapsed = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(offsetX) / elapsed;

      const threshold = width * 0.3;
      const shouldAdvance = Math.abs(offsetX) > threshold || velocity > 0.3;

      setIsSwiping(false);
      setIsAnimating(true);

      if (shouldAdvance && offsetX < 0 && currentIndex < photos.length - 1) {
        setOffsetX(-width);
        setTimeout(() => {
          skipTransitionRef.current = true;
          setCurrentIndex((i) => i + 1);
          setOffsetX(0);
          setIsAnimating(false);
          requestAnimationFrame(() => {
            skipTransitionRef.current = false;
          });
        }, 250);
      } else if (shouldAdvance && offsetX > 0 && currentIndex > 0) {
        setOffsetX(width);
        setTimeout(() => {
          skipTransitionRef.current = true;
          setCurrentIndex((i) => i - 1);
          setOffsetX(0);
          setIsAnimating(false);
          requestAnimationFrame(() => {
            skipTransitionRef.current = false;
          });
        }, 250);
      } else {
        setOffsetX(0);
        setTimeout(() => {
          setIsAnimating(false);
        }, 250);
      }

      touchStartRef.current = null;
    },
    [offsetX, currentIndex, photos.length, resetZoom]
  );

  // --- Actions ---
  const fetchBlob = async (): Promise<Blob> => {
    // 1. Try direct cross-origin fetch (works when CORS headers present)
    try {
      const res = await fetch(photo.url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return blob;
      }
    } catch {
      // CORS or network error – fall through
    }

    // 2. Fallback: fetch via server download proxy (reliable in PWA)
    const token = localStorage.getItem('momento-token');
    const downloadUrl = readOnly && sharedAlbumId
      ? `/api/shared-albums/${sharedAlbumId}/photos/${photo.id}/download`
      : `/api/photos/${photo.id}/download`;
    const res = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('download failed');
    return res.blob();
  };

  const handleSave = async () => {
    try {
      const blob = await fetchBlob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const filename = `${photo.name || 'photo'}.${ext}`;
      const file = new File([blob], filename, {
        type: blob.type || 'image/jpeg',
      });

      // On mobile (iOS/Android), use Share API for reliable save-to-device
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          // Share failed, fall through to download link
        }
      }

      // Desktop / non-Share fallback: download via blob URL
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // Last resort: open original URL
      window.open(photo.url, '_blank');
    }
  };

  const handleShare = async () => {
    // Try sharing as a file first
    try {
      const blob = await fetchBlob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const file = new File([blob], `${photo.name || 'photo'}.${ext}`, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }

    // Fallback: share URL
    try {
      await navigator.share({ title: photo.name, url: photo.url });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Final fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(photo.url);
      } catch {
        // Clipboard API unavailable
      }
    }
  };

  const handleMemoBlur = () => {
    if (!readOnly && memo !== (photo.memo || '')) {
      onUpdateMemo(photo.id, memo);
    }
  };

  const handleZoomToggle = () => {
    if (isZoomed) {
      resetZoom();
    } else {
      setZoomTransition(true);
      setScale(DOUBLE_TAP_SCALE);
      setTranslateX(0);
      setTranslateY(0);
      setTimeout(() => setZoomTransition(false), 300);
    }
  };

  const prevUrl = currentIndex > 0 ? photos[currentIndex - 1].url : null;
  const nextUrl =
    currentIndex < photos.length - 1 ? photos[currentIndex + 1].url : null;

  const zoomPercent = Math.round(scale * 100);

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
            {!readOnly && (
              <button
                className="btn-icon"
                onClick={() => setShowMenu(!showMenu)}
                aria-label="メニュー"
              >
                ⋯
              </button>
            )}
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
              transform: isZoomed ? 'none' : `translateX(${offsetX}px)`,
              transition:
                isSwiping || skipTransitionRef.current
                  ? 'none'
                  : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {!isZoomed && (
              <div className="viewer-slide viewer-slide-prev">
                {prevUrl && <img src={prevUrl} alt="" className="viewer-image" />}
              </div>
            )}
            <div className="viewer-slide viewer-slide-current">
              <img
                src={photo.url}
                alt={photo.name}
                className="viewer-image"
                style={{
                  transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
                  transition: zoomTransition
                    ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    : 'none',
                  willChange: isZoomed ? 'transform' : 'auto',
                }}
              />
            </div>
            {!isZoomed && (
              <div className="viewer-slide viewer-slide-next">
                {nextUrl && <img src={nextUrl} alt="" className="viewer-image" />}
              </div>
            )}
          </div>

          {!isZoomed && currentIndex > 0 && (
            <button
              className="viewer-arrow viewer-arrow-left"
              onClick={goPrev}
              aria-label="前の写真"
            >
              ‹
            </button>
          )}
          {!isZoomed && currentIndex < photos.length - 1 && (
            <button
              className="viewer-arrow viewer-arrow-right"
              onClick={goNext}
              aria-label="次の写真"
            >
              ›
            </button>
          )}

          {isZoomed && (
            <div className="viewer-zoom-badge">{zoomPercent}%</div>
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
          <button
            className={`viewer-action-btn${isZoomed ? ' viewer-action-btn-active' : ''}`}
            onClick={handleZoomToggle}
          >
            <span className="viewer-action-icon">{isZoomed ? '🔍' : '🔎'}</span>
            {isZoomed ? 'フィット' : '拡大'}
          </button>
        </div>

        {showMenu && !readOnly && (
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
                <p className="viewer-menu-label">{activeAlbumId ? '他のアルバムに追加' : 'アルバムに追加'}</p>
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
