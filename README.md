# We. Tools — small browser tools, zero servers

A hub of small creative tools that run entirely in the visitor's browser —
no server, no upload, no per-use cost. Free to host on any static host.

| Path | Tool | What it does |
|---|---|---|
| `/` | Hub | Landing page listing all tools |
| `/cutout/` | Cutout | Removes image backgrounds locally ([ISNet](https://github.com/xuebinqin/DIS) via [`@imgly/background-removal`](https://github.com/imgly/background-removal-js)); exports transparent PNG. See [DESIGN.md](DESIGN.md). |
| `/emoji/` | Emoji PNG | Renders any emoji to a transparent PNG (default 300×300) using the device's own emoji font — Apple Color Emoji on Mac/iOS — so no copyrighted artwork is redistributed. |
| `/storyboard/` | Storyboard AI | Generates full video storyboards (strategy, shot list, AI frames) with Google Gemini. Built from `storyboard-src/` (React + Vite); users supply their own Gemini API key at runtime, stored in localStorage — no key is baked into the bundle. |

## Rebuilding Storyboard AI

`/storyboard/` is the committed build output of `storyboard-src/`. After editing the source:

```sh
cd storyboard-src
npm install
npm run build   # writes to ../storyboard
```

Commit both the source change and the regenerated `/storyboard/` output.

## Run locally

Any static file server works (ES modules won't load from `file://`):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy for free

The site is plain static files (one shared `styles.css`, one folder per tool),
so any free static host works:

- **GitHub Pages** — repo Settings → Pages → deploy from branch. Model weights
  are fetched from IMG.LY's CDN at runtime, so the 100 MB file cap is irrelevant.
- **Cloudflare Pages / Netlify / Vercel** — point at the repo, no build step.

## Notes

- The first run downloads the model (~40 MB); browsers cache it afterwards.
- `@imgly/background-removal` is loaded from jsDelivr. Pinned to major
  version 1 — check the package's licence terms before commercial use.
- Typography is [Source Sans 3](https://github.com/adobe-fonts/source-sans)
  (SIL Open Font License 1.1), self-hosted as a variable woff2 in `fonts/` —
  no external font requests.
