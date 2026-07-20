import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const legalDir = join(__dirname, "..", "docs", "legal");
const sourceDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A-updated.docx");
const outputDocx = sourceDocx;
const backupDocx = join(legalDir, "Birdseye-Master-Service-Agreement-and-Schedule-A.docx");

/** Ordered replacements: longer / more specific patterns first. */
const REPLACEMENTS = [
  [
    "Production Window (date/time range): ________________________________________________",
    "Production Window (date/time range): {{ProductionWindow}}",
  ],
  [
    "Reserved Tee Time 1: ________________________________________________",
    "Reserved Tee Time 1: {{TeeTime1}}",
  ],
  [
    "Reserved Tee Time 2: ________________________________________________",
    "Reserved Tee Time 2: {{TeeTime2}}",
  ],
  [
    "Reserved Tee Time 3: ________________________________________________",
    "Reserved Tee Time 3: {{TeeTime3}}",
  ],
  [
    "On-Site Course Representative: ________________________________________________",
    "On-Site Course Representative: {{OnSiteCourseRepresentative}}",
  ],
  [
    "Special Access Instructions: ________________________________________________",
    "Special Access Instructions: {{SpecialAccessInstructions}}",
  ],
  [
    "Billing Contact / AP Email: ________________________________________________",
    "Billing Contact / AP Email: {{BillingApEmail}}",
  ],
  [
    "Title: ________________________________________________",
    "Title: {{ContactTitle}}",
  ],
  [
    "Title: ______________________________________",
    "Title: {{ContactTitle}}",
  ],
  [
    "Booking Contact / Pro Shop Phone: ________________________________________________",
    "Booking Contact / Pro Shop Phone: {{TradeOutBookingContact}}",
  ],
  [
    "Annual or Monthly Credit Amount: $________ per ________",
    "Annual or Monthly Credit Amount: {{TradeOutCreditAmount}}",
  ],
  [
    "Complimentary Rounds Per Contract Year: ________ rounds",
    "Complimentary Rounds Per Contract Year: {{TradeOutCompRoundsPerYear}} rounds",
  ],
  [
    "Max Players Per Round: Up to 4 (inclusive of cart fees)",
    "Max Players Per Round: {{TradeOutMaxPlayersPerRound}}",
  ],
  [
    "Booking Restrictions: e.g., Mon–Thu anytime; Fri–Sun after 1:00 PM",
    "Booking Restrictions: {{TradeOutBookingRestrictions}}",
  ],
  [
    "Option A — No Trade-Out Credit. Client pays full contract fees per Section 3 above.",
    "{{TradeOutElection}}",
  ],
];

const REQUIRED_PLACEHOLDERS = [
  "ClientLegalName",
  "ClientAddress",
  "OrganizationName",
  "ContactName",
  "ContactTitle",
  "ContactEmail",
  "BillingApEmail",
  "ContactPhone",
  "CourseCount",
  "ScheduleA_Courses",
  "ProductionWindow",
  "TeeTime1",
  "TeeTime2",
  "TeeTime3",
  "OnSiteCourseRepresentative",
  "SpecialAccessInstructions",
  "BillingPlan",
  "SubscriptionTotal",
  "AmountDueToday",
  "MultiCourseDiscount",
  "TravelMobilizationFee",
  "TradeOutElection",
  "TradeOutCreditAmount",
  "TradeOutCompRoundsPerYear",
  "TradeOutMaxPlayersPerRound",
  "TradeOutBookingRestrictions",
  "TradeOutBookingContact",
];

function updateDocumentXml(xml) {
  let updated = xml;
  for (const [from, to] of REPLACEMENTS) {
    if (!updated.includes(from)) {
      console.warn(`Pattern not found (skipped): ${from.slice(0, 60)}...`);
      continue;
    }
    updated = updated.split(from).join(to);
    console.log(`Replaced: ${from.slice(0, 50)}...`);
  }
  return updated;
}

function verifyPlaceholders(xml) {
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
  const missing = REQUIRED_PLACEHOLDERS.filter(
    (label) => !text.includes(`{{${label}}}`),
  );
  return { text, missing };
}

function patchDocx(inputPath, outputPath) {
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("word/document.xml not found in docx");

  const xml = entry.getData().toString("utf8");
  const updatedXml = updateDocumentXml(xml);
  zip.updateFile("word/document.xml", Buffer.from(updatedXml, "utf8"));
  zip.writeZip(outputPath);
  return verifyPlaceholders(updatedXml);
}

console.log("Updating contract placeholders...");
console.log("Source:", sourceDocx);

const { missing } = patchDocx(sourceDocx, outputDocx);

if (missing.length) {
  console.error("\nMissing placeholders after update:");
  for (const label of missing) console.error(`  - {{${label}}}`);
  process.exit(1);
}

copyFileSync(outputDocx, backupDocx);
console.log("\nAll required placeholders present in document text.");
console.log("Saved:", outputDocx);
console.log("Synced:", backupDocx);
