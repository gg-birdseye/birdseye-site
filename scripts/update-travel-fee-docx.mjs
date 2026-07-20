import { copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legalDir = join(__dirname, "..", "docs", "legal");
const sourceDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A-updated.docx");
const backupDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A.docx");

const REPLACEMENTS = [
  ["Five Hundred Dollars ($500.00)", "One Thousand Dollars ($1,000.00)"],
  [
    "one-time fee of $500.00 due with initial payment",
    "one-time fee of $1,000.00 due with initial payment",
  ],
];

const zip = new AdmZip(sourceDocx);
let xml = zip.getEntry("word/document.xml").getData().toString("utf8");

for (const [from, to] of REPLACEMENTS) {
  if (!xml.includes(from)) {
    console.warn(`Pattern not found (skipped): ${from}`);
    continue;
  }
  xml = xml.split(from).join(to);
  console.log(`Replaced: ${from}`);
}

if (xml.includes("$500.00") || xml.includes("Five Hundred Dollars")) {
  console.error("Travel fee still references $500 after patch.");
  process.exit(1);
}

zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
zip.writeZip(sourceDocx);

try {
  copyFileSync(sourceDocx, backupDocx);
  console.log("Synced:", backupDocx);
} catch (error) {
  console.warn("Could not sync backup (file may be open in Word):", error.message);
}

console.log("Updated:", sourceDocx);
