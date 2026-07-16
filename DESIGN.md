# Design: Free-to-Host Image Background Remover

## Goal

A web app where a user drops in an image, the background is removed automatically, and they download a transparent PNG — hosted entirely on free-tier infrastructure with no per-image cost.

## The key design decision: where does inference run?

Background removal is an ML task (salient-object segmentation). There are three places the model can run, and the choice drives everything else:

| Approach | How | Free-tier viability | Trade-offs |
|---|---|---|---|
| **A. In the browser (recommended)** | Ship a segmentation model as ONNX weights; run it client-side with WebGPU/WASM | Excellent — the site is fully static, so any free static host works and compute scales with your users, not your bill | First load downloads ~40–170 MB of model weights; slow on low-end devices |
| B. Serverless/free GPU-ish backend | Python `rembg` on a Hugging Face Space (Gradio) or a free-tier container (Render, Fly.io) | Workable for demos | Cold starts, CPU-only free tiers are slow (5–20 s/image), free containers sleep or have monthly caps |
| C. Third-party API | remove.bg or similar | Very limited | ~50 free preview-resolution images/month; not really "free hosting" |

**Recommendation: Option A — fully client-side.** It is genuinely free at any scale, has no server to maintain, and is better for privacy (images never leave the user's device — a strong selling point to put on the page).

## Architecture (Option A)

```
┌─────────────────────────── Static host (free) ───────────────────────────┐
│  index.html + app.js (UI)                                                │
│    │                                                                     │
│    ▼                                                                     │
│  Inference layer: onnxruntime-web (WebGPU, falling back to WASM)         │
│    │        model weights fetched from Hugging Face CDN + cached         │
│    ▼        via Cache API / service worker                               │
│  Post-processing: mask → alpha channel compositing on <canvas>           │
│    ▼                                                                     │
│  Export: canvas.toBlob('image/png') → download                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Components

1. **UI** — drag-and-drop zone + file picker, progress indicator during model
   download/inference, before/after preview (a slider is a nice touch), and a
   "Download PNG" button. Plain HTML/CSS/JS or a small Vite + React/Svelte app.

2. **Inference layer** — two sensible routes:
   - **Easiest:** the [`@imgly/background-removal`](https://www.npmjs.com/package/@imgly/background-removal)
     npm package. It bundles model, pre/post-processing and ONNX Runtime;
     usage is essentially `removeBackground(file).then(blob => …)`.
     *Check its current licence terms before shipping (it has commercial/attribution conditions).*
   - **More control:** `onnxruntime-web` (or Transformers.js) with a model you choose:
     - **U²-Net / u2netp** — Apache-2.0, small (u2netp ≈ 4.7 MB), decent quality.
     - **ISNet (DIS)** — Apache-2.0, better edges, ~170 MB (quantised versions are far smaller).
     - **BRIA RMBG-1.4 / 2.0** — best quality of the open weights, but
       **non-commercial licence** — fine for a personal tool, not for a product.
     - **MODNet** — good for portraits specifically.

3. **Processing pipeline**
   1. Decode the image to an offscreen canvas.
   2. Resize/letterbox to the model's input size (e.g. 1024×1024 for ISNet, 320×320 for u2netp) and normalise to a float tensor.
   3. Run the model → single-channel saliency/alpha mask.
   4. Resize the mask back to the original resolution (bilinear).
   5. Optional refinement: threshold softly / feather edges (small Gaussian blur on the mask) to avoid jagged cut-outs.
   6. Composite: write the mask into the alpha channel of the original image data.
   7. Export as PNG (or WebP for smaller files).

4. **Model delivery & caching** — GitHub Pages caps individual files at 100 MB,
   so don't commit large weights to the repo. Fetch them at runtime from the
   Hugging Face CDN (CORS-enabled) or host them on Cloudflare Pages/R2 (free
   tier, no 100 MB file cap on R2). Cache with the Cache API so the download
   happens once per device.

5. **Performance** — prefer WebGPU when `navigator.gpu` exists (sub-second on a
   modern laptop), fall back to WASM with SIMD + threads (a few seconds). Run
   inference in a Web Worker so the UI never freezes. Offer a "fast" (u2netp)
   vs "quality" (ISNet) model toggle.

## Free hosting options

- **GitHub Pages** — zero setup from this repo; static only, 100 MB/file limit (fine if weights come from HF CDN).
- **Cloudflare Pages** — generous free tier, 25 MB/file limit on Pages itself but pairs with free R2 for weights; global CDN.
- **Netlify / Vercel free tiers** — equally fine; watch Netlify's 100 GB/month bandwidth cap if the app gets popular (weights served from HF CDN keep your bandwidth tiny).

## Fallback design (Option B, if you want a server anyway)

A Hugging Face Space running Gradio + `rembg` is ~15 lines of Python and gives
you a hosted UI and a free REST API endpoint. Good as a quick prototype or as a
server-side fallback for very old browsers. Limits: CPU-only on the free tier,
cold starts after inactivity.

## MVP build order

1. Static page with drag-and-drop and canvas preview.
2. Integrate `@imgly/background-removal` (or onnxruntime-web + u2netp) — get an end-to-end cut-out working.
3. Move inference into a Web Worker; add progress UI for the model download.
4. Add edge feathering and a before/after slider.
5. Deploy to GitHub Pages / Cloudflare Pages; add service-worker caching for the weights.
6. Optional: quality-model toggle, batch processing, background-colour replacement.

## Known limitations

- First visit downloads model weights (tens of MB) — must be communicated in the UI.
- Quality on fine detail (hair, fur, glass) trails paid APIs like remove.bg.
- Very large images should be downscaled for inference (mask upscaled after) to keep memory in check on mobile.
- Verify model/library licences before any commercial use (RMBG is non-commercial; U²-Net and ISNet are Apache-2.0).
