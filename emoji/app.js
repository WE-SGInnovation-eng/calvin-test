const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const searchInput = document.getElementById("searchInput");
const sizeInput = document.getElementById("sizeInput");
const library = document.getElementById("library");
const emptyNote = document.getElementById("emptyNote");
const toast = document.getElementById("toast");

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
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, "image/png");
}

let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function downloadEmoji(emoji, name) {
  const size = clampedSize();
  downloadCanvas(renderEmoji(emoji, size), filenameFor(emoji, size));
  showToast(`${emoji}  ${name ? name + " — " : ""}${size} × ${size} PNG downloaded`);
}

/* ——— font support detection ———
   A colour-font glyph ignores the canvas fillStyle; a missing-glyph "tofu"
   box follows it. Probe each emoji once so partially-covered fonts hide
   exactly the glyphs they lack. */
const probeCanvas = document.createElement("canvas");
probeCanvas.width = probeCanvas.height = 14;
const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
probeCtx.textBaseline = "top";

function rendersInColour(emoji) {
  probeCtx.clearRect(0, 0, 14, 14);
  probeCtx.font = `12px ${EMOJI_FONTS}`;
  probeCtx.fillStyle = "#000";
  probeCtx.fillText(emoji, 0, 0);
  const black = probeCtx.getImageData(0, 0, 14, 14).data;
  probeCtx.clearRect(0, 0, 14, 14);
  probeCtx.fillStyle = "#fff";
  probeCtx.fillText(emoji, 0, 0);
  const white = probeCtx.getImageData(0, 0, 14, 14).data;
  let drawn = false;
  for (let i = 0; i < black.length; i += 4) {
    if (black[i + 3] || white[i + 3]) {
      drawn = true;
      if (black[i] !== white[i] || black[i + 1] !== white[i + 1] || black[i + 2] !== white[i + 2]) {
        return false;
      }
    }
  }
  return drawn;
}

/* ——— build the library ——— */
const cells = [];      // { button, name, emoji }
const groupEls = [];   // { section, buttons }
let shownCount = 0;
let hiddenCount = 0;

function makeCell(emoji, name) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "emoji-cell";
  button.textContent = emoji;
  button.title = name;
  button.setAttribute("aria-label", `Download ${name || emoji} as PNG`);
  button.dataset.emoji = emoji;
  button.dataset.name = name;
  return button;
}

function buildLibrary() {
  const fragment = document.createDocumentFragment();
  for (const { group, items } of EMOJI_LIBRARY) {
    const section = document.createElement("section");
    section.className = "lib-group";

    const title = document.createElement("h2");
    title.className = "lib-group-title";
    title.textContent = group;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "lib-grid";
    const buttons = [];
    for (const [emoji, name] of items) {
      if (!rendersInColour(emoji)) { hiddenCount += 1; continue; }
      const button = makeCell(emoji, name);
      grid.appendChild(button);
      buttons.push(button);
      cells.push({ button, emoji, name: name.toLowerCase() });
      shownCount += 1;
    }
    if (!buttons.length) continue;
    section.appendChild(grid);
    fragment.appendChild(section);
    groupEls.push({ section, buttons });
  }
  library.appendChild(fragment);

  searchInput.placeholder =
    `Search ${shownCount.toLocaleString()} emoji by name — or paste any emoji here`;
  if (hiddenCount > 0) {
    const note = document.createElement("p");
    note.className = "emoji-hint";
    note.textContent =
      `${hiddenCount} newer emoji are hidden because this device’s emoji font doesn’t include them yet.`;
    library.appendChild(note);
  }
}

/* ——— pasted-emoji section ——— */
const pastedSection = document.createElement("section");
pastedSection.className = "lib-group";
pastedSection.hidden = true;
const pastedTitle = document.createElement("h2");
pastedTitle.className = "lib-group-title";
pastedTitle.textContent = "From your input";
const pastedGrid = document.createElement("div");
pastedGrid.className = "lib-grid";
pastedSection.append(pastedTitle, pastedGrid);

function pictographs(text) {
  const seen = new Set();
  return graphemes(text).filter((g) => {
    if (seen.has(g) || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g)) return false;
    seen.add(g);
    return true;
  });
}

/* ——— search ——— */
function applyFilter() {
  const raw = searchInput.value;
  const query = raw.trim().toLowerCase();

  const pasted = pictographs(raw);
  pastedGrid.textContent = "";
  for (const emoji of pasted) pastedGrid.appendChild(makeCell(emoji, ""));
  pastedSection.hidden = pasted.length === 0;

  let anyVisible = false;
  const textQuery = pasted.length ? "" : query;
  for (const { section, buttons } of groupEls) {
    let groupVisible = false;
    for (const button of buttons) {
      const match = !textQuery || button.dataset.name.includes(textQuery);
      button.hidden = !match;
      groupVisible = groupVisible || match;
    }
    section.hidden = !groupVisible;
    anyVisible = anyVisible || groupVisible;
  }
  emptyNote.hidden = anyVisible || pasted.length > 0;
}

let filterTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(applyFilter, 120);
});

library.addEventListener("click", (event) => {
  const cell = event.target.closest(".emoji-cell");
  if (cell) downloadEmoji(cell.dataset.emoji, cell.dataset.name);
});

buildLibrary();
library.prepend(pastedSection);
