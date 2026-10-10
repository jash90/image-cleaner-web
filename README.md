# Image Cleaner

Remove **watermarks** and **backgrounds** from images right in your browser — using
classical computer vision, **no AI**. There is no server, no upload, no account and no
API key: the image never leaves your device.

## Tech Stack

- **Frontend** — Svelte 5 + SvelteKit + TypeScript + Vite (static SPA)
- **Processing** — HTML Canvas + [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) (WASM, lazy-loaded)
- **Deployment** — Vercel (pure static output)

## Features

- 🖌️ **Watermark removal** — draw a box over the mark; the area is filled by inpainting.
- ✂️ **Background removal** — keep the subject, drop the background; exports a transparent PNG.
- Drag & drop upload (PNG, JPEG, WebP, GIF)
- Batch processing (sequential or parallel)
- Before/after comparison (slider, side-by-side, overlay) with zoom
- Everything runs locally — fully private and free

## How it works (no AI)

Two classical techniques do the work, both running client-side:

### Watermark removal — inpainting
The selected rectangle is filled by **inpainting**: OpenCV's Telea algorithm
(`cv.inpaint`) when the loaded build exposes the `photo` module, otherwise a pure-JS
**diffusion fill** (a Laplace solve that propagates the surrounding pixels inward).

### Background removal
- **GrabCut** (default) — OpenCV's graph-cut + colour-model segmentation, seeded by the
  box you draw around the **subject to keep**. Best for complex scenes.
- **Colour key** — a flood fill from the image edges that removes a uniform background
  within an adjustable tolerance. Best for solid/studio backgrounds; needs no box.

Both produce a transparent PNG, with an optional edge **feather** to soften the cut.

> **A note on quality.** Classical inpainting *propagates* nearby pixels — it does not
> *generate* new content the way a generative AI model would. It works best on small or
> thin watermarks over relatively smooth areas and will smear on large marks over busy
> detail. The trade-off buys you privacy, zero cost, no API key, and instant offline use.

## Quick Start

### Prerequisites

- Node.js >= 18

### Installation

```bash
npm run install:all   # installs the frontend
```

### Development

```bash
npm run dev           # start the app (http://localhost:5173)
```

OpenCV.js (~10 MB) is **self-hosted** in `frontend/static/opencv.js` and lazily loaded
from the same origin on first use — no third-party CDN, version-pinned with the app, and
fully offline-capable. The first run does a one-time WASM compile (a brief pause shown
with a spinner); everything after is instant.

### Build

```bash
npm run build         # static output in frontend/build
npm run preview       # preview the production build
```

## Project Structure

```text
├── frontend/                      # Svelte 5 + SvelteKit static SPA
│   └── src/
│       ├── lib/
│       │   ├── components/        # UI components
│       │   ├── processing/        # client-side image processing
│       │   │   ├── opencv-loader.ts   # lazy OpenCV.js loader
│       │   │   ├── watermark.ts       # Telea / diffusion inpainting
│       │   │   ├── background.ts      # GrabCut + colour-key
│       │   │   ├── canvas.ts          # Canvas/ImageData helpers
│       │   │   └── processor.ts       # facade used by the UI
│       │   ├── stores/            # Svelte 5 runes state
│       │   └── types/             # TypeScript types
│       └── routes/                # SvelteKit pages
├── vercel.json                    # static deployment config
└── package.json                   # frontend wrapper scripts
```

## License

MIT
