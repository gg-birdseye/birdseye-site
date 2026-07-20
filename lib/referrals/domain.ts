import type { GiftCardChoice } from "@/lib/db/schema";

/** Days a pending_verify claim holds a course before it auto-releases. */
export const REFERRAL_VERIFY_WINDOW_DAYS = 14;

/** Max simultaneous active (pending_verify or qualified) referrals per referrer. */
export const MAX_ACTIVE_REFERRALS_PER_REFERRER = 5;

export const REFERRAL_HOLE_COUNTS = [9, 18, 27] as const;

export const REFERRAL_REWARDS: Record<number, number> = {
  9: 200,
  18: 300,
  27: 400,
};

export const GIFT_CARD_OPTIONS: { value: GiftCardChoice; label: string }[] = [
  { value: "titleist", label: "Titleist" },
  { value: "pga_superstore", label: "PGA Superstore" },
  { value: "amazon", label: "Amazon" },
];

export const GIFT_CARD_LABELS: Record<string, string> = Object.fromEntries(
  GIFT_CARD_OPTIONS.map((option) => [option.value, option.label]),
);

export const CONTACT_ROLE_OPTIONS = [
  "Head Golf Professional",
  "Assistant Golf Professional",
  "Director of Golf",
  "General Manager",
  "Owner",
  "Marketing Director",
  "Other",
] as const;

export const REFERRAL_RELEASE_REASONS = [
  { value: "course_declined", label: "Course declined offer" },
  { value: "bad_number", label: "Bad / disconnected number" },
  { value: "wrong_person", label: "Wrong person / not at club" },
  { value: "no_answer", label: "No answer after multiple attempts" },
  { value: "self_referral", label: "Self-referral" },
  { value: "released_by_admin", label: "Other" },
] as const;

export const REFERRAL_RELEASE_REASON_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    REFERRAL_RELEASE_REASONS.map((reason) => [reason.value, reason.label]),
  ),
  verification_window_expired: "Verification window expired",
};

export function isGiftCardChoice(value: string): value is GiftCardChoice {
  return GIFT_CARD_OPTIONS.some((option) => option.value === value);
}

export function rewardForHoleCount(holeCount: number): number | null {
  return REFERRAL_REWARDS[holeCount] ?? null;
}

/**
 * Normalized course identity for dedupe: lowercased name + city + state with
 * punctuation and filler words ("golf course", "golf club", "the") stripped,
 * so "The Pines Golf Club" and "Pines GC" in the same city collide.
 */
export function courseKeyFor(
  courseName: string,
  city: string,
  state: string,
): string {
  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(
        /\b(the|golf|course|club|links|country|cc|gc|g c|resort)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

  const normalizePlace = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return [normalizeName(courseName), normalizePlace(city), normalizePlace(state)]
    .join("|");
}

/** Obviously fake US numbers: fictional 555-01XX, repeated digits, sequences. */
export function isObviouslyFakePhone(digits: string): boolean {
  if (digits.length !== 10) return true;
  if (/^(\d)\1{9}$/.test(digits)) return true;
  if (digits === "1234567890" || digits === "0123456789") return true;
  // NANP: area code and exchange can't start with 0 or 1.
  if (digits[0] === "0" || digits[0] === "1") return true;
  if (digits[3] === "0" || digits[3] === "1") return true;
  // 555-01XX is reserved for fiction.
  if (digits.slice(3, 6) === "555" && digits.slice(6, 8) === "01") return true;
  return false;
}

export function isReferralActive(status: string): boolean {
  return status === "pending_verify" || status === "qualified" || status === "won";
}
