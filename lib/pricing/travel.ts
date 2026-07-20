import { formatPrice } from "@/lib/pricing";
import type { Client } from "@/lib/db/schema";

export const TRAVEL_ORIGIN_LABEL = "Richmond, UT";
export const TRAVEL_DISTANCE_THRESHOLD_MILES = 200;
export const TRAVEL_MOBILIZATION_FEE_CENTS = 100_000;
export const TRAVEL_MOBILIZATION_FEE_LABEL = "Travel & Mobilization Fee";

export function resolveTravelMobilizationFeeCents(client: Client): number {
  return client.travelMobilizationFeeRequired
    ? TRAVEL_MOBILIZATION_FEE_CENTS
    : 0;
}

export function formatTravelMobilizationFeeLabel(): string {
  return formatPrice(TRAVEL_MOBILIZATION_FEE_CENTS / 100);
}
