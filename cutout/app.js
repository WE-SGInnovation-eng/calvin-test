const IMGLY_CDN = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/+esm";

const states = {
  drop: document.getElementById("dropState"),
  busy: document.getElementById("busyState"),
  result: document.getElementById("resultState"),
  error: document.getElementById("errorState"),
};

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const busyLabel = document.getElementById("busyLabel");
const busyFine = document.getElementById("busyFine");
const progressFill = document.getElementById("progressFill");
const compare = document.getElementById("compare");
const compareRange = document.getElementById("compareRange");
const beforeImg = document.getElementById("beforeImg");
const afterImg = document.getElementById("afterImg");
const downloadLink = document.getElementById("downloadLink");
const resetButton = document.getElementById("resetButton");
const retryButton = document.getElementById("retryButton");
const errorBody = document.getElementById("errorBody");

let objectUrls = [];
let lastFile = null;
let working = false;

function show(name) {
  for (const [key, el] of Object.entries(states)) el.hidden = key !== name;
}

function revokeUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function fail(message) {
  working = false;
  errorBody.textContent = message;
  show("error");
}

function setProgress(key, current, total) {
  if (key && key.startsWith("fetch")) {
    busyLabel.textContent = "Downloading model — one time only";
    if (total > 0) {
      const pct = Math.round((current / total) * 100);
      progressFill.style.width = `${pct}%`;
    }
  } else {
    busyLabel.textContent = "Separating subject from background";
    busyFine.textContent = "Running on this device — larger photos take a little longer.";
    progressFill.style.width = "100%";
  }
}

async function process(file) {
  if (working) return;
  if (!file || !file.type.startsWith("image/")) {
    fail("That file isn’t an image. Drop a JPEG, PNG or WebP.");
    return;
  }

  working = true;
  lastFile = file;
  busyLabel.textContent = "Preparing";
  busyFine.textContent = "The model downloads once (~40 MB) and is cached for next time.";
  progressFill.style.width = "0%";
  show("busy");

  try {
    const { removeBackground } = await import(IMGLY_CDN);
    const cutout = await removeBackground(file, { progress: setProgress });

    revokeUrls();
    const beforeUrl = URL.createObjectURL(file);
    const afterUrl = URL.createObjectURL(cutout);
    objectUrls.push(beforeUrl, afterUrl);

    beforeImg.src = beforeUrl;
    afterImg.src = afterUrl;
    downloadLink.href = afterUrl;
    downloadLink.download = file.name.replace(/\.[^.]+$/, "") + "-cutout.png";

    compareRange.value = "50";
    compare.style.setProperty("--pos", "50%");
    working = false;
    show("result");
  } catch (err) {
    console.error(err);
    fail(
      "The model couldn’t load or run. Check your connection (the first run downloads ~40 MB), " +
      "then try again. If it keeps failing, try a smaller image or a different browser."
    );
  }
}

/* — drop zone interactions — */
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => process(fileInput.files[0]));

["dragenter", "dragover"].forEach((type) =>
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-over");
  })
);
["dragleave", "drop"].forEach((type) =>
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-over");
  })
);
dropzone.addEventListener("drop", (event) => process(event.dataTransfer.files[0]));

document.addEventListener("paste", (event) => {
  if (!states.drop.hidden || !states.error.hidden) {
    const item = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
    if (item) process(item.getAsFile());
  }
});

/* — compare slider — */
compareRange.addEventListener("input", () => {
  compare.style.setProperty("--pos", `${compareRange.value}%`);
});

/* — reset / retry — */
resetButton.addEventListener("click", () => {
  revokeUrls();
  fileInput.value = "";
  show("drop");
});
retryButton.addEventListener("click", () => {
  if (lastFile) process(lastFile);
  else show("drop");
});
