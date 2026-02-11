/**
 * Resize an image to create a thumbnail.
 * Also returns the original dimensions.
 */
export async function processImage(
  file: File
): Promise<{ blob: Blob; thumbnail: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Full-size: compress to WebP (saves storage)
  const fullCanvas = new OffscreenCanvas(width, height);
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.drawImage(bitmap, 0, 0);
  const blob = await fullCanvas.convertToBlob({ type: 'image/webp', quality: 0.85 });

  // Thumbnail: max 400px on longest side
  const maxThumb = 400;
  const scale = Math.min(maxThumb / width, maxThumb / height, 1);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  const thumbCanvas = new OffscreenCanvas(tw, th);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(bitmap, 0, 0, tw, th);
  const thumbnail = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: 0.7 });

  bitmap.close();
  return { blob, thumbnail, width, height };
}
