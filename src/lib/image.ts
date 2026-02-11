/**
 * Maximum dimension for stored photos.
 * Photos larger than this are resized to fit within this limit,
 * significantly reducing storage usage while maintaining good display quality.
 */
const MAX_FULL_SIZE = 1920;

/**
 * Process an image for storage: resize large images and compress to WebP.
 * Also creates a small thumbnail for the grid view.
 */
export async function processImage(
  file: File
): Promise<{ blob: Blob; thumbnail: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Resize if larger than MAX_FULL_SIZE on any side
  const fullScale = Math.min(MAX_FULL_SIZE / width, MAX_FULL_SIZE / height, 1);
  const fw = Math.round(width * fullScale);
  const fh = Math.round(height * fullScale);

  const fullCanvas = new OffscreenCanvas(fw, fh);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.drawImage(bitmap, 0, 0, fw, fh);
  const blob = await fullCanvas.convertToBlob({ type: 'image/webp', quality: 0.75 });

  // Thumbnail: max 300px on longest side
  const maxThumb = 300;
  const thumbScale = Math.min(maxThumb / width, maxThumb / height, 1);
  const tw = Math.round(width * thumbScale);
  const th = Math.round(height * thumbScale);
  const thumbCanvas = new OffscreenCanvas(tw, th);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(bitmap, 0, 0, tw, th);
  const thumbnail = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: 0.6 });

  bitmap.close();
  return { blob, thumbnail, width: fw, height: fh };
}
