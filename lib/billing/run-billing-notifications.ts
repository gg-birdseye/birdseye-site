import {
  BILLING_NOTIFICATION_KINDS,
  billingStartYmd,
  calendarDaysUntil,
  cancellationDeadlineYmd,
  compareYmd,
  formatYmdLong,
  isAnnualRenewalReminderDue,
  isUpcomingChargeReminderDue,
  nextAnnualChargeYmd,
  nextAnnualRenewalYmd,
  todayYmd,
  ymdToIso,
  type BillingNotificationKind,
  type Ymd,
} from "@/lib/billing/notification-dates";
import {
  clientBillingNotifications,
  getDb,
  type Client,
  type ClientWithCourses,
} from "@/lib/db";
import {
  isBillingEmailConfigured,
  recipientEmails,
  sendAnnualRenewalReminderEmail,
  sendBillingNotificationsAdminDigest,
  sendUpcomingChargeReminderEmail,
} from "@/lib/email/billing-notifications";
import {
  buildPaymentSummaryFromClient,
  resolveAccountLabel,
  resolvePlan,
} from "@/lib/onboarding/client-utils";
import { listClientsWithCourses } from "@/lib/onboarding/clients";
import { formatPrice } from "@/lib/pricing";

export type BillingNotificationRunOptions = {
  dryRun?: boolean;
  now?: Date;
  sendAdminDigest?: boolean;
};

export type BillingNotificationEvent = {
  clientId: string;
  accountLabel: string;
  kind: BillingNotificationKind;
  targetDate: string;
  amountLabel: string;
  to: string[];
};

export type BillingNotificationNote = {
  clientId?: string;
  accountLabel?: string;
  reason: string;
};

export type BillingNotificationRunResult = {
  dryRun: boolean;
  ranAt: string;
  today: string;
  sent: BillingNotificationEvent[];
  skipped: BillingNotificationNote[];
  errors: BillingNotificationNote[];
  watch: BillingNotificationNote[];
};

function isEligibleAnnualClient(client: Client): boolean {
  if (resolvePlan(client) !== "annual") return false;
  if (client.onboardingStatus !== "active") return false;
  if (client.billingStatus === "cancelled" || client.billingStatus === "inactive") {
    return false;
  }
  return true;
}

function sentKey(
  clientId: string,
  kind: BillingNotificationKind,
  targetDate: string,
) {
  return `${clientId}:${kind}:${targetDate}`;
}

function normalizeTargetDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? String(value).slice(0, 10);
}

function formatCents(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return formatPrice(cents / 100);
}

