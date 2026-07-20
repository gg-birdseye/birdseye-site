import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),

  courseName: text("course_name"),
  contactName: text("contact_name"),
  contactTitle: text("contact_title"),
  contactEmail: text("contact_email"),
  billingApEmail: text("billing_ap_email"),
  contactPhone: text("contact_phone"),

  /** Frozen contract template key: base | travel | trade_out | travel_trade_out */
  contractVariant: text("contract_variant"),

  billingAddressLine1: text("billing_address_line1"),
  billingAddressLine2: text("billing_address_line2"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),

  referralSource: text("referral_source"),
  adminNotes: text("admin_notes"),

  productionWindow: text("production_window"),
  teeTime1: text("tee_time_1"),
  teeTime2: text("tee_time_2"),
  teeTime3: text("tee_time_3"),
  onSiteCourseRepresentative: text("on_site_course_representative"),
  specialAccessInstructions: text("special_access_instructions"),
  projectSpecificNotes: text("project_specific_notes"),

  tradeOutElected: boolean("trade_out_elected").notNull().default(false),
  tradeOutCreditAmount: text("trade_out_credit_amount"),
  tradeOutCompRoundsPerYear: integer("trade_out_comp_rounds_per_year"),
  tradeOutMaxPlayersPerRound: integer("trade_out_max_players_per_round"),
  tradeOutBookingRestrictions: text("trade_out_booking_restrictions"),
  tradeOutBookingContact: text("trade_out_booking_contact"),

  organizationName: text("organization_name"),
  quotedSubtotalCents: integer("quoted_subtotal_cents"),
  multiCourseDiscountCents: integer("multi_course_discount_cents")
    .notNull()
    .default(0),
  multiCourseDiscountPercent: integer("multi_course_discount_percent")
    .notNull()
    .default(0),

  travelMobilizationFeeRequired: boolean("travel_mobilization_fee_required")
    .notNull()
    .default(false),
  travelMobilizationFeeOverride: boolean("travel_mobilization_fee_override"),
  travelDistanceMiles: integer("travel_distance_miles"),

  holeCount: integer("hole_count"),
  customHoleCount: integer("custom_hole_count"),
  plan: text("plan").notNull().default("annual"),
  customPriceCents: integer("custom_price_cents"),

  paymentMethod: text("payment_method").notNull().default("stripe"),

  onboardingStatus: text("onboarding_status").notNull().default("invited"),
  billingStatus: text("billing_status").notNull().default("inactive"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  contentAccessOverride: boolean("content_access_override")
    .notNull()
    .default(false),

  contractSignedAt: timestamp("contract_signed_at", { withTimezone: true }),
  contractSignerName: text("contract_signer_name"),

  docusignEnvelopeId: text("docusign_envelope_id"),
  docusignContractStatus: text("docusign_contract_status"),

  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),

  manualPaymentReceivedAt: timestamp("manual_payment_received_at", {
    withTimezone: true,
  }),
  manualPaymentAmountCents: integer("manual_payment_amount_cents"),
  manualPaymentMethod: text("manual_payment_method"),
  manualPaymentReference: text("manual_payment_reference"),
  manualPaymentNotes: text("manual_payment_notes"),

  courseSlug: text("course_slug"),
  sanityCourseId: text("sanity_course_id"),

  invitedAt: timestamp("invited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  intakeCompletedAt: timestamp("intake_completed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clientCourses = pgTable("client_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  courseName: text("course_name").notNull(),
  holeCount: integer("hole_count").notNull(),
  customHoleCount: integer("custom_hole_count"),
  customUnitPriceCents: integer("custom_unit_price_cents"),
  courseAddressLine1: text("course_address_line1"),
  courseCity: text("course_city"),
  courseState: text("course_state"),
  courseZip: text("course_zip"),
  courseSlug: text("course_slug"),
  sanityCourseId: text("sanity_course_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Normalized course identity used for dedupe (name + city + state). */
  courseKey: text("course_key").notNull(),
  courseName: text("course_name").notNull(),
  courseCity: text("course_city").notNull(),
  courseState: text("course_state").notNull(),
  holeCount: integer("hole_count").notNull(),

  referrerName: text("referrer_name").notNull(),
  referrerEmail: text("referrer_email").notNull(),

  contactName: text("contact_name").notNull(),
  contactRole: text("contact_role").notNull(),
  /** 10-digit US national number, digits only. */
  contactPhone: text("contact_phone").notNull(),
  howKnow: text("how_know"),

  /** pending_verify | qualified | released | won */
  status: text("status").notNull().default("pending_verify"),
  releaseReason: text("release_reason"),

  giftCardChoice: text("gift_card_choice").notNull(),
  rewardAmountDollars: integer("reward_amount_dollars").notNull(),
  rewardFulfilledAt: timestamp("reward_fulfilled_at", { withTimezone: true }),
  rewardReference: text("reward_reference"),

  adminNotes: text("admin_notes"),

  qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  wonAt: timestamp("won_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organization: text("organization"),
  email: text("email").notNull(),
  referralSource: text("referral_source"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientCourse = typeof clientCourses.$inferSelect;
export type NewClientCourse = typeof clientCourses.$inferInsert;
export type ClientWithCourses = Client & { courses: ClientCourse[] };
export type Lead = typeof leads.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;

export type ReferralStatus =
  | "pending_verify"
  | "qualified"
  | "released"
  | "won";

export type GiftCardChoice = "titleist" | "pga_superstore" | "amazon";

export type OnboardingStatus =
  | "invited"
  | "intake_complete"
  | "contract_signed"
  | "payment_pending"
  | "active"
  | "cancelled";

export type BillingStatus = "inactive" | "active" | "past_due" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "waived";
export type PaymentMethod = "stripe" | "manual";
export type PlanInterval = "monthly" | "annual";
