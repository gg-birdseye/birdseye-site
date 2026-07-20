import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "aerial");
await mkdir(outDir, { recursive: true });

const url =
  "https://cdn.sanity.io/files/nrpde8qa/production/9f3afa8c23073799d0c6cd30933cbd52c3df24f3.svg";
const t = await (await fetch(url)).text();
await writeFile(join(outDir, "_source.svg"), t, "utf8");

const styles = [...t.matchAll(/\.st(\d+)\s*\{([^}]+)\}/g)].map((m) => ({
  id: m[1],
  css: m[2].replace(/\s+/g, " ").trim(),
}));
console.log("styles sample:", styles.slice(0, 25));

const rects = [...t.matchAll(/<rect\b[^>]*>/gi)].slice(0, 20);
console.log(
  "rects:",
  rects.map((r) => r[0]),
);

for (const id of ["0", "4", "6", "7", "8"]) {
  const re = new RegExp(`class="st${id}"`, "g");
  console.log(`st${id} count`, (t.match(re) || []).length);
}

// Near-full-artboard shapes often act as backgrounds
const bigRects = [...t.matchAll(/<rect\b[^>]*>/gi)].filter((r) => {
  const w = Number(r[0].match(/\bwidth="([\d.]+)"/)?.[1] || 0);
  const h = Number(r[0].match(/\bheight="([\d.]+)"/)?.[1] || 0);
  return w > 1500 || h > 800;
});
console.log("big rects:", bigRects.map((r) => r[0]));
