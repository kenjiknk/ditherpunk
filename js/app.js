import { threshold, floydSteinberg, atkinson, jjn, bayer, riemersma, whiteNoise } from './dither.js';

const ALGORITHMS = {
  threshold:      { fn: threshold,                                       label: 'Threshold' },
  floydSteinberg: { fn: floydSteinberg,                                  label: 'Floyd-Steinberg' },
  atkinson:       { fn: atkinson,                                        label: 'Atkinson' },
  jjn:            { fn: jjn,                                             label: 'Jarvis-Judice-Ninke' },
  bayer2:         { fn: (d, o) => bayer(d, { ...o, level: 1 }),         label: 'Bayer 2×2' },
  bayer4:         { fn: (d, o) => bayer(d, { ...o, level: 2 }),         label: 'Bayer 4×4' },
  bayer8:         { fn: (d, o) => bayer(d, { ...o, level: 3 }),         label: 'Bayer 8×8' },
  bayer16:        { fn: (d, o) => bayer(d, { ...o, level: 4 }),         label: 'Bayer 16×16' },
  riemersma:      { fn: riemersma,                                       label: 'Riemersma' },
  whiteNoise:     { fn: whiteNoise,                                      label: 'White Noise' },
};

const PALETTES = [
  { name: 'B&W',    fg: '#ffffff', bg: '#000000' },
  { name: 'MATRIX', fg: '#00ff41', bg: '#002200' },
  { name: 'AMBER',  fg: '#ffb000', bg: '#150800' },
  { name: 'CYBER',  fg: '#00e5ff', bg: '#000b1e' },
  { name: 'VIBE',   fg: '#ff00ff', bg: '#0f000f' },
  { name: 'BLOOD',  fg: '#ff1c1c', bg: '#0a0000' },
  { name: 'MINT',   fg: '#00ff9f', bg: '#001a10' },
  { name: 'SOLAR',  fg: '#ff6a00', bg: '#0a0300' },
];

// DOM references
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const fileInput     = document.getElementById('file-input');
const dropzone      = document.getElementById('dropzone');
const algoSelect    = document.getElementById('algorithm');
const fgInput       = document.getElementById('fg-color');
const bgInput       = document.getElementById('bg-color');
const brightnessEl  = document.getElementById('brightness');
const contrastEl    = document.getElementById('contrast');
const pixelScaleEl  = document.getElementById('pixel-scale');
const downloadBtn   = document.getElementById('download');
const processingEl  = document.getElementById('processing');
const emptyState    = document.getElementById('empty-state');
const canvasInfo    = document.getElementById('canvas-info');
const palettesEl    = document.getElementById('palette-presets');

// Slider value display
const brightnessVal = document.getElementById('brightness-val');
const contrastVal   = document.getElementById('contrast-val');
const pixelScaleVal = document.getElementById('pixel-scale-val');

let originalImageData = null;
let debounceTimer = null;

// ─── PALETTE BUTTONS ───────────────────────────────────────────────────────

PALETTES.forEach((p, idx) => {
  const btn = document.createElement('button');
  btn.className = 'palette-btn';
  btn.dataset.fg = p.fg;
  btn.dataset.bg = p.bg;
  btn.style.setProperty('--btn-fg', p.fg);
  btn.style.setProperty('--btn-bg', p.bg);
  btn.textContent = p.name;
  if (idx === 0) btn.classList.add('active');
  btn.addEventListener('click', () => {
    fgInput.value = p.fg;
    bgInput.value = p.bg;
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    process();
  });
  palettesEl.appendChild(btn);
});

// ─── IMAGE LOADING ─────────────────────────────────────────────────────────

function loadFile(file) {
  if (!file?.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const tmp = Object.assign(document.createElement('canvas'), {
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      tmp.getContext('2d').drawImage(img, 0, 0);
      originalImageData = tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height);
      emptyState.style.display = 'none';
      canvas.style.display = 'block';
      process();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── SCALE HELPERS ─────────────────────────────────────────────────────────

function downsample(imageData, scale) {
  if (scale <= 1) return imageData;
  const w = Math.max(1, Math.floor(imageData.width / scale));
  const h = Math.max(1, Math.floor(imageData.height / scale));
  const tmp = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = 'high';
  const src = Object.assign(document.createElement('canvas'), {
    width: imageData.width,
    height: imageData.height,
  });
  src.getContext('2d').putImageData(imageData, 0, 0);
  tctx.drawImage(src, 0, 0, w, h);
  return tctx.getImageData(0, 0, w, h);
}

function upscaleNearest(imageData, targetW, targetH) {
  const tmp = Object.assign(document.createElement('canvas'), { width: targetW, height: targetH });
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  const src = Object.assign(document.createElement('canvas'), {
    width: imageData.width,
    height: imageData.height,
  });
  src.getContext('2d').putImageData(imageData, 0, 0);
  tctx.drawImage(src, 0, 0, targetW, targetH);
  return tctx.getImageData(0, 0, targetW, targetH);
}

// ─── CORE PROCESSING ───────────────────────────────────────────────────────

async function process() {
  if (!originalImageData) return;

  processingEl.classList.add('visible');
  await new Promise(r => setTimeout(r, 10)); // yield to paint loading indicator

  try {
    const scale  = parseInt(pixelScaleEl.value) || 1;
    const algo   = algoSelect.value;
    const opts   = {
      fgColor:    fgInput.value,
      bgColor:    bgInput.value,
      brightness: parseInt(brightnessEl.value),
      contrast:   parseInt(contrastEl.value),
    };

    const input  = scale > 1 ? downsample(originalImageData, scale) : originalImageData;
    const result = ALGORITHMS[algo].fn(input, opts);
    const output = scale > 1
      ? upscaleNearest(result, originalImageData.width, originalImageData.height)
      : result;

    canvas.width  = output.width;
    canvas.height = output.height;
    ctx.putImageData(output, 0, 0);

    canvasInfo.textContent =
      `${output.width} × ${output.height}px · ${ALGORITHMS[algo].label}` +
      (scale > 1 ? ` · ${scale}× pixel scale` : '');
  } finally {
    processingEl.classList.remove('visible');
  }
}

function scheduleProcess() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(process, 80);
}

// ─── EVENT LISTENERS ───────────────────────────────────────────────────────

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  loadFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

document.addEventListener('paste', e => {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) { loadFile(item.getAsFile()); break; }
  }
});

algoSelect.addEventListener('change', scheduleProcess);
fgInput.addEventListener('input', scheduleProcess);
bgInput.addEventListener('input', scheduleProcess);
brightnessEl.addEventListener('input', () => {
  brightnessVal.textContent = brightnessEl.value;
  scheduleProcess();
});
contrastEl.addEventListener('input', () => {
  contrastVal.textContent = contrastEl.value;
  scheduleProcess();
});
pixelScaleEl.addEventListener('input', () => {
  pixelScaleVal.textContent = `${pixelScaleEl.value}×`;
  scheduleProcess();
});

downloadBtn.addEventListener('click', () => {
  if (!originalImageData) return;
  const a = document.createElement('a');
  a.download = `ditherpunk-${algoSelect.value}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});
