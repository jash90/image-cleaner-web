// Watermark removal via classical inpainting (no AI).
//
// Primary path: OpenCV Telea inpainting (cv.inpaint) when the loaded build
// exposes the `photo` module. Fallback: a pure-JS diffusion fill (solves a
// Laplace equation over the masked rectangle with the surrounding pixels as
// the boundary). Both only propagate existing pixels inward — they cannot
// invent texture, so results are best on small/thin marks over smooth areas.

import type { WatermarkRegion } from '$lib/types/watermark';
import {
  decodeToImageData,
  imageDataToCanvas,
  canvasToBlob,
  clampRegion,
} from './canvas';
import { tryLoadCv } from './opencv-loader';

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  hasAlpha: boolean;
}

const INPAINT_RADIUS = 3;

// The pure-JS fallback runs on the main thread at O(iterations * area), so it
// is bounded twice: regions above MAX_FALLBACK_AREA are rejected outright, and
// the iteration count is capped so total work stays near FALLBACK_WORK_BUDGET
// pixel updates (a larger hole gets fewer, coarser passes instead of a freeze).
export const MAX_FALLBACK_AREA = 1_000_000;
const FALLBACK_WORK_BUDGET = 150_000_000;

export async function removeWatermark(
  source: Blob,
  region: WatermarkRegion,
  opts: { lossless: boolean }
): Promise<ProcessedImage> {
  const { imageData, width, height } = await decodeToImageData(source);
  const rect = clampRegion(region, width, height);

  const cv = await tryLoadCv();
  if (cv && typeof cv.inpaint === 'function') {
    inpaintWithOpenCv(cv, imageData, rect);
  } else {
    if (rect.width * rect.height > MAX_FALLBACK_AREA) {
      throw new Error(
        `Selected region is too large to inpaint in the browser (max ${MAX_FALLBACK_AREA.toLocaleString('en-US')} px). Select a smaller area around the watermark.`
      );
    }
    diffusionInpaint(imageData, rect);
  }

  const canvas = imageDataToCanvas(imageData);
  const type = opts.lossless ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, type, opts.lossless ? undefined : 0.92);
  return { blob, width, height, hasAlpha: false };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inpaintWithOpenCv(cv: any, imageData: ImageData, rect: WatermarkRegion): void {
  const src = cv.matFromImageData(imageData);
  const rgb = new cv.Mat();
  const mask = cv.Mat.zeros(imageData.height, imageData.width, cv.CV_8UC1);
  const dst = new cv.Mat();
  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    // White rectangle = area to inpaint.
    const p1 = new cv.Point(rect.x, rect.y);
    const p2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
    cv.rectangle(mask, p1, p2, new cv.Scalar(255), -1);

    cv.inpaint(rgb, mask, dst, INPAINT_RADIUS, cv.INPAINT_TELEA);

    const rgba = new cv.Mat();
    try {
      cv.cvtColor(dst, rgba, cv.COLOR_RGB2RGBA);
      const out = new ImageData(
        new Uint8ClampedArray(rgba.data),
        imageData.width,
        imageData.height
      );
      imageData.data.set(out.data);
    } finally {
      rgba.delete();
    }
  } finally {
    src.delete();
    rgb.delete();
    mask.delete();
    dst.delete();
  }
}

// --- Pure-JS fallback -------------------------------------------------------

/**
 * Fill the rectangle by iterative diffusion (Jacobi relaxation) so the hole
 * blends smoothly into the surrounding pixels. Operates on the region's
 * bounding box plus a 1px border of known pixels (the Dirichlet boundary).
 */
function diffusionInpaint(imageData: ImageData, rect: WatermarkRegion): void {
  const { width, height, data } = imageData;

  // Box covering the hole plus one known-pixel border, clamped to the image.
  const x0 = Math.max(0, rect.x - 1);
  const y0 = Math.max(0, rect.y - 1);
  const x1 = Math.min(width, rect.x + rect.width + 1);
  const y1 = Math.min(height, rect.y + rect.height + 1);
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;

  const n = bw * bh;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  const hole = new Uint8Array(n);

  // Seed value: mean of the known pixels in the box (speeds up convergence).
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let known = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const px = x0 + bx;
      const py = y0 + by;
      const li = by * bw + bx;
      const isHole =
        px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height;
      const si = (py * width + px) * 4;
      if (isHole) {
        hole[li] = 1;
      } else {
        const cr = data[si];
        const cg = data[si + 1];
        const cb = data[si + 2];
        r[li] = cr;
        g[li] = cg;
        b[li] = cb;
        sr += cr;
        sg += cg;
        sb += cb;
        known++;
      }
    }
  }
  if (known === 0) return; // nothing to diffuse from
  const mr = sr / known;
  const mg = sg / known;
  const mb = sb / known;
  for (let i = 0; i < n; i++) {
    if (hole[i]) {
      r[i] = mr;
      g[i] = mg;
      b[i] = mb;
    }
  }

  // Jacobi iterations: each hole pixel becomes the average of its 4 neighbours.
  const maxDim = Math.max(rect.width, rect.height);
  const holeArea = Math.max(1, rect.width * rect.height);
  const iterations = Math.max(
    1,
    Math.min(600, Math.max(60, maxDim * 2), Math.floor(FALLBACK_WORK_BUDGET / holeArea))
  );
  const nr = new Float32Array(r);
  const ng = new Float32Array(g);
  const nb = new Float32Array(b);

  const avg = (arr: Float32Array, bx: number, by: number, li: number): number => {
    let sum = 0;
    let cnt = 0;
    if (bx > 0) {
      sum += arr[li - 1];
      cnt++;
    }
    if (bx < bw - 1) {
      sum += arr[li + 1];
      cnt++;
    }
    if (by > 0) {
      sum += arr[li - bw];
      cnt++;
    }
    if (by < bh - 1) {
      sum += arr[li + bw];
      cnt++;
    }
    return cnt ? sum / cnt : arr[li];
  };

  for (let it = 0; it < iterations; it++) {
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const li = by * bw + bx;
        if (!hole[li]) continue;
        nr[li] = avg(r, bx, by, li);
        ng[li] = avg(g, bx, by, li);
        nb[li] = avg(b, bx, by, li);
      }
    }
    // Copy updated hole values back into the working buffers.
    for (let i = 0; i < n; i++) {
      if (hole[i]) {
        r[i] = nr[i];
        g[i] = ng[i];
        b[i] = nb[i];
      }
    }
  }

  // Write the filled hole back to the image.
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const li = by * bw + bx;
      if (!hole[li]) continue;
      const si = ((y0 + by) * width + (x0 + bx)) * 4;
      data[si] = Math.round(r[li]);
      data[si + 1] = Math.round(g[li]);
      data[si + 2] = Math.round(b[li]);
      data[si + 3] = 255;
    }
  }
}
