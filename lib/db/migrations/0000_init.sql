CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL UNIQUE,
  "course_name" text,
  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "billing_address_line1" text,
  "billing_address_line2" text,
  "billing_city" text,
  "billing_state" text,
  "billing_zip" text,
  "referral_source" text,
  "admin_notes" text,
  "hole_count" integer,
  "custom_hole_count" integer,
  "plan" text DEFAULT 'annual' NOT NULL,
  "custom_price_cents" integer,
  "payment_method" text DEFAULT 'stripe' NOT NULL,
  "onboarding_status" text DEFAULT 'invited' NOT NULL,
  "billing_status" text DEFAULT 'inactive' NOT NULL,
  "payment_status" text DEFAULT 'pending' NOT NULL,
  "content_access_override" boolean DEFAULT false NOT NULL,
  "contract_signed_at" timestamp with time zone,
  "contract_signer_name" text,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_checkout_session_id" text,
  "manual_payment_received_at" timestamp with time zone,
  "manual_payment_amount_cents" integer,
  "manual_payment_method" text,
  "manual_payment_reference" text,
  "manual_payment_notes" text,
  "course_slug" text,
  "sanity_course_id" text,
  "invited_at" timestamp with time zone DEFAULT now() NOT NULL,
  "intake_completed_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "suspended_at" timestamp with time zone,
  "grace_period_ends_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "organization" text,
  "email" text NOT NULL,
  "referral_source" text,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "clients_course_slug_idx" ON "clients" ("course_slug");
CREATE INDEX IF NOT EXISTS "clients_onboarding_status_idx" ON "clients" ("onboarding_status");
CREATE INDEX IF NOT EXISTS "clients_billing_status_idx" ON "clients" ("billing_status");
