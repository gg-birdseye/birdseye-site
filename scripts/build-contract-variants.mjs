/**
 * Build four contract .docx variants from the full master signing template.
 *
 * Variants:
 *   base              — no travel fee or trade-out language
 *   travel            — MSA §4.6 + Schedule A §3.5
 *   trade_out         — MSA Art. 6 + Schedule A §4
 *   travel_trade_out  — both
 *
 * Source: docs/legal/Birdseye MSA-SOW-signing.docx (must include all sections)
 * Output: docs/legal/contracts/Birdseye-MSA-SOW-*.docx
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legalDir = join(__dirname, "..", "docs", "legal");
const contractsDir = join(legalDir, "contracts");
const masterDocx = join(legalDir, "Birdseye MSA-SOW-signing.docx");

const VARIANTS = [
  { key: "base", includeTravel: false, includeTradeOut: false },
  { key: "travel", includeTravel: true, includeTradeOut: false },
  { key: "trade_out", includeTravel: false, includeTradeOut: true },
  { key: "travel_trade_out", includeTravel: true, includeTradeOut: true },
];

const SOW_ACKNOWLEDGMENT_TEXT = {
  base: "(d) Client has read and agrees to MSA Articles 3–5 regarding revisions, reshoot fees, site access, safety, and cancellations;",
  travel:
    "(d) Client has read and agrees to MSA Articles 3–5 regarding revisions, reshoot fees, site access, safety, travel and mobilization, and cancellations;",
  trade_out:
    "(d) Client has read and agrees to MSA Articles 3–6 regarding revisions, reshoot fees, site access, safety, cancellations, and trade-out credit;",
  travel_trade_out:
    "(d) Client has read and agrees to MSA Articles 3–6 regarding revisions, reshoot fees, site access, safety, travel and mobilization, cancellations, and trade-out credit;",
};

const PARAGRAPH_RE = /<w:p\b[^>]*?\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;

function paragraphText(paragraphXml) {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

function splitParagraphs(xml) {
  const paragraphs = [];
  for (const match of xml.matchAll(PARAGRAPH_RE)) {
    paragraphs.push({
      xml: match[0],
      text: paragraphText(match[0]),
      start: match.index ?? 0,
    });
  }
  return paragraphs;
}

function findParagraphIndex(paragraphs, predicate, fromIndex = 0) {
  for (let i = fromIndex; i < paragraphs.length; i++) {
    if (predicate(paragraphs[i].text, i)) return i;
  }
  return -1;
}

function markRange(excluded, start, end) {
  if (start < 0 || end < 0 || end <= start) return;
  for (let i = start; i < end; i++) excluded.add(i);
}

function buildExclusionSet(paragraphs, { includeTravel, includeTradeOut }) {
  const excluded = new Set();

  if (!includeTradeOut) {
    const defIndex = findParagraphIndex(
      paragraphs,
      (text) => text.includes("1.12") && text.includes("Trade-Out Credit"),
    );
    if (defIndex >= 0) excluded.add(defIndex);

    const article6Start = findParagraphIndex(paragraphs, (text) =>
      text.includes("ARTICLE 6 — RECIPROCAL"),
    );
    const article7Start = findParagraphIndex(
      paragraphs,
      (text) => text.includes("ARTICLE 7 — TERM"),
      article6Start >= 0 ? article6Start : 0,
    );
    markRange(excluded, article6Start, article7Start);
  }

  if (!includeTravel) {
    const travel46 = findParagraphIndex(paragraphs, (text) =>
      text.includes("4.6 Travel and Mobilization"),
    );
    if (travel46 >= 0) excluded.add(travel46);
  }

  if (!includeTravel) {
    const scheduleTravelStart = findParagraphIndex(paragraphs, (text) =>
      text.includes("3.5 TRAVEL"),
    );
    const scheduleTradeStart = findParagraphIndex(
      paragraphs,
      (text) => text.includes("4. TRADE-OUT CREDIT ELECTION"),
      scheduleTravelStart >= 0 ? scheduleTravelStart : 0,
    );
    const scheduleProjectStart = findParagraphIndex(
      paragraphs,
      (text) => text.includes("5. PROJECT-SPECIFIC"),
      scheduleTravelStart >= 0 ? scheduleTravelStart : 0,
    );
    const scheduleTravelEnd =
      scheduleTradeStart > scheduleTravelStart
        ? scheduleTradeStart
        : scheduleProjectStart;
    markRange(excluded, scheduleTravelStart, scheduleTravelEnd);
  }

  if (!includeTradeOut) {
    const scheduleTradeStart = findParagraphIndex(paragraphs, (text) =>
      text.includes("4. TRADE-OUT CREDIT ELECTION"),
    );
    const scheduleProjectStart = findParagraphIndex(
      paragraphs,
      (text) => text.includes("5. PROJECT-SPECIFIC"),
      scheduleTradeStart >= 0 ? scheduleTradeStart : 0,
    );
    markRange(excluded, scheduleTradeStart, scheduleProjectStart);
  }

  return excluded;
}

function replaceSowAcknowledgment(paragraphs, variantKey) {
  const target = SOW_ACKNOWLEDGMENT_TEXT[variantKey];
  const ackIndex = findParagraphIndex(paragraphs, (text) =>
    text.trimStart().startsWith("(d) Client has read and agrees to MSA Articles"),
  );
  if (ackIndex < 0) {
    throw new Error(`SOW acknowledgment paragraph not found for variant ${variantKey}`);
  }

  const paragraph = paragraphs[ackIndex];
  const updatedXml = applyTextTransformToParagraphXml(paragraph.xml, (text) => {
    if (text.trimStart().startsWith("(d) Client has read and agrees to MSA Articles")) {
      return target;
    }
    return text;
  });

  paragraphs[ackIndex] = {
    ...paragraph,
    xml: updatedXml,
    text: paragraphText(updatedXml),
  };
}

function rebuildDocumentXml(xml, paragraphs, excluded) {
  const kept = paragraphs.filter((_, index) => !excluded.has(index)).map((p) => p.xml);
  const bodyStart = xml.indexOf("<w:body>");
  const bodyEnd = xml.indexOf("</w:body>");
  if (bodyStart < 0 || bodyEnd < 0) {
    throw new Error("Could not locate w:body in document.xml");
  }

  const bodyOpenEnd = bodyStart + "<w:body>".length;
  const sectPrMatch = xml.slice(bodyEnd).match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch?.[0] ?? "";

  return xml.slice(0, bodyOpenEnd) + kept.join("") + sectPr + xml.slice(bodyEnd);
}

function xmlToPlainText(xml) {
  return xml
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlText(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function applyTextTransformToParagraphXml(paragraphXml, transform) {
  return paragraphXml.replace(
    /<w:t([^>]*)>([^<]*)<\/w:t>/g,
    (full, attrs, rawContent) => {
      const decoded = decodeXmlText(rawContent);
      const updated = transform(decoded);
      if (updated === decoded) return full;
      return `<w:t${attrs}>${escapeXml(updated)}</w:t>`;
    },
  );
}

/** Shift article/section numbers above removedArticle down by one (avoids cascade bugs). */
function downshiftRemovedArticleReferences(text, removedArticleNumber) {
  let result = text.replace(
    /(\d{1,2})\.(\d{1,2})–(\d{1,2})\.(\d{1,2})/g,
    (match, articleStart, sectionStart, articleEnd, sectionEnd) => {
      const shift = (article) =>
        Number(article) > removedArticleNumber ? String(Number(article) - 1) : article;
      return `${shift(articleStart)}.${sectionStart}–${shift(articleEnd)}.${sectionEnd}`;
    },
  );

  result = result.replace(/ARTICLE (\d{1,2}) —/g, (match, article) => {
    const num = Number(article);
    return num > removedArticleNumber ? `ARTICLE ${num - 1} —` : match;
  });

  result = result.replace(/MSA Article (\d{1,2})/g, (match, article) => {
    const num = Number(article);
    return num > removedArticleNumber ? `MSA Article ${num - 1}` : match;
  });

  result = result.replace(/Section (\d{1,2})\.(\d{1,2})/g, (match, article, section) => {
    const num = Number(article);
    return num > removedArticleNumber
      ? `Section ${num - 1}.${section}`
      : match;
  });

  result = result.replace(/Article (\d{1,2})(?=[ .])/g, (match, article) => {
    const num = Number(article);
    return num > removedArticleNumber ? `Article ${num - 1}` : match;
  });

  result = result.replace(/\b(\d{1,2})\.(\d{1,2})\b/g, (match, article, section) => {
    const num = Number(article);
    return num > removedArticleNumber ? `${num - 1}.${section}` : match;
  });

  return result;
}

