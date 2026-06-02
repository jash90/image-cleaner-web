export interface WatermarkRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProcessMode = 'watermark' | 'background';

export type BackgroundMethod = 'grabcut' | 'colorkey';

export interface BackgroundOptions {
  /** grabcut = segment the subject inside the selected box; colorkey = remove a sampled flat colour */
  method: BackgroundMethod;
  /** colorkey: max colour distance (0-255) still treated as background */
  tolerance: number;
  /** edge feather radius in pixels (both methods) */
  feather: number;
}

export interface RemovalOptions {
  /** watermark mode: save as PNG instead of JPEG */
  lossless: boolean;
}

export interface ProcessResult {
  id: string;
  originalFilename: string;
  /** object URL of the processed image blob (for preview + download) */
  blobUrl: string;
  /** the processed image itself */
  blob: Blob;
  /** suggested download filename */
  downloadName: string;
  /** true when the output contains transparency (background removal) */
  hasAlpha: boolean;
  /** output dimensions */
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
  processingTimeMs: number;
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface BatchFile {
  id: string;
  file: File;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: ProcessResult;
}

export interface BatchProgress {
  currentIndex: number;
  totalFiles: number;
  currentFilename: string;
}

export type AppStage =
  | 'upload'
  | 'select'
  | 'processing'
  | 'preview'
  | 'batch-select'
  | 'batch-processing'
  | 'batch-results';
