/**
 * Sign/date tab anchors — matched to section headers in the Word template.
 * Tabs are offset to the blank area beside plain "By:" / "Date:" lines below each header.
 */
export const CLIENT_SIGN_SECTION_HEADERS = {
  msa: "Client authorized signature (MSA):",
  scheduleA: "Client authorized signature (Schedule A):",
} as const;

export function buildClientSignHereTabs(documentId = "1") {
  return [
    {
      documentId,
      anchorString: CLIENT_SIGN_SECTION_HEADERS.msa,
      anchorUnits: "pixels",
      anchorXOffset: "22",
      anchorYOffset: "34",
    },
    {
      documentId,
      anchorString: CLIENT_SIGN_SECTION_HEADERS.scheduleA,
      anchorUnits: "pixels",
      anchorXOffset: "22",
      anchorYOffset: "34",
    },
  ];
}

export function buildClientDateSignedTabs(documentId = "1") {
  return [
    {
      documentId,
      anchorString: CLIENT_SIGN_SECTION_HEADERS.msa,
      anchorUnits: "pixels",
      anchorXOffset: "26",
      anchorYOffset: "94",
    },
    {
      documentId,
      anchorString: CLIENT_SIGN_SECTION_HEADERS.scheduleA,
      anchorUnits: "pixels",
      anchorXOffset: "26",
      anchorYOffset: "94",
    },
  ];
}
