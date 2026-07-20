import AdmZip from "adm-zip";
import { join } from "node:path";

function getParagraphXml(xml, needle) {
  const idx = xml.indexOf(needle);
  if (idx < 0) return null;
  const start = xml.lastIndexOf("<w:p ", idx);
  const end = xml.indexOf("</w:p>", idx);
  if (start < 0 || end < 0) return null;
  return xml.slice(start, end + "</w:p>".length);
}

function boldRuns(paragraphXml) {
  const runs = [...paragraphXml.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)];
  return runs
    .filter(([, content]) => /<w:b\/>/.test(content))
    .map(([, content]) =>
      [...content.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join(""),
    );
}

function regularRuns(paragraphXml) {
  const runs = [...paragraphXml.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)];
  return runs
    .filter(([, content]) => !/<w:b\/>/.test(content))
    .map(([, content]) =>
      [...content.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join(""),
    )
    .filter((text) => text.trim().length > 0);
}

const dir = join(process.cwd(), "docs/legal/contracts");
const checks = [
  { file: "Birdseye-MSA-SOW-base.docx", needle: "1.12 &quot;Subscription Courses&quot;", label: "1.12 definition" },
  { file: "Birdseye-MSA-SOW-base.docx", needle: "5.2 Client-Initiated", label: "5.2 section" },
  { file: "Birdseye-MSA-SOW-travel.docx", needle: "6.1 Initial Term", label: "6.1 section (travel)" },
  { file: "Birdseye-MSA-SOW-trade_out.docx", needle: "6.1 Optional Election", label: "6.1 trade-out" },
];

let failed = false;

for (const check of checks) {
  const xml = AdmZip(join(dir, check.file)).readAsText("word/document.xml");
  const paragraph = getParagraphXml(xml, check.needle);
  if (!paragraph) {
    console.error(`FAIL: ${check.file} missing ${check.label}`);
    failed = true;
    continue;
  }

  const bold = boldRuns(paragraph);
  const regular = regularRuns(paragraph);

  if (regular.length === 0) {
    console.error(`FAIL: ${check.file} ${check.label} — no regular (non-bold) run`);
    console.error("  bold:", bold);
    failed = true;
    continue;
  }

  const boldTooLong = bold.some((text) => text.length > 80);
  if (boldTooLong) {
    console.error(`FAIL: ${check.file} ${check.label} — bold run contains body text`);
    console.error("  bold:", bold);
    failed = true;
    continue;
  }

  console.log(`OK: ${check.file} ${check.label}`);
}

if (failed) process.exit(1);
