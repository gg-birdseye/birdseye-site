import AdmZip from "adm-zip";
import { join } from "node:path";

function plain(file) {
  return AdmZip(file)
    .readAsText("word/document.xml")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"');
}

const dir = join(process.cwd(), "docs/legal/contracts");
for (const v of ["base", "travel", "trade_out", "travel_trade_out"]) {
  const t = plain(join(dir, `Birdseye-MSA-SOW-${v}.docx`));
  const articles = [...t.matchAll(/ARTICLE (\d+) — ([^]+?)(?=ARTICLE \d+ —|$)/g)].map((m) => `${m[1]}:${m[2].slice(0,35).trim()}`);
  console.log(`\n=== ${v} ===`);
  console.log("article headers:");
  for (const a of articles) console.log(" ", a);
  console.log(
    "1.12 Subscription:",
    t.includes('1.12 "Subscription Courses"'),
    "| 1.13:",
    t.includes("1.13"),
    "| Trade-Out def:",
    t.includes('"Trade-Out Credit" means'),
  );
  console.log(
    "4.6:",
    t.includes("4.6 Travel"),
    "| Art6 trade:",
    t.includes("ARTICLE 6 — RECIPROCAL"),
    "| Art6/7 term:",
    t.includes("ARTICLE 6 — TERM"),
    t.includes("ARTICLE 7 — TERM"),
  );
  console.log(
    "MSA renewal refs:",
    t.includes("MSA Article 6.5"),
    t.includes("MSA Article 7.5"),
    t.includes("Article 6.5–6.7"),
  );
  console.log(
    "Schedule:",
    "3.5=" + t.includes("3.5 TRAVEL"),
    "trade4=" + t.includes("4. TRADE-OUT"),
    "proj4=" + t.includes("4. PROJECT"),
    "proj5=" + t.includes("5. PROJECT"),
    "sow5=" + t.includes("5. SOW"),
    "sow6=" + t.includes("6. SOW"),
  );
}