function renumberParagraphText(text, { includeTravel, includeTradeOut }) {
  let result = text;

  if (!includeTradeOut) {
    result = result.replace(/1\.13 "/g, '1.12 "');
    result = downshiftRemovedArticleReferences(result, 6);
  }

  const scheduleSectionsRemoved =
    (!includeTravel ? 1 : 0) + (!includeTradeOut ? 1 : 0);

  if (scheduleSectionsRemoved > 0) {
    result = result.replace("6. SOW ACKNOWLEDGMENTS", "5. SOW ACKNOWLEDGMENTS");
    result = result.replace("5. PROJECT-SPECIFIC NOTES", "4. PROJECT-SPECIFIC NOTES");
  }

  return result;
}

function applyRenumberingToParagraphs(paragraphs, excluded, variant) {
  const transform = (text) => renumberParagraphText(text, variant);

  for (let i = 0; i < paragraphs.length; i++) {
    if (excluded.has(i)) continue;

    const updatedXml = applyTextTransformToParagraphXml(paragraphs[i].xml, transform);
    if (updatedXml !== paragraphs[i].xml) {
      paragraphs[i] = {
        ...paragraphs[i],
        xml: updatedXml,
        text: paragraphText(updatedXml),
      };
    }
  }
}

function assertSequentialNumbering(text, variantKey, { includeTravel, includeTradeOut }) {
  const forbiddenGaps = [];

  if (!includeTradeOut) {
    forbiddenGaps.push(
      '"Trade-Out Credit" means',
      "ARTICLE 6 — RECIPROCAL",
      "4. TRADE-OUT CREDIT ELECTION",
      "1.13 ",
      "1.13 \"",
      "ARTICLE 7 — TERM",
    );
    if (!text.includes("ARTICLE 6 — TERM")) {
      throw new Error(`Variant ${variantKey} missing renumbered ARTICLE 6 — TERM`);
    }
    if (!text.includes('1.12 "Subscription Courses"')) {
      throw new Error(`Variant ${variantKey} missing renumbered 1.12 Subscription Courses`);
    }
  } else if (!text.includes("ARTICLE 6 — RECIPROCAL")) {
    throw new Error(`Variant ${variantKey} missing ARTICLE 6 — RECIPROCAL`);
  }

  if (!includeTravel) {
    forbiddenGaps.push("4.6 Travel and Mobilization", "3.5 TRAVEL");
  }

  const scheduleSectionsRemoved =
    (!includeTravel ? 1 : 0) + (!includeTradeOut ? 1 : 0);
  if (scheduleSectionsRemoved > 0) {
    forbiddenGaps.push("5. PROJECT-SPECIFIC NOTES", "6. SOW ACKNOWLEDGMENTS");
    if (!text.includes("4. PROJECT-SPECIFIC NOTES")) {
      throw new Error(`Variant ${variantKey} missing renumbered Schedule A section 4`);
    }
    if (!text.includes("5. SOW ACKNOWLEDGMENTS")) {
      throw new Error(`Variant ${variantKey} missing renumbered Schedule A section 5`);
    }
  }

  for (const marker of forbiddenGaps) {
    if (text.includes(marker)) {
      throw new Error(`Variant ${variantKey} still contains gap marker: ${marker}`);
    }
  }

  if (includeTravel && !text.includes("4.6 Travel and Mobilization")) {
    throw new Error(`Variant ${variantKey} missing travel section 4.6`);
  }
  if (includeTravel && !text.includes("3.5 TRAVEL")) {
    throw new Error(`Variant ${variantKey} missing Schedule A section 3.5`);
  }
  if (includeTradeOut && !text.includes("4. TRADE-OUT CREDIT ELECTION")) {
    throw new Error(`Variant ${variantKey} missing Schedule A trade-out section`);
  }
}

const SIGNATURE_SECTION_HEADINGS = [
  "SIGNATURE PAGE — MASTER SERVICE AGREEMENT",
  "SIGNATURE BLOCK — SCHEDULE A",
];

const PAGE_BREAK_PARAGRAPH =
  '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function findContainingParagraphStart(xml, textPos) {
  let pos = 0;
  while ((pos = xml.indexOf("<w:p", pos)) >= 0 && pos <= textPos) {
    const tail = xml.slice(pos);
    const selfClose = tail.match(/^<w:p\b[^>]*?\/>/);
    if (selfClose) {
      pos += selfClose[0].length;
      continue;
    }
    const open = tail.match(/^<w:p\b[^>]*>/);
    if (!open) break;
    const end = xml.indexOf("</w:p>", pos);
    if (end < 0) break;
    const pEnd = end + "</w:p>".length;
    if (textPos >= pos && textPos < pEnd) return pos;
    pos = pEnd;
  }
  return -1;
}

