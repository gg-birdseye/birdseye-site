/** Billing calendar math in America/Denver, matching Stripe annual charge dates. */

export const BILLING_TIME_ZONE = "America/Denver";

/** MSA 7.8: at least 30 days before renewal. 31 days = 1st of the prior month for a 1st-of-month charge. */
export const RENEWAL_REMINDER_PREFERRED_DAYS = 31;
export const RENEWAL_REMINDER_EARLIEST_DAYS = 37;
export const RENEWAL_REMINDER_LATEST_DAYS = 7;

export const UPCOMING_CHARGE_PREFERRED_DAYS = 7;
export const UPCOMING_CHARGE_EARLIEST_DAYS = 10;
export const UPCOMING_CHARGE_LATEST_DAYS = 1;

export const CANCELLATION_NOTICE_DAYS = 30;

export type Ymd = { year: number; month: number; day: number };

export const BILLING_NOTIFICATION_KINDS = {
  annualRenewal: "annual_renewal",
  upcomingCharge: "upcoming_charge",
} as const;

export type BillingNotificationKind =
  (typeof BILLING_NOTIFICATION_KINDS)[keyof typeof BILLING_NOTIFICATION_KINDS];

export function zonedYmd(date: Date, timeZone = BILLING_TIME_ZONE): Ymd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

export function todayYmd(now = new Date(), timeZone = BILLING_TIME_ZONE): Ymd {
  return zonedYmd(now, timeZone);
}

/** `annualBillingStartsAt` is stored as noon UTC on the 1st, so UTC YMD is the charge date. */
export function billingStartYmd(billingStartsAt: Date): Ymd {
  return {
    year: billingStartsAt.getUTCFullYear(),
    month: billingStartsAt.getUTCMonth() + 1,
    day: billingStartsAt.getUTCDate(),
  };
}

export function ymdToIso(ymd: Ymd): string {
  return `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return ymdToIso(a).localeCompare(ymdToIso(b));
}

export function addCalendarDays(ymd: Ymd, days: number): Ymd {
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function addYears(ymd: Ymd, years: number): Ymd {
  return { year: ymd.year + years, month: ymd.month, day: ymd.day };
}

export function calendarDaysUntil(from: Ymd, to: Ymd): number {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / 86_400_000);
}

export function formatYmdLong(ymd: Ymd): string {
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12)).toLocaleDateString(
    "en-US",
    { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" },
  );
}

/**
 * Remaining 50% of Year 1 is billed on `billingStartsAt`.
 * Year 2+ renewals are the same calendar date in later years.
 */
export function nextAnnualRenewalYmd(billingStartsAt: Date, today: Ymd): Ymd | null {
  let candidate = addYears(billingStartYmd(billingStartsAt), 1);
  while (compareYmd(candidate, today) <= 0) {
    candidate = addYears(candidate, 1);
  }
  return candidate;
}

/** Next automatic annual charge: remaining 50% if still upcoming, otherwise the next renewal. */
export function nextAnnualChargeYmd(billingStartsAt: Date, today: Ymd): Ymd | null {
  let candidate = billingStartYmd(billingStartsAt);
  while (compareYmd(candidate, today) <= 0) {
    candidate = addYears(candidate, 1);
  }
  return candidate;
}

export function cancellationDeadlineYmd(renewal: Ymd): Ymd {
  return addCalendarDays(renewal, -CANCELLATION_NOTICE_DAYS);
}

export function isInReminderWindow(
  daysUntil: number,
  window: { earliest: number; latest: number },
): boolean {
  return daysUntil <= window.earliest && daysUntil >= window.latest;
}

export function isAnnualRenewalReminderDue(daysUntil: number): boolean {
  return isInReminderWindow(daysUntil, {
    earliest: RENEWAL_REMINDER_EARLIEST_DAYS,
    latest: RENEWAL_REMINDER_LATEST_DAYS,
  });
}

export function isUpcomingChargeReminderDue(daysUntil: number): boolean {
  return isInReminderWindow(daysUntil, {
    earliest: UPCOMING_CHARGE_EARLIEST_DAYS,
    latest: UPCOMING_CHARGE_LATEST_DAYS,
  });
}
