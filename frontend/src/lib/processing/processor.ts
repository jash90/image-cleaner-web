// Facade for in-browser image processing — the client-side replacement for the
// old REST API client. Everything runs locally; nothing is uploaded.

import type {
  WatermarkRegion,
  ProcessResult,
  ProcessMode,
  BackgroundOptions,
} from '$lib/types/watermark';
import { removeWatermark } from './watermark';
import { removeBackground } from './background';

export interface ProcessParams {
  lossless: boolean;
  bgOptions: BackgroundOptions;
}

let counter = 0;

export async function processImage(
  file: File,
  mode: ProcessMode,
  region: WatermarkRegion | null,
  params: ProcessParams
): Promise<ProcessResult> {
  const start = performance.now();

  const out =
    mode === 'watermark'
      ? await removeWatermark(file, requireRegion(region), { lossless: params.lossless })
      : await removeBackground(file, region, params.bgOptions);

  const blobUrl = URL.createObjectURL(out.blob);
  const base = file.name.replace(/\.[^.]+$/, '');
  const ext = out.blob.type === 'image/png' ? 'png' : 'jpg';
  const suffix = mode === 'watermark' ? 'cleaned' : 'no-bg';

  return {
    id: `${Date.now()}-${counter++}`,
    originalFilename: file.name,
    blobUrl,
    blob: out.blob,
    downloadName: `${base}_${suffix}.${ext}`,
    hasAlpha: out.hasAlpha,
    width: out.width,
    height: out.height,
    originalSize: file.size,
    processedSize: out.blob.size,
    processingTimeMs: Math.round(performance.now() - start),
  };
}

function requireRegion(region: WatermarkRegion | null): WatermarkRegion {
  if (!region) throw new Error('Select the watermark region first');
  return region;
}
