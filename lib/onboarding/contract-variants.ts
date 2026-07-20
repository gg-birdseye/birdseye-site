export const CONTRACT_VARIANTS = [
  "base",
  "travel",
  "trade_out",
  "travel_trade_out",
] as const;

export type ContractVariant = (typeof CONTRACT_VARIANTS)[number];

export const CONTRACT_VARIANT_FILENAMES: Record<ContractVariant, string> = {
  base: "Birdseye-MSA-SOW-base.docx",
  travel: "Birdseye-MSA-SOW-travel.docx",
  trade_out: "Birdseye-MSA-SOW-trade_out.docx",
  travel_trade_out: "Birdseye-MSA-SOW-travel_trade_out.docx",
};

export const CONTRACT_VARIANT_LABELS: Record<ContractVariant, string> = {
  base: "Standard (no travel fee or trade-out)",
  travel: "Travel & mobilization fee",
  trade_out: "Trade-out credit",
  travel_trade_out: "Travel fee + trade-out credit",
};

type ContractVariantInput = {
  travelMobilizationFeeRequired?: boolean | null;
  tradeOutElected?: boolean | null;
  contractVariant?: string | null;
};

export function resolveContractVariant(
  client: ContractVariantInput,
): ContractVariant {
  const stored = client.contractVariant?.trim();
  if (stored && CONTRACT_VARIANTS.includes(stored as ContractVariant)) {
    return stored as ContractVariant;
  }

  const travel = Boolean(client.travelMobilizationFeeRequired);
  const tradeOut = Boolean(client.tradeOutElected);

  if (travel && tradeOut) return "travel_trade_out";
  if (travel) return "travel";
  if (tradeOut) return "trade_out";
  return "base";
}

export function contractVariantIncludesTravel(variant: ContractVariant) {
  return variant === "travel" || variant === "travel_trade_out";
}

export function contractVariantIncludesTradeOut(variant: ContractVariant) {
  return variant === "trade_out" || variant === "travel_trade_out";
}
