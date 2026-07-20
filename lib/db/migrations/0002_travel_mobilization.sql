ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "travel_mobilization_fee_required" boolean DEFAULT false NOT NULL;
