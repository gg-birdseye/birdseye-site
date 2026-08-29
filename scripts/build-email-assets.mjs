import { mkdirSync, statSync } from "fs";
import sharp from "sharp";

mkdirSync("public/email", { recursive: true });

const BLACK = "#000000";
const W = 1200;
const H = 675;

const logoBuf = await sharp("public/logo1.svg", { density: 400 })
  .ensureAlpha()
  .negate({ alpha: false })
  .trim({ threshold: 20 })
  .png()
  .toBuffer();

const logoMeta = await sharp(logoBuf).metadata();
console.log("logo trimmed", logoMeta.width, logoMeta.height);

await sharp(logoBuf)
  .resize({ width: 480, withoutEnlargement: false })
  .png({ compressionLevel: 9 })
  .toFile("public/email/logo.png");

const logoOut = await sharp("public/email/logo.png").metadata();
console.log("logo out", logoOut.width, logoOut.height);

const fadeSvg = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BLACK}" stop-opacity="0"/>
      <stop offset="48%" stop-color="${BLACK}" stop-opacity="0"/>
      <stop offset="78%" stop-color="${BLACK}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${BLACK}" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`,
);

await sharp("public/frames/introvid/00001.webp")
  .resize(W, H, { fit: "cover", position: "centre" })
  .composite([{ input: fadeSvg, blend: "over" }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("public/email/hero.jpg");

const hero = await sharp("public/email/hero.jpg").metadata();
console.log(
  "hero",
  hero.width,
  hero.height,
  "kb",
  Math.round(statSync("public/email/hero.jpg").size / 1024),
);
