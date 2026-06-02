// Background removal via classical computer vision (no AI). Output is always a
// PNG with an alpha channel.
//
//  - grabcut  : OpenCV GrabCut (graph-cut + colour GMMs) seeded by the selected
//               rectangle = the subject to KEEP. Strong on complex scenes.
//  - colorkey : pure-JS flood fill from the image edges, removing pixels within
//               `tolerance` of the sampled border colour. Great for solid /
//               uniform backgrounds, needs no rectangle and no OpenCV.

import type { WatermarkRegion, BackgroundOptions } from '$lib/types/watermark';
import {
  decodeToImageData,
  imageDataToCanvas,
  canvasToBlob,
  clampRegion,
} from './canvas';
import { tryLoadCv } from './opencv-loader';
import type { ProcessedImage } from './watermark';

// Cap the working resolution of GrabCut for speed; the mask is scaled back up.
const GRABCUT_MAX_DIM = 600;
const GRABCUT_ITERS = 5;

export async function removeBackground(
  source: Blob,
  region: WatermarkRegion | null,
  opts: BackgroundOptions
): Promise<ProcessedImage> {
  const { imageData, width, height } = await decodeToImageData(source);

  let alpha: Float32Array;
  if (opts.method === 'grabcut' && region) {
    const cv = await tryLoadCv();
    if (cv && typeof cv.grabCut === 'function') {
      alpha = grabCutAlpha(cv, imageData, clampRegion(region, width, height));
    } else {
      // GrabCut unavailable in this OpenCV build — fall back to colour key.
      alpha = colorKeyAlpha(imageData, opts.tolerance);
    }
  } else {
    alpha = colorKeyAlpha(imageData, opts.tolerance);
  }

  if (opts.feather > 0) blurAlpha(alpha, width, height, Math.round(opts.feather));
  applyAlpha(imageData, alpha);

  const canvas = imageDataToCanvas(imageData);
  const blob = await canvasToBlob(canvas, 'image/png');
  return { blob, width, height, hasAlpha: true };
}

// --- GrabCut ----------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function grabCutAlpha(cv: any, imageData: ImageData, rect: WatermarkRegion): Float32Array {
  const { width, height } = imageData;
  const scale = Math.min(1, GRABCUT_MAX_DIM / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));

  const src = cv.matFromImageData(imageData);
  const rgb = new cv.Mat();
  const small = new cv.Mat();
  const mask = new cv.Mat();
  const bgdModel = new cv.Mat();
  const fgdModel = new cv.Mat();
  const maskFull = new cv.Mat();
  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.resize(rgb, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);

    // Subject rectangle in the downscaled space, clamped inside the image.
    const rx = Math.max(0, Math.min(Math.round(rect.x * scale), sw - 1));
    const ry = Math.max(0, Math.min(Math.round(rect.y * scale), sh - 1));
    const rw = Math.max(1, Math.min(Math.round(rect.width * scale), sw - rx));
    const rh = Math.max(1, Math.min(Math.round(rect.height * scale), sh - ry));
    const gcRect = new cv.Rect(rx, ry, rw, rh);

    cv.grabCut(small, mask, gcRect, bgdModel, fgdModel, GRABCUT_ITERS, cv.GC_INIT_WITH_RECT);

    // Upscale the label mask back to full resolution (nearest neighbour).
    cv.resize(mask, maskFull, new cv.Size(width, height), 0, 0, cv.INTER_NEAREST);

    const m = maskFull.data as Uint8Array;
    const alpha = new Float32Array(width * height);
    for (let i = 0; i < alpha.length; i++) {
      // Foreground = definite (GC_FGD=1) or probable (GC_PR_FGD=3) foreground.
      alpha[i] = m[i] === cv.GC_FGD || m[i] === cv.GC_PR_FGD ? 255 : 0;
    }
    return alpha;
  } finally {
    src.delete();
    rgb.delete();
    small.delete();
    mask.delete();
    bgdModel.delete();
    fgdModel.delete();
    maskFull.delete();
  }
}

// --- Colour-key flood fill --------------------------------------------------

/**
 * Sample the border colour, then flood-fill from every edge pixel, removing
 * connected pixels within `tolerance` of it. Connectivity preserves
 * similarly-coloured regions that are inside the subject.
 */
function colorKeyAlpha(imageData: ImageData, tolerance: number): Float32Array {
  const { width, height, data } = imageData;
  const n = width * height;

  // Mean colour of the 1px border ring = the background reference.
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;
  const sampleEdge = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    br += data[i];
    bg += data[i + 1];
    bb += data[i + 2];
    count++;
  };
  for (let x = 0; x < width; x++) {
    sampleEdge(x, 0);
    sampleEdge(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sampleEdge(0, y);
    sampleEdge(width - 1, y);
  }
  br /= count;
  bg /= count;
  bb /= count;

  const tol2 = tolerance * tolerance * 3; // squared distance budget across 3 channels
  const close = (i: number): boolean => {
    const o = i * 4;
    const dr = data[o] - br;
    const dg = data[o + 1] - bg;
    const db = data[o + 2] - bb;
    return dr * dr + dg * dg + db * db <= tol2;
  };

  const alpha = new Float32Array(n).fill(255);
  const visited = new Uint8Array(n);
  const stack: number[] = [];

  const pushSeed = (i: number) => {
    if (!visited[i] && close(i)) {
      visited[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    pushSeed(x);
    pushSeed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pushSeed(y * width);
    pushSeed(y * width + width - 1);
  }

  while (stack.length) {
    const i = stack.pop() as number;
    alpha[i] = 0;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) pushSeed(i - 1);
    if (x < width - 1) pushSeed(i + 1);
    if (y > 0) pushSeed(i - width);
    if (y < height - 1) pushSeed(i + width);
  }

  return alpha;
}

// --- Shared helpers ---------------------------------------------------------

/** Separable box blur of the alpha mask to soften hard cut edges. */
function blurAlpha(alpha: Float32Array, width: number, height: number, radius: number): void {
  if (radius < 1) return;
  const tmp = new Float32Array(alpha.length);
  const win = radius * 2 + 1;

  // Horizontal pass.
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.max(0, Math.min(width - 1, x + k));
        sum += alpha[row + xx];
      }
      tmp[row + x] = sum / win;
    }
  }
  // Vertical pass.
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.max(0, Math.min(height - 1, y + k));
        sum += tmp[yy * width + x];
      }
      alpha[y * width + x] = sum / win;
    }
  }
}

function applyAlpha(imageData: ImageData, alpha: Float32Array): void {
  const { data } = imageData;
  for (let i = 0; i < alpha.length; i++) {
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(255, alpha[i])));
  }
}
