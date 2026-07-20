/**
 * Faithful WebP export of the Example Course aerial SVG.
 * Usage: node scripts/convert-aerial-svg-to-webp.mjs
 *
 * Matches the original art (photo + vector colors). Only the cream paper
 * shapes (st0) are omitted so the panel shows through — no chroma-keying.
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "aerial");
const svgUrl =
  "https://cdn.sanity.io/files/nrpde8qa/production/9f3afa8c23073799d0c6cd30933cbd52c3df24f3.svg";

const BASE_W = 1920;
const BASE_H = 1080;
const EXPORT_SCALE = 2;
const WIDTH = BASE_W * EXPORT_SCALE;
const HEIGHT = BASE_H * EXPORT_SCALE;

/** Embedded photo transform from the Illustrator SVG (base artboard units). */
const PHOTO_SCALE = 0.65;
const PHOTO_TX = -15.31;
const PHOTO_TY = -110.21;
const PHOTO_SRC_W = 3000;
const PHOTO_SRC_H = 2000;

await mkdir(outDir, { recursive: true });

console.log("Downloading SVG…");
const res = await fetch(svgUrl);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const svgText = await res.text();
await writeFile(join(outDir, "_source.svg"), svgText, "utf8");

const rasterMatch = svgText.match(
  /(?:xlink:)?href="(data:image\/(?:jpeg|jpg|png|webp);base64,[^"]+)"/i,
);
if (!rasterMatch?.[1]) throw new Error("No embedded photo in SVG");

const dataUri = rasterMatch[1];
const comma = dataUri.indexOf(",");
const photoBytes = Buffer.from(dataUri.slice(comma + 1), "base64");
const photoPath = join(outDir, "_embedded.jpg");
await writeFile(photoPath, photoBytes);

// Vectors only: drop embedded photo + clear paper fill. Keep sand/greens/etc.
let vectorsOnlySvg = svgText.replace(/<image\b[^>]*\/?>/i, "");
vectorsOnlySvg = vectorsOnlySvg.replace(
  /\.st0\s*\{[^}]*\}/,
  ".st0 { fill: none; }",
);
const vectorsSvgPath = join(outDir, "_vectors.svg");
await writeFile(vectorsSvgPath, vectorsOnlySvg, "utf8");

const density = Math.round(96 * EXPORT_SCALE);
console.log(`Rasterizing vectors at ${WIDTH}×${HEIGHT} (density ${density})…`);
const vectorLayer = await sharp(vectorsSvgPath, { density })
  .resize(WIDTH, HEIGHT, {
    fit: "fill",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .ensureAlpha()
  .png()
  .toBuffer();

// Clip photo to the course artwork silhouette (everything except paper).
const maskPng = await sharp(vectorLayer)
  .ensureAlpha()
  .png()
  .toBuffer();

const imgW = Math.round(PHOTO_SRC_W * PHOTO_SCALE * EXPORT_SCALE);
const imgH = Math.round(PHOTO_SRC_H * PHOTO_SCALE * EXPORT_SCALE);
const extractLeft = Math.max(0, Math.round(-PHOTO_TX * EXPORT_SCALE));
const extractTop = Math.max(0, Math.round(-PHOTO_TY * EXPORT_SCALE));

const transparentBase = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .png()
  .toBuffer();

const photoExtract = await sharp(photoPath)
  .resize(imgW, imgH, { kernel: sharp.kernel.lanczos3 })
  .extract({
    left: extractLeft,
    top: extractTop,
    width: Math.min(WIDTH, imgW - extractLeft),
    height: Math.min(HEIGHT, imgH - extractTop),
  })
  .ensureAlpha()
  .png()
  .toBuffer();

const photoOnArtboard = await sharp(transparentBase)
  .composite([{ input: photoExtract, left: 0, top: 0 }])
  .png()
  .toBuffer();

console.log("Compositing photo + original vector colors…");
const outPath = join(outDir, "example-course-map.webp");
await sharp(photoOnArtboard)
  .composite([
    { input: maskPng, blend: "dest-in" },
    { input: vectorLayer, blend: "over" },
  ])
  .webp({ lossless: true, alphaQuality: 100, effort: 4 })
  .toFile(outPath);

const meta = await sharp(outPath).metadata();
const check = await sharp(outPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let transparent = 0;
let opaque = 0;
const buckets = new Map();
for (let i = 0; i < check.data.length; i += 4) {
  const a = check.data[i + 3];
  if (a < 16) {
    transparent += 1;
    continue;
  }
  opaque += 1;
  const r = check.data[i] >> 4;
  const g = check.data[i + 1] >> 4;
  const b = check.data[i + 2] >> 4;
  const key = `${r},${g},${b}`;
  buckets.set(key, (buckets.get(key) || 0) + 1);
}

const top = [...buckets.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([k, n]) => {
    const [r, g, b] = k.split(",").map((x) => Number(x) * 16 + 8);
    return {
      approx: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      n,
      pct: ((n / opaque) * 100).toFixed(1),
    };
  });

console.log("Wrote", outPath);
console.log(meta);
console.log(
  "transparent ratio",
  (transparent / (WIDTH * HEIGHT)).toFixed(3),
);
console.log("top opaque colors", top);
console.log("size MB", ((await stat(outPath)).size / 1024 / 1024).toFixed(2));
console.log("Done.");
