import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "legal");
const assetsDir = path.join(outDir, "assets");
const outFile = path.join(outDir, "Birdseye-Master-Service-Agreement-and-Schedule-A.docx");
const outFileFallback = path.join(outDir, "Birdseye-Master-Service-Agreement-and-Schedule-A-updated.docx");
const signatureSourcePath = path.join(assetsDir, "greg-geddes-signature-source.png");
const signatureImagePath = path.join(assetsDir, "greg-geddes-signature.png");

/** Black ink on transparent PNG -> black ink on solid white (Word-safe). */
async function prepareSignatureImage() {
  const pipeline = sharp(signatureSourcePath).trim().flatten({
    background: { r: 255, g: 255, b: 255 },
  });

  await pipeline.png().toFile(signatureImagePath);

  return fs.readFileSync(signatureImagePath);
}

async function signatureDimensions(maxWidth = 110) {
  const meta = await sharp(signatureImagePath).metadata();
  const width = maxWidth;
  const height = Math.max(1, Math.round((meta.height / meta.width) * width));
  return { width, height };
}

const CONTRACTOR = {
  legalName: "Birdseye Golf, LLC",
  shortName: "Birdseye",
  entityDescription: "Utah limited liability company",
  address: "625 N Cherry Creek Pkwy, Richmond, UT 84333",
  governingState: "Utah",
  venue: "Cache County, Utah",
  effectiveDate:
    "the date of the last signature affixed to this Agreement",
  signerName: "Greg Geddes",
  signerTitle: "Owner",
};

/** Visible DocuSign data-label placeholder (Field Name must match without braces). */
function mf(name) {
  return `{{${name}}}`;
}

function t(text, opts = {}) {
  return new TextRun({ text, ...opts });
}

function bold(text) {
  return t(text, { bold: true });
}

function p(children, opts = {}) {
  const runs = typeof children === "string" ? [t(children)] : children;
  return new Paragraph({ children: runs, ...opts });
}

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
}

function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
}

function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } });
}

function center(text, boldText = false) {
  return p([boldText ? bold(text, { bold: true }) : t(text)], { alignment: AlignmentType.CENTER });
}

function blank() {
  return p("");
}

/** DocuSign-friendly single-line field (avoid Word tables). */
function fieldLine(label, value) {
  return p(`${label}: ${value}`);
}

/** Manual fill-in line for fields not populated by the app. */
function manualLine(label, placeholder = "________________________________________________") {
  return p(`${label}: ${placeholder}`);
}

function signatureLine(signatureImageData, dimensions) {
  return new Paragraph({
    children: [
      t("By: "),
      new ImageRun({
        type: "png",
        data: signatureImageData,
        transformation: dimensions,
      }),
    ],
  });
}

function contractorSigBlock(signatureImageData, dimensions) {
  return [
    p([bold(`${CONTRACTOR.legalName} (Contractor)`)]),
    p("Birdseye is bound by this Agreement. Client is the sole signatory to this Agreement; Birdseye acceptance is evidenced by the authorized representative block below."),
    blank(),
    signatureLine(signatureImageData, dimensions),
    p(`Name: ${CONTRACTOR.signerName}`),
    p(`Title: ${CONTRACTOR.signerTitle}`),
    blank(),
  ];
}

function clientSigBlock(sectionLabel) {
  return [
    p([bold(`${mf("ClientLegalName")} (Client)`)]),
    blank(),
    p(`Client authorized signature (${sectionLabel}):`),
    p("By:"),
    p(`Name: ${mf("ContactName")}`),
    p(`Title: ${mf("ContactTitle")}`),
    p("Date:"),
    blank(),
  ];
}

function flattenBlocks(blocks) {
  const out = [];
  for (const block of blocks) {
    if (Array.isArray(block)) out.push(...flattenBlocks(block));
    else if (block instanceof Paragraph) out.push(block);
    else throw new Error(`Invalid document child: expected Paragraph, got ${block?.constructor?.name ?? typeof block}`);
  }
  return out;
}

