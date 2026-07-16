const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const MAX_EMOJI = 24;

const emojiInput = document.getElementById("emojiInput");
const sizeInput = document.getElementById("sizeInput");
const grid = document.getElementById("emojiGrid");
const downloadAll = document.getElementById("downloadAll");

/* Split a string into grapheme clusters so multi-codepoint emoji
   (skin tones, flags, ZWJ sequences) stay intact. */
function graphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(text)].map((s) => s.segment);
  }
  return [...text];
}

function clampedSize() {
  const n = Number(sizeInput.value);
  if (!Number.isFinite(n)) return 300;
  return Math.min(1024, Math.max(32, Math.round(n)));
}

/* Draw one emoji centred on a transparent square canvas. */
function renderEmoji(emoji, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const setFont = (px) => { ctx.font = `${px}px ${EMOJI_FONTS}`; };
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Measure at a base size, then scale so the glyph fits inside the canvas
  // with a small margin. Emoji fonts differ in how much of the em box they use.
  const base = size * 0.75;
  setFont(base);
  let m = ctx.measureText(emoji);
  const w = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0);
  const h = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
  const target = size * 0.94;
  const scale = w > 0 && h > 0 ? Math.min(target / w, target / h) : 1;

  setFont(base * scale);
  m = ctx.measureText(emoji);
  const x = size / 2 + ((m.actualBoundingBoxLeft || 0) - (m.actualBoundingBoxRight || 0)) / 2;
  const y = size / 2 + ((m.actualBoundingBoxAscent || 0) - (m.actualBoundingBoxDescent || 0)) / 2;
  ctx.fillText(emoji, x, y);
  return canvas;
}

function filenameFor(emoji, size) {
  const codes = [...emoji].map((ch) => ch.codePointAt(0).toString(16)).join("-");
  return `emoji-${codes}-${size}.png`;
}

function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 250);
    }, "image/png");
  });
}

let cards = [];

function rebuild() {
  const size = clampedSize();
  const items = graphemes(emojiInput.value).filter((g) => g.trim().length > 0);
  const shown = items.slice(0, MAX_EMOJI);

  grid.textContent = "";
  cards = [];

  for (const emoji of shown) {
    const canvas = renderEmoji(emoji, size);

    const card = document.createElement("figure");
    card.className = "emoji-card";

    const preview = document.createElement("div");
    preview.className = "emoji-preview";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${emoji} rendered at ${size} by ${size} pixels`);
    preview.appendChild(canvas);

    const caption = document.createElement("figcaption");
    caption.className = "emoji-caption";
    caption.textContent = `${size} × ${size}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button emoji-download";
    button.textContent = "Download PNG";
    button.addEventListener("click", () => downloadCanvas(canvas, filenameFor(emoji, size)));

    card.append(preview, caption, button);
    grid.appendChild(card);
    cards.push({ canvas, emoji, size });
  }

  if (items.length > MAX_EMOJI) {
    const note = document.createElement("p");
    note.className = "emoji-hint";
    note.textContent = `Showing the first ${MAX_EMOJI} — remove some to see the rest.`;
    grid.appendChild(note);
  }

  downloadAll.hidden = cards.length < 2;
}

downloadAll.addEventListener("click", async () => {
  for (const { canvas, emoji, size } of cards) {
    await downloadCanvas(canvas, filenameFor(emoji, size));
  }
});

emojiInput.addEventListener("input", rebuild);
sizeInput.addEventListener("input", rebuild);

/* Emoji fonts can load lazily; re-render once fonts are ready so the
   first paint isn't stuck with a fallback glyph. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(rebuild);
}

rebuild();
