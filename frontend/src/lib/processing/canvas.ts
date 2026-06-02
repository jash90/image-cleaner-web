// Canvas / ImageData helpers shared by the processing pipeline.

import type { WatermarkRegion } from '$lib/types/watermark';

export interface LoadedImage {
  imageData: ImageData;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

/** Decode a File/Blob (or object URL) into RGBA pixel data. */
export async function decodeToImageData(source: Blob | string): Promise<LoadedImage> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0);
    return { imageData: ctx.getImageData(0, 0, width, height), width, height };
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

/** Render ImageData onto a fresh canvas. */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      type,
      quality
    );
  });
}

/** Clamp a user-drawn region to integer pixel bounds inside the image. */
export function clampRegion(
  region: WatermarkRegion,
  width: number,
  height: number
): WatermarkRegion {
  const x = Math.max(0, Math.min(Math.round(region.x), width - 1));
  const y = Math.max(0, Math.min(Math.round(region.y), height - 1));
  const w = Math.max(1, Math.min(Math.round(region.width), width - x));
  const h = Math.max(1, Math.min(Math.round(region.height), height - y));
  return { x, y, width: w, height: h };
}