const msa = (signatureImageData, signatureDimensions) => [
  center("MASTER SERVICE AGREEMENT AND MEDIA LICENSE", true),
  center(`Between ${CONTRACTOR.legalName} ("Contractor" or "${CONTRACTOR.shortName}")`),
  center(`And ${mf("ClientLegalName")} ("Client" or "Course")`),
  blank(),
  h1("MASTER SERVICE AGREEMENT"),
  blank(),
  p([
    t("This Master Service Agreement (this \""),
    bold("Agreement"),
    t("\") is entered into as of "),
    bold(CONTRACTOR.effectiveDate),
    t(" (the \""),
    bold("Effective Date"),
    t("\"), by and between "),
    bold(CONTRACTOR.legalName),
    t(", a "),
    bold(CONTRACTOR.entityDescription),
    t(" with its principal place of business at "),
    bold(CONTRACTOR.address),
    t(" (\""),
    bold(CONTRACTOR.shortName),
    t("\" or \""),
    bold("Contractor"),
    t("\"), and "),
    bold(mf("ClientLegalName")),
    t(", with its principal place of business at "),
    bold(mf("ClientAddress")),
    t(" (\""),
    bold("Client"),
    t("\" or \""),
    bold("Course"),
    t("\")."),
  ]),
  blank(),
  p([bold("WHEREAS"), t(", Birdseye is engaged in the business of providing aerial drone photography and videography, digital content production, and proprietary interactive web platform services for golf course marketing;")]),
  blank(),
  p([bold("WHEREAS"), t(", Client owns and/or operates a golf course facility and desires to engage Birdseye to perform certain production services and to license access to Birdseye's proprietary interactive web platform;")]),
  blank(),
  p([bold("WHEREAS"), t(", the parties wish to set forth the terms and conditions governing such engagement on a master basis, with specific commercial and operational terms to be defined in one or more Statements of Work attached hereto;")]),
  blank(),
  p([bold("NOW, THEREFORE"), t(", in consideration of the mutual covenants, promises, and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:")]),
  blank(),

  h2("ARTICLE 1 — DEFINITIONS"),
  p([bold("1.1 "), bold("\"Agreement\""), t(" means this Master Service Agreement, including all Schedules, Exhibits, and Statements of Work attached hereto or incorporated by reference, as amended from time to time.")]),
  p([bold("1.2 "), bold("\"Services\""), t(" means the aerial drone photography, aerial videography, mapping, digital editing, platform integration, hosting, and related professional services described in this Agreement and in any applicable Statement of Work.")]),
  p([bold("1.3 "), bold("\"Deliverables\""), t(" means the finished interactive marketing software and web platform product integrated for Client's golf course, including hosted access and integration rights thereto, as further described in Section 2. Deliverables do not include raw video files, unedited footage, project files, or other source media unless expressly agreed in writing.")]),
  p([bold("1.4 "), bold("\"Platform\""), t(" means Birdseye's proprietary interactive web platform, including all associated software, code, user interfaces, data structures, hosting infrastructure, and digital assets made available to Client under this Agreement.")]),
  p([bold("1.5 "), bold("\"Production Date\""), t(" or "), bold("\"Filming Date\""), t(" means the date(s) scheduled for on-site aerial production at Client's course, as confirmed in writing by the parties.")]),
  p([bold("1.6 "), bold("\"Production Window\""), t(" means the specific operational date and time range communicated in writing by Birdseye during which on-site filming shall occur.")]),
  p([bold("1.7 "), bold("\"Initial Term\""), t(" means the mandatory, non-cancelable twelve (12) month period commencing upon the Effective Date or as otherwise specified in Schedule A.")]),
  p([bold("1.8 "), bold("\"Subscription\""), t(" means Client's paid access to the Platform and related hosting and integration services during the Term.")]),
  p([bold("1.9 "), bold("\"Renewal Term\""), t(" means each automatic renewal period following the Initial Term, billed at the same interval as Client's selected billing plan in Schedule A (annual or monthly).")]),
  p([bold("1.10 "), bold("\"Pilot in Command\""), t(" or "), bold("\"PIC\""), t(" means the FAA-certificated remote pilot designated by Birdseye who retains operational control over all flight activities.")]),
  p([bold("1.11 "), bold("\"Statement of Work\""), t(" or "), bold("\"SOW\""), t(" means a written schedule, form, or addendum executed by both parties describing project-specific commercial terms, including those set forth in Schedule A attached hereto.")]),
  p([bold("1.12 "), bold("\"Trade-Out Credit\""), t(" means a discount or credit applied to Client's contract fees in exchange for Client's provision of complimentary golf privileges as described in Article 6 and Schedule A.")]),
  p([bold("1.13 "), bold("\"Subscription Courses\""), t(" means the golf course(s) expressly identified in Schedule A Section 1A as included in Client's Subscription. Services, Platform access, and production obligations apply to Subscription Courses only, unless expanded by written amendment.")]),
  blank(),

  h2("ARTICLE 2 — SCOPE OF SERVICES AND DELIVERABLES"),
  p([bold("2.1 Scope of Services. "), t("Birdseye shall perform the Services and provide the Deliverables as described in this Agreement and in the applicable Statement of Work. Services include, without limitation:")]),
  p("(a) Aerial drone photography and videography of Client's golf course;"),
  p("(b) Digital editing, processing, and integration of captured media into Birdseye's proprietary interactive web platform;"),
  p("(c) Configuration, hosting, and delivery of the finished interactive marketing product for Client's course; and"),
  p("(d) Ongoing platform access, hosting, and integration support during an active Subscription, subject to the terms herein."),
  p([bold("2.2 Nature of Deliverables. "), t("Client acknowledges and agrees that:")]),
  p("(a) Client shall not receive raw video files, unedited footage, or other source media as part of the standard Deliverables;"),
  p("(b) Client's primary Deliverable is hosted access and integration rights to the finished interactive marketing software and web platform product for Client's course; and"),
  p("(c) The final product delivered on the web shall be comparable in design, functionality, and overall quality to Birdseye's demonstration content and standard template offerings, accounting for reasonable course-specific variations."),
  p([bold("2.3 Standard of Performance. "), t("Birdseye shall perform the Services in a professional and workmanlike manner consistent with industry standards for commercial drone media production and SaaS platform delivery. Birdseye does not guarantee specific business outcomes, rankings, traffic, or revenue results.")]),
  p([bold("2.4 Exclusions. "), t("Unless expressly stated in a Statement of Work, Services do not include: (a) on-site reshoots or re-flights after the initial Production Date; (b) custom software development outside Birdseye's standard platform features; (c) third-party advertising spend; or (d) printing, signage, or offline media production.")]),
  blank(),

  h2("ARTICLE 3 — CONTENT REVISIONS, UPDATES, AND RESHOOTS"),
  p([bold("3.1 No Included Video Revisions. "), t("No video revisions, re-edits, or post-production modifications are included in the initial baseline purchase price. Client's course shall be filmed and documented \"as is\" on the scheduled Production Date, and Birdseye shall create all content necessary for final Platform delivery based on that production.")]),
  p([bold("3.2 Complimentary Text and Data Updates. "), t("During any active Subscription, Client is entitled to complimentary, ongoing updates to non-video platform content elements, including without limitation digital scorecard data, hole handicaps, yardage numbers, pin position descriptions, course policies, and similar textual or numerical data fields supported by the Platform. Birdseye shall use commercially reasonable efforts to implement such updates upon Client's written request.")]),
  p([bold("3.3 Video Reshoots — Additional Fee. "), t("Any Client request to reshoot, re-film, or recapture video content for one or more holes after the initial Production Date has occurred shall constitute a Video Reshoot and shall be subject to additional fees, billed separately from the Subscription. The Video Reshoot fee structure shall be as follows:")]),
  p("(a) First hole re-shot: a flat minimum fee of One Thousand Dollars ($1,000.00); plus"),
  p("(b) Each additional hole requested during the same production session: Two Hundred Dollars ($200.00) per hole."),
  p([bold("3.4 Reshoot Scheduling. "), t("Video Reshoots shall be scheduled subject to Birdseye availability, weather, airspace, and operational constraints. Reshoot fees are due in accordance with Birdseye's invoice terms and are non-refundable once scheduling commitments are made, except as required by applicable law.")]),
  blank(),

  h2("ARTICLE 4 — SITE ACCESS, COORDINATION, AND FLIGHT SAFETY"),
  p([bold("4.1 Course Access and Tee Time Reservation. "), t("Client shall provide Birdseye with safe, lawful, and unobstructed access to Client's golf course during the Production Window. Client shall explicitly reserve three (3) consecutive tee times during the specific operational Production Window provided in writing by Birdseye. Client shall coordinate with its staff, members, and guests to facilitate uninterrupted production on the holes being filmed.")]),
  p([bold("4.2 Flight Window Safety Protocol. "), t("For each hole actively being filmed:")]),
  p("(a) No active golfers, guests, or course staff shall be permitted on that specific hole during filming;"),
  p("(b) Active golfers may occupy adjacent holes, provided such activity does not create an unsafe condition or interfere with flight operations, as determined by the PIC; and"),
  p("(c) Client shall designate a course representative available on-site to assist with hole closures, safety coordination, and communication with staff and patrons."),
  p([bold("4.3 FAA Part 107 Compliance. "), t("Birdseye operates strictly under the Federal Aviation Administration's Part 107 regulations (14 C.F.R. Part 107) and all applicable federal, state, and local laws. Client acknowledges that Birdseye's flight operations are subject to airspace restrictions, NOTAMs, TFRs, regulatory requirements, and operational limitations beyond Birdseye's control.")]),
  p([bold("4.4 Pilot Authority. "), t("The PIC retains absolute and unilateral authority over all flight operations, including:")]),
  p("(a) Pre-flight inspections, risk assessments, and go/no-go decisions;"),
  p("(b) Safety coordination with Client and third parties;"),
  p("(c) Grounding or aborting flights due to safety concerns, weather, lighting, airspace constraints, equipment issues, or any condition affecting safe operations; and"),
  p("(d) Modifying flight plans, altitudes, flight paths, or production sequencing as necessary for safety and regulatory compliance."),
  p("Client agrees that PIC decisions regarding safety and flight operations shall be final and binding. Birdseye shall not be liable for delays, incomplete capture, or rescheduling resulting from PIC safety determinations or regulatory constraints."),
  p([bold("4.5 Client Cooperation. "), t("Client shall provide accurate course maps, hole descriptions, hazard information, and any known operational restrictions in advance of the Production Date. Client shall not direct or pressure the PIC to conduct unsafe or non-compliant operations.")]),
  p([bold("4.6 Travel and Mobilization. "), t("When Client's course is located more than two hundred (200) miles from Richmond, Utah, Birdseye's principal production base, Client shall be responsible for travel and mobilization costs associated with on-site production. When applicable, a one-time Travel & Mobilization Fee of One Thousand Dollars ($1,000.00) shall be due with Client's initial payment as specified in Schedule A. The Travel & Mobilization Fee covers reasonable travel expenses for the initial Production Date and is separate from the Subscription fees.")]),
  blank(),

  h2("ARTICLE 5 — CANCELLATIONS, WEATHER, AND RESCHEDULING"),
  p([bold("5.1 Weather and Operational Delays. "), t("If a scheduled shoot cannot take place due to adverse weather, unsafe lighting conditions, airspace restrictions, or other operational constraints as determined by the PIC, Birdseye and Client shall coordinate a new Production Date at no additional financial penalty to Client, provided Client remains ready, willing, and able to fulfill its access and coordination obligations. Birdseye shall use commercially reasonable efforts to reschedule promptly.")]),
  p([bold("5.2 Client-Initiated Rescheduling or Cancellation. "), t("If Client requests to reschedule or cancel a confirmed Production Window or Production Date for any reason other than weather or PIC safety determinations under Section 5.1, Client shall, within fifteen (15) days of such request, reimburse Birdseye for all accrued travel, lodging, preparation, scheduling, and other non-recoverable expenses reasonably incurred by Birdseye in connection with the scheduled production. Such reimbursement shall be in addition to, and shall not limit, any non-refundable deposits or fees due under Article 7.")]),
  p([bold("5.3 No-Show or Access Failure. "), t("If Client fails to provide reserved tee times, course access, or required on-site cooperation on the Production Date without valid weather or safety cause, Birdseye may treat the event as a Client-initiated cancellation under Section 5.2 and may invoice Client for applicable fees, expenses, and rescheduling costs.")]),
  blank(),

  h2("ARTICLE 6 — RECIPROCAL GOLF PRIVILEGES / TRADE-OUT CREDIT"),
  p([bold("6.1 Optional Election. "), t("Client may elect to receive a Trade-Out Credit against its contract fees in exchange for providing complimentary golf privileges to Birdseye, as specified in Schedule A. If Client does not elect the Trade-Out Credit in Schedule A, this Article 6 shall not apply.")]),
  p([bold("6.2 Client Obligations. "), t("In exchange for the Trade-Out Credit, Client agrees to provide Birdseye with the number of complimentary, fully comped rounds of golf per contract year specified in Schedule A, inclusive of golf cart fees, for a group of up to four (4) players per round.")]),
  p([bold("6.3 Booking Restrictions. "), t("Complimentary rounds shall be:")]),
  p("(a) Coordinated at least forty-eight (48) hours in advance with Client's pro shop or designated booking contact;"),
  p("(b) Subject to reasonable booking restrictions established by Client and disclosed in Schedule A (e.g., valid Monday–Thursday anytime, or Friday–Sunday after 1:00 PM); and"),
  p("(c) Subject to course availability, weather, and normal course operating conditions."),
  p([bold("6.4 Authorization and Approval. "), t("All complimentary rounds honored under this Article 6 count against the total number of complimentary rounds per contract year specified in Schedule A, whether or not a Birdseye representative is present in the playing group. No complimentary round may be used unless Birdseye has expressly approved that specific round with Client in writing (email is sufficient) in advance of play. Birdseye may designate the players for any approved round. Client shall not honor any comp request without Birdseye's prior written approval for that round. Client shall not substitute cash, credit, merchandise, or other consideration in lieu of honored complimentary rounds except as expressly agreed in writing.")]),
  p([bold("6.5 Revocation for Non-Performance. "), t("If Client fails to honor the agreed-upon complimentary golf rounds during any contract year, the Trade-Out Credit shall be instantly revoked without further notice, and Client shall become immediately liable to pay the full, standard, un-discounted contract price to Birdseye for the applicable billing period(s), retroactively adjusted as necessary to eliminate the Trade-Out Credit. Birdseye may invoice Client for any underpaid amounts within thirty (30) days of revocation.")]),
  p([bold("6.6 No Waiver of Other Rights. "), t("Revocation of the Trade-Out Credit shall not limit Birdseye's other remedies under this Agreement, including termination for material breach.")]),
  blank(),

  h2("ARTICLE 7 — TERM, PAYMENT, AND EARLY TERMINATION BUYOUT"),
  p([bold("7.1 Initial Term. "), t("Client's Subscription and license to the Platform are subject to a mandatory, non-cancelable Initial Term of twelve (12) months commencing on the Effective Date (or as otherwise specified in Schedule A). During the Initial Term, Client is obligated to pay all fees due under the selected billing plan in Schedule A.")]),
  p([bold("7.2 Billing Plans. "), t("Client shall select one of the following billing options in Schedule A:")]),
  p([bold("(a) Plan A — Annual/Upfront Plan")]),
  p("• A non-refundable deposit equal to fifty percent (50%) of the total annual contract amount is due upfront to book and secure the Production Date; and"),
  p("• The remaining fifty percent (50%) balance is due on the first (1st) day of the calendar month immediately following final digital product delivery on the web Platform."),
  p([bold("(b) Plan B — Monthly Plan")]),
  p("• The first month's payment is due upfront as a non-refundable booking deposit to secure the Production Date; and"),
  p("• Subsequent monthly installments begin on the first (1st) day of the calendar month immediately following final digital product delivery on the web Platform and continue through the Initial Term."),
  p([bold("7.3 Invoices and Late Payment. "), t("Unless otherwise stated in Schedule A, invoices are due net fifteen (15) days from invoice date. Past-due amounts may accrue interest at the lesser of one and one-half percent (1.5%) per month or the maximum rate permitted by law. Birdseye may suspend Platform access for non-payment after written notice and a reasonable cure period.")]),
  p([bold("7.4 Early Termination Buyout. "), t("Client explicitly agrees to pay for the entirety of the first twelve (12) months of the Subscription. If Client requests to cancel, terminate, or suspend Services for any reason prior to expiration of the Initial Term, Client shall be legally obligated to immediately buy out and pay the remaining balance due for the remainder of the twelve (12) month commitment in a lump sum within fifteen (15) days of written notice of termination. Early termination buyout amounts are non-refundable.")]),
  p([bold("7.5 Automatic Renewal. "), t("Upon expiration of the Initial Term, Client's Subscription shall automatically renew for successive Renewal Terms unless Client cancels in accordance with Section 7.7. The billing interval for each Renewal Term shall match the billing plan selected in Schedule A:")]),
  p([bold("(a) Plan A — Annual/Upfront Plan: "), t("The Subscription automatically renews for successive twelve (12) month periods. Client shall be automatically charged Birdseye's then-current annual subscription fee on each annual renewal date.")]),
  p([bold("(b) Plan B — Monthly Plan: "), t("The Subscription automatically renews on a month-to-month basis. Client shall be automatically charged Birdseye's then-current monthly subscription fee on each monthly renewal date.")]),
  p("Renewal fees shall be Birdseye's then-current standard rates for the applicable billing interval, unless otherwise agreed in writing. Birdseye shall provide written notice of any rate change at least thirty (30) days prior to the effective date of the new rate for a Renewal Term."),
  p([bold("7.6 Payment Authorization for Renewals. "), t("Client authorizes Birdseye to charge Client's payment method on file, or such other payment method Client provides, for all Renewal Term fees without additional invoice, signature, or consent for each renewal period, subject to Client's cancellation rights under Section 7.7 and applicable law.")]),
  p([bold("7.7 Cancellation of Auto-Renewal. "), t("Client may cancel automatic renewal by providing written notice to Birdseye at least thirty (30) days prior to the next scheduled renewal or billing date. Cancellation shall be effective as of the end of the then-current billing period and shall prevent future automatic renewals and charges. Cancellation does not relieve Client of payment obligations accrued through the effective cancellation date. Any request to cancel, terminate, or suspend Services during the Initial Term remains subject to Section 7.4 (Early Termination Buyout).")]),
  p([bold("7.8 Renewal Notice. "), t("For Plan A (Annual) clients, Birdseye shall use commercially reasonable efforts to send Client a renewal reminder at least thirty (30) days prior to each annual renewal date, including the renewal amount and instructions for cancellation under Section 7.7.")]),
  p([bold("7.9 Taxes. "), t("Fees are exclusive of applicable sales, use, excise, or similar taxes, which Client shall pay unless Client provides a valid exemption certificate.")]),
  blank(),

  h2("ARTICLE 8 — INTELLECTUAL PROPERTY AND LICENSING RIGHTS"),
  p([bold("8.1 Ownership. "), t("Birdseye retains full copyright, title, ownership, and intellectual property rights in and to all captured video, aerial imagery, photographs, mapping data, metadata, web assets, software code, platform architecture, templates, trade dress, and all other works of authorship or materials created, developed, or delivered in connection with the Services (collectively, \"Birdseye IP\"). No ownership interest in Birdseye IP is transferred to Client under this Agreement.")]),
  p([bold("8.2 Limited License to Client. "), t("Subject to Client's continuous compliance with this Agreement and maintenance of an active, paid Subscription, Birdseye grants Client a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) access and use the finished web Platform configured for Client's course; (b) host, display, and utilize the Platform for Client's marketing and promotional purposes in connection with Client's golf course operations; and (c) permit Client's authorized personnel to access administrative or content update features made available by Birdseye.")]),
  p([bold("8.3 License Contingency and Revocation. "), t("The license granted in Section 8.2 is strictly contingent upon Client maintaining an active, paid Subscription. If the Subscription terminates, expires without renewal, or Client defaults on payment, the license shall be instantly and automatically revoked, and Birdseye may disable Platform access without liability.")]),
  p([bold("8.4 Restrictions. "), t("Client shall not, and shall not permit any third party to: (a) copy, reproduce, download, scrape, or extract Birdseye IP except as expressly permitted through the Platform; (b) reverse engineer, decompile, disassemble, or attempt to derive source code from the Platform; (c) remove, alter, or obscure proprietary notices; (d) transfer, assign, sublicense, or encumber its license; or (e) use Birdseye IP to create a competing product or service.")]),
  p([bold("8.5 Birdseye Promotional Rights. "), t("Birdseye retains the permanent, irrevocable, worldwide, royalty-free right to use any captured footage, imagery, screenshots, platform layouts, and related materials in Birdseye's portfolio, marketing materials, social media, website, case studies, and promotional content, whether or not Client's Subscription remains active, provided such use does not misrepresent Client or disclose Client's confidential business information.")]),
  p([bold("8.6 Client Marks. "), t("Client grants Birdseye a limited license to use Client's name, logo, and course trademarks solely as necessary to perform the Services, deliver the Platform, and exercise Birdseye's promotional rights under Section 8.5.")]),
  blank(),

  h2("ARTICLE 9 — INSURANCE, LIABILITY, AND DAMAGES LIMITATION"),
  p([bold("9.1 Insurance. "), t("Birdseye agrees to maintain a minimum of One Million Dollars ($1,000,000) in commercial drone liability insurance covering its flight operations during on-site production. Upon Client's written request, Birdseye shall provide a Certificate of Insurance (COI) naming Client as an additional insured for the Production Date(s), subject to insurer requirements and availability.")]),
  p([bold("9.2 Property Damage. "), t("Birdseye's liability for direct physical damage to tangible property caused exclusively by Birdseye's equipment or Birdseye's negligent flight operations shall be subject to the limitations in Section 9.3. Client shall promptly notify Birdseye of any alleged property damage and cooperate in investigation.")]),
  p([bold("9.3 Limitation of Liability. "), t("TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:")]),
  p("(a) IN NO EVENT SHALL BIRDSEYE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOST PROFITS, LOST REVENUE, LOST GOLF BOOKINGS, LOSS OF GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO THIS AGREEMENT, THE SERVICES, OR THE PLATFORM, WHETHER BASED IN CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE, EVEN IF BIRDSEYE HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES;"),
  p("(b) BIRDSEYE'S TOTAL AGGREGATE LIABILITY FOR ANY AND ALL CLAIMS ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE TOTAL FEES PAID BY CLIENT TO BIRDSEYE UNDER THE APPLICABLE STATEMENT OF WORK DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM; AND"),
  p("(c) THE FOREGOING LIMITATIONS SHALL APPLY NOTWITHSTANDING ANY FAILURE OF ESSENTIAL PURPOSE OF ANY LIMITED REMEDY."),
  p([bold("9.4 Exceptions. "), t("Nothing in this Agreement shall limit liability for gross negligence, willful misconduct, or fraud to the extent such limitation is prohibited by applicable law.")]),
  p([bold("9.5 Indemnification by Client. "), t("Client shall indemnify, defend, and hold harmless Birdseye and its officers, employees, contractors, and agents from and against third-party claims arising from: (a) Client's breach of this Agreement; (b) Client's course operations or premises conditions not caused by Birdseye; (c) Client's instructions that contribute to unsafe operations; or (d) Client's unauthorized use of Birdseye IP.")]),
  blank(),

  h2("ARTICLE 10 — CONFIDENTIALITY"),
  p("Each party shall protect the other party's non-public business, technical, and financial information disclosed in connection with this Agreement and shall use such information solely to perform under this Agreement, except as otherwise permitted herein or required by law."),
  blank(),

  h2("ARTICLE 11 — GENERAL PROVISIONS"),
  p([bold("11.1 Entire Agreement. "), t("This Agreement, together with Schedule A and any executed Statements of Work, constitutes the entire agreement between the parties and supersedes all prior negotiations and understandings.")]),
  p([bold("11.2 Order of Precedence. "), t("In the event of conflict, Schedule A and a signed SOW shall control with respect to commercial and project-specific terms; otherwise, this Agreement shall control.")]),
  p([bold("11.3 Amendment. "), t("No amendment shall be effective unless in writing signed by both parties.")]),
  p([bold("11.4 Assignment. "), t("Client may not assign this Agreement without Birdseye's prior written consent. Birdseye may assign this Agreement in connection with a merger, acquisition, or sale of substantially all assets.")]),
  p([bold("11.5 Governing Law. "), t(`This Agreement shall be governed by the laws of the State of ${CONTRACTOR.governingState}, without regard to conflict-of-laws principles.`)]),
  p([bold("11.6 Dispute Resolution. "), t(`The parties shall attempt good-faith negotiation before initiating litigation. Exclusive venue for any action shall lie in the state or federal courts located in ${CONTRACTOR.venue}, and each party consents to personal jurisdiction therein.`)]),
  p([bold("11.7 Notices. "), t("Notices shall be in writing and delivered to the addresses set forth on the signature pages or Schedule A, or to such other address as a party designates in writing.")]),
  p([bold("11.8 Severability. "), t("If any provision is held invalid or unenforceable, the remaining provisions shall remain in full force and effect.")]),
  p([bold("11.9 Waiver. "), t("No waiver shall be effective unless in writing. Failure to enforce any provision shall not constitute a waiver of future enforcement.")]),
  p([bold("11.10 Independent Contractor. "), t("Birdseye is an independent contractor. Nothing herein creates a partnership, joint venture, agency, or employment relationship.")]),
  p([bold("11.11 Force Majeure. "), t("Neither party shall be liable for delays caused by events beyond its reasonable control, including acts of God, government actions, airspace closures, or widespread network outages, except that Client's payment obligations shall not be excused.")]),
  p([bold("11.12 Counterparts and Electronic Signatures. "), t("This Agreement may be executed in counterparts and by electronic signature, each of which shall be deemed an original.")]),
  blank(),

  new Paragraph({ children: [new PageBreak()] }),
  h2("SIGNATURE PAGE — MASTER SERVICE AGREEMENT"),
  ...contractorSigBlock(signatureImageData, signatureDimensions),
  ...clientSigBlock("MSA"),

  new Paragraph({ children: [new PageBreak()] }),

  center("SCHEDULE A: STATEMENT OF WORK (SOW)", true),
  blank(),
  p(`SOW Effective Date: ${CONTRACTOR.effectiveDate}`),
  p(`Incorporated into MSA dated: ${CONTRACTOR.effectiveDate}`),
  blank(),
  p(`This Statement of Work is issued under and governed by the Master Service Agreement between ${CONTRACTOR.legalName} and ${mf("ClientLegalName")}. Capitalized terms not defined herein have the meanings set forth in the MSA.`),
  blank(),

  h3("1. CLIENT AND COURSE INFORMATION"),
  fieldLine("Client Legal Name", mf("ClientLegalName")),
  fieldLine("Organization / Account Name (if multi-course)", mf("OrganizationName")),
  fieldLine("Primary Contact Name", mf("ContactName")),
  fieldLine("Title", mf("ContactTitle")),
  fieldLine("Email", mf("ContactEmail")),
  fieldLine("Phone", mf("ContactPhone")),
  fieldLine("Billing Contact / AP Email", mf("BillingApEmail")),
  blank(),

  h3("1A. COURSES INCLUDED IN SUBSCRIPTION"),
  p(`Number of courses in subscription: ${mf("CourseCount")}`),
  blank(),
  p("The following golf course(s) are expressly included in Client's single Subscription under this Agreement. Birdseye shall provide the Platform, hosting, production, and related Services for each listed course only. No course not listed below is included unless added by a written amendment signed by both parties."),
  blank(),
  p(mf("ScheduleA_Courses")),
  blank(),

  h3("2. PRODUCTION SCHEDULE"),
  fieldLine("Production Window (date/time range)", mf("ProductionWindow")),
  fieldLine("Reserved Tee Time 1", mf("TeeTime1")),
  fieldLine("Reserved Tee Time 2", mf("TeeTime2")),
  fieldLine("Reserved Tee Time 3", mf("TeeTime3")),
  fieldLine("On-Site Course Representative", mf("OnSiteCourseRepresentative")),
  fieldLine("Special Access Instructions", mf("SpecialAccessInstructions")),
  p("Note: Production Window and tee times may be TBD at signing and confirmed in writing by Birdseye prior to filming."),
  blank(),

  h3("3. BILLING TERMS"),
  p(`Billing plan: ${mf("BillingPlan")}`),
  p(`Subscription total: ${mf("SubscriptionTotal")}`),
  p(`Amount due today (deposit / first payment): ${mf("AmountDueToday")}`),
  p(`Multi-course discount: ${mf("MultiCourseDiscount")}`),
  p("Initial Term: 12 months (mandatory, non-cancelable per MSA Article 7)"),
  p("After Initial Term: Subscription automatically renews and charges per MSA Article 7.5 at the billing interval selected above (Annual or Monthly), unless Client cancels at least 30 days before the next renewal date."),
  blank(),

  h3("3.5 TRAVEL & MOBILIZATION FEE"),
  p(`Travel & Mobilization Fee: ${mf("TravelMobilizationFee")}`),
  p("(When applicable per MSA Section 4.6, one-time fee of $1,000.00 due with initial payment.)"),
  blank(),

  h3("4. TRADE-OUT CREDIT ELECTION (OPTIONAL)"),
  p("Select one option below (initial the selected option):"),
  blank(),
  p(mf("TradeOutElection")),
  blank(),
  fieldLine("Annual or Monthly Credit Amount", mf("TradeOutCreditAmount")),
  fieldLine("Complimentary Rounds Per Contract Year", mf("TradeOutCompRoundsPerYear")),
  fieldLine("Max Players Per Round", mf("TradeOutMaxPlayersPerRound")),
  fieldLine("Booking Restrictions", mf("TradeOutBookingRestrictions")),
  fieldLine("Booking Contact / Pro Shop Phone", mf("TradeOutBookingContact")),
  blank(),
  p("Client acknowledges revocation of credit and immediate liability for full undiscounted fees if complimentary rounds are not honored per MSA Article 6."),
  blank(),

  h3("5. PROJECT-SPECIFIC NOTES"),
  p(mf("ProjectSpecificNotes")),
  blank(),

  h3("6. SOW ACKNOWLEDGMENTS"),
  p("By signing below, each party confirms that:"),
  p("(a) This SOW is incorporated into and subject to the MSA;"),
  p("(b) The billing plan and fees selected above are binding for the Initial Term;"),
  p("(c) The course(s) listed in Section 1A are the only course(s) included in this Subscription unless amended in writing;"),
  p("(d) Client has read and agrees to MSA Articles 3–6 regarding revisions, reshoot fees, site access, safety, cancellations, and trade-out credit;"),
  p("(e) Client authorizes automatic renewal and recurring charges after the Initial Term per MSA Article 7.5–7.7, at the billing interval selected in Section 3; and"),
  p("(f) All information completed in this Schedule A is accurate and complete."),
  blank(),

  new Paragraph({ children: [new PageBreak()] }),
  h2("SIGNATURE BLOCK — SCHEDULE A: STATEMENT OF WORK"),
  ...contractorSigBlock(signatureImageData, signatureDimensions),
  ...clientSigBlock("Schedule A"),
];

fs.mkdirSync(assetsDir, { recursive: true });
const signatureImageData = await prepareSignatureImage();
const sigDimensions = await signatureDimensions();

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: flattenBlocks(msa(signatureImageData, sigDimensions)),
    },
  ],
});

fs.mkdirSync(outDir, { recursive: true });
const buffer = await Packer.toBuffer(doc);
try {
  fs.writeFileSync(outFile, buffer);
  console.log(`Created: ${outFile}`);
  console.warn(
    "\nNote: generate:contract-docx OVERWRITES this file. " +
      "For ongoing edits, open the .docx in Word and do not re-run this command. " +
      "docusign:generated-test only reads the file — it does not overwrite it.",
  );
} catch (error) {
  if (error?.code === "EBUSY") {
    fs.writeFileSync(outFileFallback, buffer);
    console.log(`Primary file locked (close Word). Created: ${outFileFallback}`);
  } else {
    throw error;
  }
}
