/**
 * Storage mode determines how aggressively images are compressed.
 * - 'standard': Good quality, moderate storage (1280px, quality 0.6)
 * - 'saver': Lower quality, minimal storage (480px, quality 0.5)
 */
export type StorageMode = 'standard' | 'saver';

const STORAGE_MODE_KEY = 'momento-storage-mode';

export function getStorageMode(): StorageMode {
  const v = localStorage.getItem(STORAGE_MODE_KEY);
  if (v === 'saver') return 'saver';
  return 'standard';
}

export function setStorageMode(mode: StorageMode): void {
  localStorage.setItem(STORAGE_MODE_KEY, mode);
}

interface ImageConfig {
  maxFull: number;
  fullQuality: number;
  maxThumb: number;
  thumbQuality: number;
}

const CONFIGS: Record<StorageMode, ImageConfig> = {
  standard: { maxFull: 1280, fullQuality: 0.6, maxThumb: 200, thumbQuality: 0.4 },
  saver:    { maxFull: 480,  fullQuality: 0.5, maxThumb: 200, thumbQuality: 0.4 },
};

/**
 * Process an image for storage: resize and compress to WebP.
 * Also creates a small thumbnail for the grid view.
 * Uses the current storage mode settings.
 */
export async function processImage(
  file: File
): Promise<{ blob: Blob; thumbnail: Blob; width: number; height: number }> {
  return processImageWithConfig(file, CONFIGS[getStorageMode()]);
}

/**
 * Re-process an existing image blob with given config.
 * Used by the re-compression utility.
 */
export async function reprocessBlob(
  blob: Blob
): Promise<{ blob: Blob; thumbnail: Blob; width: number; height: number }> {
  const config = CONFIGS[getStorageMode()];
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  const fullScale = Math.min(config.maxFull / width, config.maxFull / height, 1);
  const fw = Math.round(width * fullScale);
  const fh = Math.round(height * fullScale);

  const fullCanvas = new OffscreenCanvas(fw, fh);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.drawImage(bitmap, 0, 0, fw, fh);
  const newBlob = await fullCanvas.convertToBlob({ type: 'image/webp', quality: config.fullQuality });

  const thumbScale = Math.min(config.maxThumb / width, config.maxThumb / height, 1);
  const tw = Math.round(width * thumbScale);
  const th = Math.round(height * thumbScale);
  const thumbCanvas = new OffscreenCanvas(tw, th);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(bitmap, 0, 0, tw, th);
  const thumbnail = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: config.thumbQuality });

  bitmap.close();
  return { blob: newBlob, thumbnail, width: fw, height: fh };
}

async function processImageWithConfig(
  file: File,
  config: ImageConfig
): Promise<{ blob: Blob; thumbnail: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Resize if larger than max on any side
  const fullScale = Math.min(config.maxFull / width, config.maxFull / height, 1);
  const fw = Math.round(width * fullScale);
  const fh = Math.round(height * fullScale);

  const fullCanvas = new OffscreenCanvas(fw, fh);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.drawImage(bitmap, 0, 0, fw, fh);
  const blob = await fullCanvas.convertToBlob({ type: 'image/webp', quality: config.fullQuality });

  // Thumbnail
  const thumbScale = Math.min(config.maxThumb / width, config.maxThumb / height, 1);
  const tw = Math.round(width * thumbScale);
  const th = Math.round(height * thumbScale);
  const thumbCanvas = new OffscreenCanvas(tw, th);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(bitmap, 0, 0, tw, th);
  const thumbnail = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: config.thumbQuality });

  bitmap.close();
  return { blob, thumbnail, width: fw, height: fh };
}
