import {
  resolveBillingSummary,
  resolvePlan,
} from "@/lib/onboarding/client-utils";
import {
  formatScheduleAText,
  formatScheduleACoursesBlock,
  formatScheduleCourseLine,
  resolveScheduleCourseEntries,
} from "@/lib/onboarding/contract-schedule";
import {
  formatTravelMobilizationFeeLabel,
  resolveTravelMobilizationFeeCents,
} from "@/lib/pricing/travel";
import { buildTradeOutMergeFields } from "@/lib/onboarding/trade-out-merge";
import {
  contractVariantIncludesTradeOut,
  contractVariantIncludesTravel,
  resolveContractVariant,
} from "@/lib/onboarding/contract-variants";
import type { Client, ClientCourse, ClientWithCourses } from "@/lib/db/schema";

export type ContractMergeFields = Record<string, string>;

const PRODUCTION_SCHEDULE_TBD = "TBD";

function mergeValueOrTbd(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || PRODUCTION_SCHEDULE_TBD;
}

function mergeValueOrNa(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || "N/A";
}

function formatClientAddress(client: ClientWithCourses): string {
  const line1 = client.billingAddressLine1?.trim();
  const line2 = client.billingAddressLine2?.trim();
  const city = client.billingCity?.trim();
  const state = client.billingState?.trim();
  const zip = client.billingZip?.trim();

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const cityLine = [cityStateZip, zip].filter(Boolean).join(" ");
  const billing = [line1, line2, cityLine].filter(Boolean).join(", ");

  if (billing) return billing;

  const firstCourse = client.courses?.[0];
  if (firstCourse) {
    const courseCityState = [firstCourse.courseCity?.trim(), firstCourse.courseState?.trim()]
      .filter(Boolean)
      .join(", ");
    const courseLine = [
      firstCourse.courseAddressLine1?.trim(),
      [courseCityState, firstCourse.courseZip?.trim()].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
    if (courseLine) return courseLine;
  }

  return "";
}

/** Merge fields for DocuSign template text tabs — scales to any number of courses. */
export function buildContractMergeFields(client: ClientWithCourses): ContractMergeFields {
  const courses = client.courses ?? [];
  const plan = resolvePlan(client);
  const billing = resolveBillingSummary(client);
  const scheduleCourses = resolveScheduleCourseEntries(client, courses);
  const org = client.organizationName?.trim() || client.courseName || "Client";
  const variant = resolveContractVariant(client);

  const fields: ContractMergeFields = {
    ClientLegalName: org,
    ClientAddress: formatClientAddress(client),
    OrganizationName: org,
    ContactName: client.contactName?.trim() || "",
    ContactTitle: client.contactTitle?.trim() || "",
    ContactEmail: client.contactEmail?.trim() || "",
    BillingApEmail: mergeValueOrNa(client.billingApEmail),
    ContactPhone: client.contactPhone?.trim() || "",
    CourseCount: String(scheduleCourses.length),
    BillingPlan: plan === "monthly" ? "Monthly" : "Annual",
    ScheduleA_Text: formatScheduleAText(client, courses, plan),
    ScheduleA_Courses: formatScheduleACoursesBlock(client, courses),
    SubscriptionTotal: billing?.listSubscriptionAmountLabel ?? "",
    RenewalTotal: billing?.listRenewalAmountLabel
      ? `${billing.listRenewalAmountLabel}${plan === "monthly" ? "/mo" : "/yr"}`
      : "",
    AmountDueToday: billing?.amountLabel ?? "",
    MultiCourseDiscount:
      client.multiCourseDiscountCents && client.multiCourseDiscountCents > 0
        ? `${client.multiCourseDiscountPercent}%`
        : "None",
    ProductionWindow: mergeValueOrTbd(client.productionWindow),
    TeeTime1: mergeValueOrTbd(client.teeTime1),
    TeeTime2: mergeValueOrTbd(client.teeTime2),
    TeeTime3: mergeValueOrTbd(client.teeTime3),
    OnSiteCourseRepresentative: mergeValueOrTbd(client.onSiteCourseRepresentative),
    SpecialAccessInstructions: mergeValueOrTbd(client.specialAccessInstructions),
    ProjectSpecificNotes: mergeValueOrNa(client.projectSpecificNotes),
  };

  if (contractVariantIncludesTravel(variant)) {
    fields.TravelMobilizationFee = resolveTravelMobilizationFeeCents(client)
      ? formatTravelMobilizationFeeLabel()
      : "None";
  }

  if (contractVariantIncludesTradeOut(variant)) {
    Object.assign(fields, buildTradeOutMergeFields(client));
  }

  scheduleCourses.forEach((entry, index) => {
    const n = index + 1;
    fields[`Course${n}_Name`] = entry.courseName;
    fields[`Course${n}_Holes`] = String(entry.customHoleCount ?? entry.holeCount);
    fields[`Course${n}_Location`] =
      [entry.courseCity, entry.courseState, entry.courseZip]
        .filter(Boolean)
        .join(", ") ||
      entry.courseAddressLine1?.trim() ||
      "";
  });

  return fields;
}

export const DOCUSIGN_MERGE_FIELD_NAMES = [
  "ClientLegalName",
  "ClientAddress",
  "OrganizationName",
  "ContactName",
  "ContactTitle",
  "ContactEmail",
  "BillingApEmail",
  "ContactPhone",
  "CourseCount",
  "BillingPlan",
  "ScheduleA_Text",
  "ScheduleA_Courses",
  "SubscriptionTotal",
  "RenewalTotal",
  "AmountDueToday",
  "MultiCourseDiscount",
  "TravelMobilizationFee",
  "ProductionWindow",
  "TeeTime1",
  "TeeTime2",
  "TeeTime3",
  "OnSiteCourseRepresentative",
  "SpecialAccessInstructions",
  "ProjectSpecificNotes",
  "TradeOutElection",
  "TradeOutCreditAmount",
  "TradeOutCompRoundsPerYear",
  "TradeOutMaxPlayersPerRound",
  "TradeOutBookingRestrictions",
  "TradeOutBookingContact",
] as const;

export { formatScheduleCourseLine };
