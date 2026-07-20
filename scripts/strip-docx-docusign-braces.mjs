/**
 * Remove {{DataLabel}} from contract docx for DocuSign upload.
 * DocuSign auto-creates a text field for every {{tag}} in a .docx (AceGen),
 * which duplicates fields you add manually in the editor.
 *
 * Output: docs/legal/Birdseye-Master-Service-Agreement-and-Schedule-A-docusign-upload.docx
 */
import { copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legalDir = join(__dirname, "..", "docs", "legal");
const sourceDocx = join(
  legalDir,
  "Birdseye-Master-Service-Agreement-and-Schedule-A-updated.docx",
);
const outputDocx = join(
  legalDir,
  "Birdseye-Master-Service-Agreement-and-Schedule-A-docusign-upload.docx",
);

const zip = new AdmZip(sourceDocx);
const entry = zip.getEntry("word/document.xml");
if (!entry) throw new Error("word/document.xml not found");

let xml = entry.getData().toString("utf8");
const before = (xml.match(/\{\{[^}]+\}\}/g) ?? []).length;

// Replace {{Label}} even when split across Word runs (rare); simple pass first.
xml = xml.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, "________________________________");

const after = (xml.match(/\{\{[^}]+\}\}/g) ?? []).length;
if (after > 0) {
  console.warn(`Warning: ${after} brace placeholders may remain (split across XML runs).`);
}

zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
zip.writeZip(outputDocx);
try {
  copyFileSync(outputDocx, join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A.docx"));
} catch (err) {
  if (err?.code === "EBUSY") {
    console.warn("Could not overwrite Birdseye-Master-Service-Agreement-and-Schedule-A.docx (file open in Word?).");
  } else {
    throw err;
  }
}

console.log(`Removed ${before} {{tag}} placeholders from Word doc.`);
console.log("Upload THIS file to DocuSign (or export it to PDF first):");
console.log(outputDocx);
console.log("\nThen add Text fields manually — one per Data Label. Do NOT use {{tags}} in Word.");
