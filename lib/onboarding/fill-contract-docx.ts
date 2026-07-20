import AdmZip from "adm-zip";
import { readFileSync } from "node:fs";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Word line break inside a paragraph run. */
function wordLineBreakXml() {
  return "</w:t><w:br/><w:t xml:space=\"preserve\">";
}

function formatValueForWordXml(value: string) {
  return escapeXml(value).replace(/\r\n/g, "\n").replace(/\n/g, wordLineBreakXml());
}

function replacePlaceholderInXml(xml: string, key: string, value: string) {
  const formatted = formatValueForWordXml(value ?? "");
  const simple = `{{${key}}}`;
  if (xml.includes(simple)) {
    return xml.replaceAll(simple, formatted);
  }

  // Word often splits {{FieldName}} across multiple <w:r> runs — allow XML between parts.
  const splitPattern = new RegExp(
    `\\{\\{(?:<[^>]+>)*${key}(?:<[^>]+>)*\\}\\}`,
    "g",
  );
  return xml.replace(splitPattern, formatted);
}

function findRemainingPlaceholders(xml: string) {
  const intact = xml.match(/\{\{[A-Za-z0-9_]+\}\}/g) ?? [];
  const split: string[] = [];
  for (const match of xml.matchAll(/\{\{(?:<[^>]+>)*([A-Za-z0-9_]+)(?:<[^>]+>)*\}\}/g)) {
    split.push(`{{${match[1]}}}`);
  }
  return [...new Set([...intact, ...split])];
}

const XML_PARTS = [
  "word/document.xml",
  "word/header1.xml",
  "word/header2.xml",
  "word/footer1.xml",
  "word/footer2.xml",
];

/**
 * Fill {{FieldName}} placeholders in a contract .docx with merge values.
 * Text becomes part of the document body — no DocuSign text tabs required.
 */
export function fillContractDocx(
  templatePath: string,
  mergeFields: Record<string, string>,
): Buffer {
  const zip = new AdmZip(readFileSync(templatePath));

  for (const part of XML_PARTS) {
    const entry = zip.getEntry(part);
    if (!entry) continue;

    let xml = entry.getData().toString("utf8");
    for (const [key, rawValue] of Object.entries(mergeFields)) {
      xml = replacePlaceholderInXml(xml, key, rawValue ?? "");
    }

    const remaining = findRemainingPlaceholders(xml);
    if (remaining?.length) {
      const unique = [...new Set(remaining)];
      throw new Error(
        `Contract template still has unfilled placeholders after merge: ${unique.join(", ")}`,
      );
    }

    zip.updateFile(part, Buffer.from(xml, "utf8"));
  }

  return zip.toBuffer();
}

export function filledContractDocxBase64(
  templatePath: string,
  mergeFields: Record<string, string>,
) {
  return fillContractDocx(templatePath, mergeFields).toString("base64");
}
