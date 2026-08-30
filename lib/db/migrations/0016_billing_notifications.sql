CREATE TABLE IF NOT EXISTS "client_billing_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "target_date" date NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_billing_notifications_unique"
  ON "client_billing_notifications" ("client_id", "kind", "target_date");

ALTER TABLE "client_billing_notifications" ENABLE ROW LEVEL SECURITY;
