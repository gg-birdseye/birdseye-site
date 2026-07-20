ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "trade_out_elected" boolean NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "trade_out_credit_amount" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "trade_out_comp_rounds_per_year" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "trade_out_max_players_per_round" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "trade_out_booking_restrictions" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "trade_out_booking_contact" text;
