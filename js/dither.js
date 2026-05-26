// sRGB ↔ linear light conversions (IEC 61966-2-1)
function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

// Perceptual luminance in linear light (Rec. 709)
function luminance(r, g, b) {
  return 0.2126 * srgbToLinear(r / 255) +
         0.7152 * srgbToLinear(g / 255) +
         0.0722 * srgbToLinear(b / 255);
}

function clamp(v, lo = 0, hi = 1) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hexToLinear(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

function extractGrayscale(imageData, brightness, contrast) {
  const { data, width, height } = imageData;
  const n = width * height;
  const gray = new Float32Array(n);
  // contrast: slider -100..100 → multiplier 0..3
  const c = contrast >= 0 ? 1 + contrast / 50 : 1 + contrast / 100;
  const b = brightness / 200; // -0.5 .. 0.5
  for (let i = 0; i < n; i++) {
    let v = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    v = clamp(c * (v - 0.5) + 0.5 + b);
    gray[i] = v;
  }
  return gray;
}

function buildImageData(gray, width, height, fgHex, bgHex) {
  const fg = hexToLinear(fgHex);
  const bg = hexToLinear(bgHex);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    const c = gray[i] > 0.5 ? fg : bg;
    out[i * 4]     = linearToSrgb(c[0]) * 255;
    out[i * 4 + 1] = linearToSrgb(c[1]) * 255;
    out[i * 4 + 2] = linearToSrgb(c[2]) * 255;
    out[i * 4 + 3] = 255;
  }
  return new ImageData(out, width, height);
}

// ─── ALGORITHMS ────────────────────────────────────────────────────────────

export function threshold(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0 } = opts;
  const gray = extractGrayscale(imageData, brightness, contrast);
  return buildImageData(gray, imageData.width, imageData.height, fgColor, bgColor);
}

export function floydSteinberg(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0 } = opts;
  const { width, height } = imageData;
  const g = extractGrayscale(imageData, brightness, contrast);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = g[i];
      const q = old > 0.5 ? 1 : 0;
      g[i] = q;
      const e = old - q;
      if (x + 1 < width)           g[i + 1]         += e * 7 / 16;
      if (y + 1 < height) {
        if (x > 0)                 g[i + width - 1] += e * 3 / 16;
                                    g[i + width]     += e * 5 / 16;
        if (x + 1 < width)         g[i + width + 1] += e / 16;
      }
    }
  }
  return buildImageData(g, width, height, fgColor, bgColor);
}

export function atkinson(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0 } = opts;
  const { width, height } = imageData;
  const g = extractGrayscale(imageData, brightness, contrast);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = g[i];
      const q = old > 0.5 ? 1 : 0;
      g[i] = q;
      const e = (old - q) / 8;
      if (x + 1 < width)             g[i + 1]             += e;
      if (x + 2 < width)             g[i + 2]             += e;
      if (y + 1 < height) {
        if (x > 0)                   g[i + width - 1]     += e;
                                      g[i + width]         += e;
        if (x + 1 < width)           g[i + width + 1]     += e;
      }
      if (y + 2 < height)            g[i + width * 2]     += e;
    }
  }
  return buildImageData(g, width, height, fgColor, bgColor);
}

export function jjn(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0 } = opts;
  const { width, height } = imageData;
  const g = extractGrayscale(imageData, brightness, contrast);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = g[i];
      const q = old > 0.5 ? 1 : 0;
      g[i] = q;
      const e = old - q;
      if (x + 1 < width)             g[i + 1]                 += e * 7 / 48;
      if (x + 2 < width)             g[i + 2]                 += e * 5 / 48;
      if (y + 1 < height) {
        if (x - 2 >= 0)              g[i + width - 2]         += e * 3 / 48;
        if (x - 1 >= 0)              g[i + width - 1]         += e * 5 / 48;
                                      g[i + width]             += e * 7 / 48;
        if (x + 1 < width)           g[i + width + 1]         += e * 5 / 48;
        if (x + 2 < width)           g[i + width + 2]         += e * 3 / 48;
      }
      if (y + 2 < height) {
        if (x - 2 >= 0)              g[i + width * 2 - 2]     += e / 48;
        if (x - 1 >= 0)              g[i + width * 2 - 1]     += e * 3 / 48;
                                      g[i + width * 2]         += e * 5 / 48;
        if (x + 1 < width)           g[i + width * 2 + 1]     += e * 3 / 48;
        if (x + 2 < width)           g[i + width * 2 + 2]     += e / 48;
      }
    }
  }
  return buildImageData(g, width, height, fgColor, bgColor);
}

