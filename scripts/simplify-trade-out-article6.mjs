/**
 * Simplifies MSA Article 6.4 and removes Schedule A guest-referral language
 * from the live contract .docx files.
 */
import { copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legalDir = join(__dirname, "..", "docs", "legal");
const sourceDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A-updated.docx");
const backupDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A.docx");

const NEW_6_4_TEXT =
  "6.4 Authorization and Approval. All complimentary rounds honored under this Article 6 count against the total number of complimentary rounds per contract year specified in Schedule A, whether or not a Birdseye representative is present in the playing group. No complimentary round may be used unless Birdseye has expressly approved that specific round with Client in writing (email is sufficient) in advance of play. Birdseye may designate the players for any approved round. Client shall not honor any comp request without Birdseye's prior written approval for that round. Client shall not substitute cash, credit, merchandise, or other consideration in lieu of honored complimentary rounds except as expressly agreed in writing.";

const GUEST_REFERRAL_LINE =
  "Guest Referral Rounds per contract year (optional; default 4 per MSA §6.4(b)(iv)): ________ (leave blank for default of 4)";

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}

function paragraphXml(text, { boldPrefix } = {}) {
  const escaped = escapeXml(text);
  if (!boldPrefix) {
    return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  }
  const prefixLen = boldPrefix.length;
  const rest = escaped.slice(prefixLen);
  return `<w:p><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${escapeXml(boldPrefix)}</w:t></w:r><w:r><w:t xml:space="preserve">${rest}</w:t></w:r></w:p>`;
}

function replaceArticle64(xml) {
  const startMarkers = [
    "6.4 Use of Complimentary Rounds; Guest Referral Exception.",
    "6.4 Authorization and Use of Complimentary Rounds.",
    "6.4 Authorization and Approval.",
  ];

  const startMarker = startMarkers.find((marker) => xml.includes(marker));
  if (!startMarker) {
    throw new Error("Could not find Article 6.4 section in document.xml");
  }

  const sectionStart = xml.indexOf(startMarker);
  const sectionEnd = xml.indexOf("6.5 Revocation for Non-Performance.", sectionStart);
  if (sectionEnd < 0) {
    throw new Error("Could not find Article 6.5 after Article 6.4");
  }

  const paraStart = xml.lastIndexOf("<w:p>", sectionStart);
  const paraEnd = xml.lastIndexOf("<w:p>", sectionEnd);
  const newParagraph = paragraphXml(NEW_6_4_TEXT, {
    boldPrefix: "6.4 Authorization and Approval. ",
  });

  return xml.slice(0, paraStart) + newParagraph + xml.slice(paraEnd);
}

function removeGuestReferralLine(xml) {
  const patterns = [
    GUEST_REFERRAL_LINE,
    "Guest Referral Rounds per contract year (optional; default 4 per MSA §6.4(b)(iv)): ________ (leave blank for default of 4)",
  ];

  let updated = xml;
  for (const pattern of patterns) {
    const paraStart = updated.indexOf(pattern);
    if (paraStart < 0) continue;

    const blockStart = updated.lastIndexOf("<w:p>", paraStart);
    const blockEnd = updated.indexOf("</w:p>", paraStart);
    if (blockStart < 0 || blockEnd < 0) continue;

    updated = updated.slice(0, blockStart) + updated.slice(blockEnd + "</w:p>".length);
    console.log("Removed Schedule A guest referral line.");
  }

  return updated;
}

function patchDocx(inputPath, outputPath) {
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("word/document.xml not found");

  let xml = entry.getData().toString("utf8");
  xml = replaceArticle64(xml);
  xml = removeGuestReferralLine(xml);

  zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
  zip.writeZip(outputPath);

  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");

  if (text.includes("Guest Referral")) {
    throw new Error("Guest Referral language still present after patch");
  }
  if (!text.includes("6.4 Authorization and Approval.")) {
    throw new Error("Updated Article 6.4 text not found after patch");
  }

  return text;
}

console.log("Simplifying trade-out / complimentary rounds language...");
patchDocx(sourceDocx, sourceDocx);
copyFileSync(sourceDocx, backupDocx);
console.log("Updated:", sourceDocx);
console.log("Synced:", backupDocx);