function amountForCharge(
  client: ClientWithCourses,
  kind: BillingNotificationKind,
  chargeDate: Ymd,
): string | null {
  const summary = buildPaymentSummaryFromClient(client);
  if (!summary) return null;

  if (kind === BILLING_NOTIFICATION_KINDS.annualRenewal) {
    return formatCents(summary.renewalRecurringChargeCents) ?? formatCents(summary.recurringChargeCents);
  }

  const start = client.annualBillingStartsAt
    ? billingStartYmd(new Date(client.annualBillingStartsAt))
    : null;
  const isFirstAnnualCharge = start != null && compareYmd(start, chargeDate) === 0;

  if (isFirstAnnualCharge) {
    return formatCents(summary.annualSecondInstallmentCents);
  }

  return formatCents(summary.renewalRecurringChargeCents) ?? formatCents(summary.recurringChargeCents);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function digestHtml(result: BillingNotificationRunResult): string | null {
  const hasContent =
    result.sent.length > 0 ||
    result.errors.length > 0 ||
    result.watch.length > 0;
  if (!hasContent) return null;

  const list = (items: string[]) =>
    items.length
      ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "<p>None.</p>";

  return `
    <p>Billing notification run for <strong>${escapeHtml(result.today)}</strong>${result.dryRun ? " (dry run — no client emails sent)" : ""}.</p>
    <h3>Sent</h3>
    ${list(
      result.sent.map(
        (item) =>
          `${escapeHtml(item.accountLabel)} — ${escapeHtml(item.kind)} for ${escapeHtml(item.targetDate)} (${escapeHtml(item.amountLabel)}) to ${escapeHtml(item.to.join(", "))}`,
      ),
    )}
    <h3>Needs attention</h3>
    ${list(
      result.watch.map(
        (item) =>
          `${escapeHtml(item.accountLabel ?? item.clientId ?? "Unknown")} — ${escapeHtml(item.reason)}`,
      ),
    )}
    <h3>Errors</h3>
    ${list(
      result.errors.map(
        (item) =>
          `${escapeHtml(item.accountLabel ?? item.clientId ?? "Unknown")} — ${escapeHtml(item.reason)}`,
      ),
    )}
  `;
}

async function recordSent(
  clientId: string,
  kind: BillingNotificationKind,
  targetDate: string,
) {
  const db = getDb();
  await db
    .insert(clientBillingNotifications)
    .values({ clientId, kind, targetDate })
    .onConflictDoNothing();
}

export async function runBillingNotifications(
  options: BillingNotificationRunOptions = {},
): Promise<BillingNotificationRunResult> {
  const now = options.now ?? new Date();
  const today = todayYmd(now);
  const dryRun = Boolean(options.dryRun);
  const sendAdminDigest = options.sendAdminDigest ?? !dryRun;

  const result: BillingNotificationRunResult = {
    dryRun,
    ranAt: now.toISOString(),
    today: formatYmdLong(today),
    sent: [],
    skipped: [],
    errors: [],
    watch: [],
  };

  const clients = await listClientsWithCourses();
  const db = getDb();
  const existing = await db.select().from(clientBillingNotifications);
  const sent = new Set(
    existing.map((row) =>
      sentKey(
        row.clientId,
        row.kind as BillingNotificationKind,
        normalizeTargetDate(row.targetDate),
      ),
    ),
  );

  const emailReady = isBillingEmailConfigured();
  if (!emailReady && !dryRun) {
    result.errors.push({
      reason: "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).",
    });
  }

  for (const client of clients) {
    const accountLabel = resolveAccountLabel(client);

    if (client.billingStatus === "past_due" || client.paymentStatus === "failed") {
      result.watch.push({
        clientId: client.id,
        accountLabel,
        reason: `Payment issue (billing ${client.billingStatus}, payment ${client.paymentStatus}).`,
      });
    }

    if (!isEligibleAnnualClient(client)) continue;

    if (!client.annualBillingStartsAt) {
      if (client.deliveredAt) {
        result.watch.push({
          clientId: client.id,
          accountLabel,
          reason: "Delivered, but annual billing start date is missing.",
        });
      }
      continue;
    }

    const billingStartsAt = new Date(client.annualBillingStartsAt);
    const recipients = recipientEmails(client);
    const renewal = nextAnnualRenewalYmd(billingStartsAt, today);
    const nextCharge = nextAnnualChargeYmd(billingStartsAt, today);

    if (renewal) {
      const daysUntilRenewal = calendarDaysUntil(today, renewal);
      const renewalIso = ymdToIso(renewal);
      const renewalSent = sent.has(
        sentKey(client.id, BILLING_NOTIFICATION_KINDS.annualRenewal, renewalIso),
      );

      if (
        !renewalSent &&
        daysUntilRenewal > 0 &&
        daysUntilRenewal < 7
      ) {
        result.watch.push({
          clientId: client.id,
          accountLabel,
          reason: `Annual renewal on ${formatYmdLong(renewal)} is ${daysUntilRenewal} day(s) away and no MSA 7.8 reminder was sent.`,
        });
      }

      if (isAnnualRenewalReminderDue(daysUntilRenewal)) {
        await deliverNotification({
          result,
          sent,
          dryRun,
          emailReady,
          client,
          accountLabel,
          recipients,
          kind: BILLING_NOTIFICATION_KINDS.annualRenewal,
          target: renewal,
          amountLabel: amountForCharge(
            client,
            BILLING_NOTIFICATION_KINDS.annualRenewal,
            renewal,
          ),
          alreadySent: renewalSent,
          send: async (amountLabel) => {
            await sendAnnualRenewalReminderEmail({
              client,
              to: recipients,
              renewalDate: renewal,
              cancellationDeadline: cancellationDeadlineYmd(renewal),
              amountLabel,
            });
          },
        });
      }
    }

    if (nextCharge) {
      const daysUntilCharge = calendarDaysUntil(today, nextCharge);
      const chargeIso = ymdToIso(nextCharge);
      const chargeSent = sent.has(
        sentKey(client.id, BILLING_NOTIFICATION_KINDS.upcomingCharge, chargeIso),
      );
      const start = billingStartYmd(billingStartsAt);
      const isRenewalCharge = compareYmd(start, nextCharge) !== 0;

      if (isUpcomingChargeReminderDue(daysUntilCharge)) {
        await deliverNotification({
          result,
          sent,
          dryRun,
          emailReady,
          client,
          accountLabel,
          recipients,
          kind: BILLING_NOTIFICATION_KINDS.upcomingCharge,
          target: nextCharge,
          amountLabel: amountForCharge(
            client,
            BILLING_NOTIFICATION_KINDS.upcomingCharge,
            nextCharge,
          ),
          alreadySent: chargeSent,
          send: async (amountLabel) => {
            await sendUpcomingChargeReminderEmail({
              client,
              to: recipients,
              chargeDate: nextCharge,
              amountLabel,
              isRenewal: isRenewalCharge,
            });
          },
        });
      }
    }
  }

  if (sendAdminDigest) {
    const html = digestHtml(result);
    if (html && emailReady && !dryRun) {
      try {
        await sendBillingNotificationsAdminDigest({
          todayLabel: result.today,
          dryRun,
          html,
        });
      } catch (error) {
        result.errors.push({
          reason:
            error instanceof Error
              ? `Admin digest failed: ${error.message}`
              : "Admin digest failed.",
        });
      }
    }
  }

  console.info("BILLING_NOTIFICATIONS_RUN", {
    dryRun,
    today: ymdToIso(today),
    sent: result.sent.length,
    skipped: result.skipped.length,
    errors: result.errors.length,
    watch: result.watch.length,
  });

  return result;
}

async function deliverNotification(input: {
  result: BillingNotificationRunResult;
  sent: Set<string>;
  dryRun: boolean;
  emailReady: boolean;
  client: ClientWithCourses;
  accountLabel: string;
  recipients: string[];
  kind: BillingNotificationKind;
  target: Ymd;
  amountLabel: string | null;
  alreadySent: boolean;
  send: (amountLabel: string) => Promise<void>;
}) {
  const targetIso = ymdToIso(input.target);
  const kindLabel =
    input.kind === BILLING_NOTIFICATION_KINDS.annualRenewal
      ? "Renewal reminder"
      : "Upcoming-charge reminder";

  if (input.alreadySent) {
    input.result.skipped.push({
      clientId: input.client.id,
      accountLabel: input.accountLabel,
      reason: `${kindLabel} already sent for ${targetIso}.`,
    });
    return;
  }

  if (input.recipients.length === 0) {
    input.result.watch.push({
      clientId: input.client.id,
      accountLabel: input.accountLabel,
      reason: `${kindLabel} due for ${formatYmdLong(input.target)}, but no contact or AP email is on file.`,
    });
    return;
  }

  if (!input.amountLabel) {
    input.result.watch.push({
      clientId: input.client.id,
      accountLabel: input.accountLabel,
      reason: `${kindLabel} due for ${formatYmdLong(input.target)}, but no amount is configured.`,
    });
    return;
  }

  try {
    if (!input.dryRun) {
      if (!input.emailReady) {
        throw new Error("Email is not configured.");
      }
      await input.send(input.amountLabel);
      await recordSent(input.client.id, input.kind, targetIso);
    }
    input.sent.add(sentKey(input.client.id, input.kind, targetIso));
    input.result.sent.push({
      clientId: input.client.id,
      accountLabel: input.accountLabel,
      kind: input.kind,
      targetDate: targetIso,
      amountLabel: input.amountLabel,
      to: input.recipients,
    });
  } catch (error) {
    input.result.errors.push({
      clientId: input.client.id,
      accountLabel: input.accountLabel,
      reason:
        error instanceof Error ? error.message : `Failed to send ${kindLabel}.`,
    });
  }
}
