ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "stripe_subscription_schedule_id" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "stripe_default_payment_method_id" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "annual_billing_starts_at" timestamptz;
