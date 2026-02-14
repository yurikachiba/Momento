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
  readOnly = false,
  sharedAlbumId = null,
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
  const skipTransitionRef = useRef(false);
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
  }, [offsetX, currentIndex, photos.length]);

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
              transform: `translateX(${offsetX}px)`,
              transition:
                isSwiping || skipTransitionRef.current
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
