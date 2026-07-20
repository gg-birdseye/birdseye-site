CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_key" text NOT NULL,
  "course_name" text NOT NULL,
  "course_city" text NOT NULL,
  "course_state" text NOT NULL,
  "hole_count" integer NOT NULL,
  "referrer_name" text NOT NULL,
  "referrer_email" text NOT NULL,
  "contact_name" text NOT NULL,
  "contact_role" text NOT NULL,
  "contact_phone" text NOT NULL,
  "how_know" text,
  "status" text DEFAULT 'pending_verify' NOT NULL,
  "release_reason" text,
  "gift_card_choice" text NOT NULL,
  "reward_amount_dollars" integer NOT NULL,
  "reward_fulfilled_at" timestamp with time zone,
  "reward_reference" text,
  "admin_notes" text,
  "qualified_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "won_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One ACTIVE claim per course. Released rows stay as history and don't block.
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_active_course_key_idx"
  ON "referrals" ("course_key")
  WHERE "status" IN ('pending_verify', 'qualified', 'won');

CREATE INDEX IF NOT EXISTS "referrals_referrer_email_idx" ON "referrals" ("referrer_email");
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals" ("status");
