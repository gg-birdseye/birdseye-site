import {
  TRAVEL_DISTANCE_THRESHOLD_MILES,
  TRAVEL_MOBILIZATION_FEE_LABEL,
  TRAVEL_ORIGIN_LABEL,
  formatTravelMobilizationFeeLabel,
} from "@/lib/pricing/travel";

/** Onboarding agreement excerpt — travel beyond Richmond, UT. */
export function getTravelMobilizationProvisionText(): string {
  const fee = formatTravelMobilizationFeeLabel();
  return `On-site production may require travel when your course is located more than ${TRAVEL_DISTANCE_THRESHOLD_MILES} miles from ${TRAVEL_ORIGIN_LABEL}. When applicable, you agree that you are responsible for travel and mobilization costs. A one-time ${TRAVEL_MOBILIZATION_FEE_LABEL} of ${fee} will be added to your initial payment at checkout. This fee is separate from your subscription and is charged once at signup.`;
}
