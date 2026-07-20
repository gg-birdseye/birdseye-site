ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "organization_name" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "quoted_subtotal_cents" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "multi_course_discount_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "multi_course_discount_percent" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "client_courses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "course_name" text NOT NULL,
  "hole_count" integer NOT NULL,
  "custom_hole_count" integer,
  "course_slug" text,
  "sanity_course_id" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "client_courses_client_id_idx" ON "client_courses" ("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "client_courses_course_slug_idx" ON "client_courses" ("course_slug") WHERE "course_slug" IS NOT NULL;
