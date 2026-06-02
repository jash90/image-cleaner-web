// Lazy loader for OpenCV.js (classical computer vision, WASM). No AI.
//
// OpenCV powers GrabCut (background segmentation) and, when the build exposes
// the `photo` module, Telea inpainting for watermarks. Every consumer must
// feature-detect the function it needs and fall back to a pure-JS path, because
// the default OpenCV.js builds frequently omit `cv.inpaint`.

import { base } from '$app/paths';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cv = any;

// Self-hosted official OpenCV.js 4.10.0 (emscripten build) shipped from
// frontend/static/. Loading it same-origin — rather than from a CDN — pins the
// exact bytes alongside the app (no SRI / supply-chain risk), keeps the tool
// fully offline-capable, and avoids leaking the user's IP to a third party,
// which matters for an app whose whole promise is "nothing leaves your device".
// To upgrade: replace frontend/static/opencv.js and bump this version note.
const OPENCV_URL = `${base}/opencv.js`;
const SCRIPT_ID = 'opencv-js';
const READY_TIMEOUT_MS = 60_000;

let cvPromise: Promise<Cv> | null = null;

function getGlobal(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function isReady(cv: unknown): cv is Cv {
  return !!cv && typeof (cv as Cv).Mat === 'function';
}

/** Load OpenCV.js once; resolves with the initialised `cv` namespace. */
export function loadCv(): Promise<Cv> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise<Cv>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('OpenCV.js can only be loaded in a browser'));
      return;
    }

    const g = getGlobal();

    const settle = () => {
      const cv = g.cv;
      // Some bundler builds assign a Promise to `cv`; the official build does not.
      if (cv && typeof (cv as { then?: unknown }).then === 'function') {
        (cv as Promise<Cv>).then(resolve).catch(reject);
        return true;
      }
      if (isReady(cv)) {
        resolve(cv);
        return true;
      }
      return false;
    };

    if (settle()) return;

    const start = Date.now();
    const poll = () => {
      if (settle()) return;
      if (Date.now() - start > READY_TIMEOUT_MS) {
        cvPromise = null;
        reject(new Error('OpenCV.js failed to initialise in time'));
        return;
      }
      setTimeout(poll, 50);
    };

    const onError = () => {
      cvPromise = null;
      reject(new Error('Failed to download OpenCV.js'));
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', poll);
      existing.addEventListener('error', onError);
      poll();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = poll;
    script.onerror = onError;
    document.head.appendChild(script);
  });

  return cvPromise;
}

/** Try to load OpenCV.js, returning null instead of throwing if it is unavailable. */
export async function tryLoadCv(): Promise<Cv | null> {
  try {
    return await loadCv();
  } catch {
    return null;
  }
}
