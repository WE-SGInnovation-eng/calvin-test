# Cutout — free, browser-native background remover

Drop in a photo, get a transparent PNG. The segmentation model
([ISNet](https://github.com/xuebinqin/DIS), via
[`@imgly/background-removal`](https://github.com/imgly/background-removal-js))
runs entirely in the visitor's browser — no server, no upload, no per-image
cost. See [DESIGN.md](DESIGN.md) for the full architecture rationale.

## Run locally

Any static file server works (ES modules won't load from `file://`):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy for free

The site is three static files (`index.html`, `styles.css`, `app.js`), so any
free static host works:

- **GitHub Pages** — repo Settings → Pages → deploy from branch. Model weights
  are fetched from IMG.LY's CDN at runtime, so the 100 MB file cap is irrelevant.
- **Cloudflare Pages / Netlify / Vercel** — point at the repo, no build step.

## Notes

- The first run downloads the model (~40 MB); browsers cache it afterwards.
- `@imgly/background-removal` is loaded from jsDelivr. Pinned to major
  version 1 — check the package's licence terms before commercial use.
