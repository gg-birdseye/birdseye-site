import type { Client } from "@/lib/db/schema";
import { formatPrice } from "@/lib/pricing";

export const TRADE_OUT_NOT_APPLICABLE = "N/A";

export const TRADE_OUT_OPTION_A = "Option A";

export const TRADE_OUT_OPTION_B = "Option B";

export function formatTradeOutMaxPlayers(maxPlayers: number | null | undefined) {
  const count = maxPlayers && maxPlayers > 0 ? maxPlayers : 4;
  return `Up to ${count} (inclusive of cart fees)`;
}

export function parseTradeOutCreditAmountDollars(raw: string | null | undefined) {
  const normalized = raw?.trim().replace(/,/g, "").replace(/^\$/, "") ?? "";
  if (!normalized) return null;

  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return amount;
}

/** Contract merge label, e.g. "$1,000 per year". */
export function formatTradeOutCreditAmountForContract(
  raw: string | null | undefined,
) {
  const amount = parseTradeOutCreditAmountDollars(raw);
  if (amount == null) return raw?.trim() || "";

  return `${formatPrice(amount)} per year`;
}

export function normalizeTradeOutCreditAmountInput(raw: string | null | undefined) {
  const amount = parseTradeOutCreditAmountDollars(raw);
  if (amount == null) return null;

  return String(amount);
}

export function buildTradeOutMergeFields(client: Client): Record<string, string> {
  if (!client.tradeOutElected) {
    return {
      TradeOutElection: TRADE_OUT_OPTION_A,
      TradeOutCreditAmount: TRADE_OUT_NOT_APPLICABLE,
      TradeOutCompRoundsPerYear: TRADE_OUT_NOT_APPLICABLE,
      TradeOutMaxPlayersPerRound: TRADE_OUT_NOT_APPLICABLE,
      TradeOutBookingRestrictions: TRADE_OUT_NOT_APPLICABLE,
      TradeOutBookingContact: TRADE_OUT_NOT_APPLICABLE,
    };
  }

  return {
    TradeOutElection: TRADE_OUT_OPTION_B,
    TradeOutCreditAmount: formatTradeOutCreditAmountForContract(
      client.tradeOutCreditAmount,
    ),
    TradeOutCompRoundsPerYear:
      client.tradeOutCompRoundsPerYear != null
        ? String(client.tradeOutCompRoundsPerYear)
        : "",
    TradeOutMaxPlayersPerRound: formatTradeOutMaxPlayers(
      client.tradeOutMaxPlayersPerRound,
    ),
    TradeOutBookingRestrictions:
      client.tradeOutBookingRestrictions?.trim() || TRADE_OUT_NOT_APPLICABLE,
    TradeOutBookingContact: client.tradeOutBookingContact?.trim() || "",
  };
}

export function parseTradeOutElected(value: unknown) {
  return value === true || value === "yes" || value === "true";
}

export type TradeOutInput = {
  tradeOutElected?: unknown;
  tradeOutCreditAmount?: string | null;
  tradeOutCompRoundsPerYear?: string | number | null;
  tradeOutMaxPlayersPerRound?: string | number | null;
  tradeOutBookingRestrictions?: string | null;
  tradeOutBookingContact?: string | null;
};

export type ParsedTradeOutFields = {
  tradeOutElected: boolean;
  tradeOutCreditAmount: string | null;
  tradeOutCompRoundsPerYear: number | null;
  tradeOutMaxPlayersPerRound: number | null;
  tradeOutBookingRestrictions: string | null;
  tradeOutBookingContact: string | null;
};

export function parseTradeOutFields(
  input: TradeOutInput,
): ParsedTradeOutFields | { error: string } {
  const tradeOutElected = parseTradeOutElected(input.tradeOutElected);
  const tradeOutCreditAmountRaw = input.tradeOutCreditAmount?.trim() ?? "";
  const tradeOutCreditAmountDollars = parseTradeOutCreditAmountDollars(
    tradeOutCreditAmountRaw,
  );
  const tradeOutCompRoundsPerYear = Number.parseInt(
    String(input.tradeOutCompRoundsPerYear ?? ""),
    10,
  );
  const tradeOutMaxPlayersPerRound = Number.parseInt(
    String(input.tradeOutMaxPlayersPerRound ?? "4"),
    10,
  );
  const tradeOutBookingContact = input.tradeOutBookingContact?.trim() ?? "";

  if (!tradeOutElected) {
    return {
      tradeOutElected: false,
      tradeOutCreditAmount: null,
      tradeOutCompRoundsPerYear: null,
      tradeOutMaxPlayersPerRound: null,
      tradeOutBookingRestrictions: null,
      tradeOutBookingContact: null,
    };
  }

  if (!tradeOutCreditAmountDollars) {
    return { error: "Trade-out credit amount must be a positive number." };
  }
  if (!Number.isFinite(tradeOutCompRoundsPerYear) || tradeOutCompRoundsPerYear < 1) {
    return { error: "Complimentary rounds per contract year must be at least 1." };
  }
  if (
    !Number.isFinite(tradeOutMaxPlayersPerRound) ||
    tradeOutMaxPlayersPerRound < 1 ||
    tradeOutMaxPlayersPerRound > 4
  ) {
    return { error: "Max players per round must be between 1 and 4." };
  }
  if (!tradeOutBookingContact) {
    return { error: "Booking contact / pro shop phone is required for trade-out credit." };
  }

  return {
    tradeOutElected: true,
    tradeOutCreditAmount: normalizeTradeOutCreditAmountInput(tradeOutCreditAmountRaw),
    tradeOutCompRoundsPerYear,
    tradeOutMaxPlayersPerRound,
    tradeOutBookingRestrictions: input.tradeOutBookingRestrictions?.trim() || null,
    tradeOutBookingContact,
  };
}