function ensureSignaturePageBreaksInXml(xml) {
  let result = xml;

  for (const heading of SIGNATURE_SECTION_HEADINGS) {
    const idx = result.indexOf(heading);
    if (idx < 0) continue;

    const pStart = findContainingParagraphStart(result, idx);
    if (pStart < 0) continue;

    const before = result.slice(Math.max(0, pStart - 500), pStart);
    if (/w:type="page"/.test(before)) continue;

    result =
      result.slice(0, pStart) + PAGE_BREAK_PARAGRAPH + result.slice(pStart);
  }

  return result;
}

function ensureProjectSpecificNotesPlaceholderInXml(xml) {
  if (xml.includes("{{ProjectSpecificNotes}}")) return xml;

  const paragraphs = splitParagraphs(xml);
  const headingIndex = findParagraphIndex(paragraphs, (text) =>
    text.includes("PROJECT-SPECIFIC NOTES"),
  );
  if (headingIndex < 0) {
    throw new Error("PROJECT-SPECIFIC NOTES section not found in contract template");
  }

  const underscoreIndices = [];
  for (let i = headingIndex + 1; i < paragraphs.length; i++) {
    const trimmed = paragraphs[i].text.trim();
    if (/^_{5,}$/.test(trimmed)) {
      underscoreIndices.push(i);
    } else if (underscoreIndices.length > 0) {
      break;
    }
  }

  if (underscoreIndices.length === 0) {
    throw new Error(
      "Underscore placeholder lines not found under PROJECT-SPECIFIC NOTES",
    );
  }

  const firstPara = paragraphs[underscoreIndices[0]];
  const mergeXml = firstPara.xml.replace(
    /<w:t([^>]*)>[^<]*<\/w:t>/,
    "<w:t$1>{{ProjectSpecificNotes}}</w:t>",
  );
  paragraphs[underscoreIndices[0]] = {
    ...firstPara,
    xml: mergeXml,
    text: "{{ProjectSpecificNotes}}",
  };

  const removeSet = new Set(underscoreIndices.slice(1));
  return rebuildDocumentXml(xml, paragraphs, removeSet);
}

