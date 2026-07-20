/**
 * Fields that appear in multiple places on the contract.
 * Each entry is an extra Text tab placement — same Data Label, different position.
 * API pre-fill sets the same value on every tab that shares a label.
 *
 * Calibrate page/x/y against your PDF if placements drift after a layout change.
 */
export const REPEAT_FIELD_PLACEMENTS = [
  // ClientLegalName — cover, Schedule A party block, MSA signature, Schedule A signature
  { tabLabel: "ClientLegalName", pageNumber: "1", xPosition: "190", yPosition: "99", width: "280", height: "18" },
  { tabLabel: "ClientLegalName", pageNumber: "1", xPosition: "215", yPosition: "216", width: "280", height: "18" },
  { tabLabel: "ClientLegalName", pageNumber: "8", xPosition: "110", yPosition: "145", width: "280", height: "18" },
  { tabLabel: "ClientLegalName", pageNumber: "8", xPosition: "153", yPosition: "217", width: "280", height: "18" },
  { tabLabel: "ClientLegalName", pageNumber: "9", xPosition: "72", yPosition: "190", width: "280", height: "18" },

  // ContactName — MSA signature, Schedule A body, Schedule A signature
  { tabLabel: "ContactName", pageNumber: "9", xPosition: "101", yPosition: "262", width: "200", height: "18" },
  { tabLabel: "ContactName", pageNumber: "8", xPosition: "170", yPosition: "262", width: "200", height: "18" },

  // ContactTitle — same pattern
  { tabLabel: "ContactTitle", pageNumber: "9", xPosition: "96", yPosition: "285", width: "200", height: "18" },
  { tabLabel: "ContactTitle", pageNumber: "8", xPosition: "96", yPosition: "284", width: "200", height: "18" },

  // ContactEmail — Schedule A (two blanks)
  { tabLabel: "ContactEmail", pageNumber: "8", xPosition: "101", yPosition: "306", width: "240", height: "18" },
];

/** Labels allowed to appear on more than one tab (intentional repeats). */
export const REPEATABLE_LABELS = new Set([
  "ClientLegalName",
  "ContactName",
  "ContactTitle",
  "ContactEmail",
]);