// Recursive Bayer threshold matrix (level 1 = 2×2, 2 = 4×4, 3 = 8×8, 4 = 16×16)
const _bayerCache = {};
function bayerMatrix(level) {
  if (_bayerCache[level]) return _bayerCache[level];
  if (level === 1) {
    _bayerCache[1] = [[0, 2], [3, 1]];
    return _bayerCache[1];
  }
  const prev = bayerMatrix(level - 1);
  const half = 2 ** (level - 1);
  const size = half * 2;
  const mat = Array.from({ length: size }, () => new Array(size));
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const v = prev[y][x] * 4;
      mat[y][x]             = v;
      mat[y][x + half]      = v + 2;
      mat[y + half][x]      = v + 3;
      mat[y + half][x + half] = v + 1;
    }
  }
  _bayerCache[level] = mat;
  return mat;
}

export function bayer(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0, level = 3 } = opts;
  const { width, height } = imageData;
  const g = extractGrayscale(imageData, brightness, contrast);
  const mat = bayerMatrix(level);
  const size = 2 ** level;
  const total = size * size;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = (mat[y % size][x % size] + 0.5) / total;
      g[y * width + x] = g[y * width + x] > t ? 1 : 0;
    }
  }
  return buildImageData(g, width, height, fgColor, bgColor);
}

export function whiteNoise(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0 } = opts;
  const { width, height } = imageData;
  const g = extractGrayscale(imageData, brightness, contrast);
  for (let i = 0; i < g.length; i++) g[i] = g[i] > Math.random() ? 1 : 0;
  return buildImageData(g, width, height, fgColor, bgColor);
}

// Riemersma dithering — error diffusion along a Hilbert space-filling curve
function* _hilbertLSystem(n) {
  if (n === 1) { yield 'A'; return; }
  for (const c of _hilbertLSystem(n - 1)) {
    if (c === 'A')      yield* '+BF-AFA-FB+';
    else if (c === 'B') yield* '-AF+BFB+FA-';
    else                yield c;
  }
}

function* hilbertCoords(width, height) {
  const order = Math.ceil(Math.log2(Math.max(width, height))) + 1;
  let x = 0, y = 0, dir = 0;
  yield { x, y };
  for (const c of _hilbertLSystem(order)) {
    if (c === 'F') {
      x += Math.round(Math.cos(dir));
      y += Math.round(Math.sin(dir));
      yield { x, y };
    } else if (c === '+') {
      dir += Math.PI / 2;
    } else if (c === '-') {
      dir -= Math.PI / 2;
    }
  }
}

export function riemersma(imageData, opts = {}) {
  const { fgColor = '#ffffff', bgColor = '#000000', brightness = 0, contrast = 0 } = opts;
  const { width, height } = imageData;
  const g = extractGrayscale(imageData, brightness, contrast);

  const histLen = 16;
  const ratio = 1 / 8;
  const weights = Array.from({ length: histLen }, (_, i) => Math.pow(ratio, i / (histLen - 1)));
  const errors = new Array(histLen).fill(0);

  for (const { x, y } of hilbertCoords(width, height)) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = y * width + x;
    const errWeighted = errors.reduce((s, e, j) => s + e * weights[j], 0);
    const old = g[i];
    const q = (old + errWeighted) > 0.5 ? 1 : 0;
    errors.pop();
    errors.unshift(old - q);
    g[i] = q;
  }
  return buildImageData(g, width, height, fgColor, bgColor);
}