function patchMasterDocumentXml(xml) {
  return ensureProjectSpecificNotesPlaceholderInXml(xml);
}

function buildVariant(masterXml, variant) {
  const paragraphs = splitParagraphs(masterXml);
  const excluded = buildExclusionSet(paragraphs, variant);
  replaceSowAcknowledgment(paragraphs, variant.key);
  applyRenumberingToParagraphs(paragraphs, excluded, variant);

  let rebuilt = rebuildDocumentXml(masterXml, paragraphs, excluded);
  rebuilt = ensureSignaturePageBreaksInXml(rebuilt);
  const text = xmlToPlainText(rebuilt);
  assertSequentialNumbering(text, variant.key, variant);
  return rebuilt;
}

function writeVariant(patchedMasterXml, masterPath, outputPath, variant) {
  const zip = new AdmZip(readFileSync(masterPath));
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("word/document.xml not found");

  const updatedXml = buildVariant(patchedMasterXml, variant);
  zip.updateFile("word/document.xml", Buffer.from(updatedXml, "utf8"));
  zip.writeZip(outputPath);
  console.log(`  ${variant.key} → ${outputPath}`);
}

if (!existsSync(masterDocx)) {
  console.error("Master contract not found:", masterDocx);
  process.exit(1);
}

mkdirSync(contractsDir, { recursive: true });

const masterZip = new AdmZip(readFileSync(masterDocx));
const masterEntry = masterZip.getEntry("word/document.xml");
if (!masterEntry) throw new Error("word/document.xml not found in master contract");
const patchedMasterXml = patchMasterDocumentXml(
  masterEntry.getData().toString("utf8"),
);

console.log("Building contract variants from:", masterDocx);
for (const variant of VARIANTS) {
  const outputPath = join(contractsDir, `Birdseye-MSA-SOW-${variant.key}.docx`);
  writeVariant(patchedMasterXml, masterDocx, outputPath, variant);
}

const masterCopy = join(contractsDir, "Birdseye-MSA-SOW-master.docx");
copyFileSync(masterDocx, masterCopy);
console.log(`  master copy → ${masterCopy}`);
console.log("\nDone. Set DOCUSIGN_CONTRACT_DOCX_DIR=docs/legal/contracts in .env.local");
