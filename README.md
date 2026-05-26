# DITHERPUNK ▓▒░

> Transform any image into a dithered masterpiece — ready for wallpapers, prints, or pure aesthetics.

![ditherpunk preview](https://raw.githubusercontent.com/kenjiknk/ditherpunk/main/preview.png)

## Live Demo

Open `index.html` in any modern browser — no build step, no dependencies.

Or serve locally:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Usage

1. **Drop** an image onto the canvas, **click** to open file picker, or **paste** from clipboard (`Ctrl+V`)
2. Pick an **algorithm**
3. Choose a **palette** (preset or custom colors)
4. Adjust **brightness / contrast / pixel scale**
5. Click **DOWNLOAD PNG** — full resolution, ready for wallpaper

## Algorithms

| Algorithm | Style | Best for |
|-----------|-------|----------|
| **Threshold** | Hard cutoff at 50% | High-contrast graphics |
| **Floyd-Steinberg** | Smooth error diffusion | Photos, natural images |
| **Atkinson** | High-contrast diffusion (Mac original) | Portraits, vintage look |
| **Jarvis-Judice-Ninke** | Wide diffusion kernel | Smooth gradients |
| **Bayer 2×2 / 4×4 / 8×8 / 16×16** | Ordered crosshatch pattern | Retro game aesthetic |
| **Riemersma (Hilbert)** | Error diffusion along space-filling curve | Organic, artifact-free |
| **White Noise** | Random threshold | Grainy, noisy texture |

## Palettes

8 built-in presets — or pick any two colors with the FG / BG pickers:

| Name | Look |
|------|------|
| B&W | Classic monochrome |
| MATRIX | Green on dark green |
| AMBER | Warm orange on near-black |
| CYBER | Cyan on deep blue |
| VIBE | Magenta on black |
| BLOOD | Red on black |
| MINT | Neon green on dark green |
| SOLAR | Orange-red on near-black |

## Controls

| Control | Range | Effect |
|---------|-------|--------|
| **Brightness** | −100 → +100 | Lighten or darken before dithering |
| **Contrast** | −100 → +100 | Increase or decrease tonal range |
| **Pixel Scale** | 1× → 8× | Dither at lower res → upscale nearest-neighbor → chunky retro pixels |

## How it works

All processing runs in the browser using the Canvas API and `ImageData`.  
Images are converted to **linear light** before dithering (proper perceptual luminance), then mapped back to sRGB for output — same approach described in [Surma's Ditherpunk article](https://surma.dev/things/ditherpunk/).

```
Input image
  → sRGB → linear luminance
  → dithering algorithm (0.0 … 1.0 float array)
  → threshold → 0 or 1 per pixel
  → map to palette colors (linear → sRGB)
  → ImageData → Canvas → PNG download
```

## Files

```
ditherpunk/
├── index.html      — markup + layout
├── style.css       — dark terminal UI
└── js/
    ├── dither.js   — all dithering algorithms
    └── app.js      — UI controller
```

## Browser support

Any modern browser with ES Modules support (Chrome 61+, Firefox 60+, Safari 11+).

## License

MIT
