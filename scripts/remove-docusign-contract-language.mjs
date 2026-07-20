import { copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legalDir = join(__dirname, "..", "docs", "legal");
const sourceDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A-updated.docx");
const backupDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A.docx");

const REPLACEMENTS = [
  [
    "Client is the sole DocuSign signer",
    "Client is the sole signatory to this Agreement",
  ],
  [
    "Select one option below (use DocuSign checkboxes or initial the selected option):",
    "Select one option below (initial the selected option):",
  ],
];

function patchDocx(inputPath, outputPath) {
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("word/document.xml not found");

  let xml = entry.getData().toString("utf8");
  for (const [from, to] of REPLACEMENTS) {
    if (!xml.includes(from)) {
      console.warn(`Pattern not found (skipped): ${from}`);
      continue;
    }
    const count = xml.split(from).length - 1;
    xml = xml.split(from).join(to);
    console.log(`Replaced ${count}x: ${from.slice(0, 50)}...`);
  }

  if (/DocuSign|docusign/i.test(xml)) {
    throw new Error("DocuSign references still present after patch");
  }

  zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
  zip.writeZip(outputPath);
}

console.log("Removing DocuSign-specific contract language...");
patchDocx(sourceDocx, sourceDocx);

try {
  copyFileSync(sourceDocx, backupDocx);
  console.log("Synced:", backupDocx);
} catch (error) {
  console.warn("Could not sync backup:", error.message);
}

console.log("Updated:", sourceDocx);
