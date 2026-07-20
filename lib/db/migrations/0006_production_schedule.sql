ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "production_window" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tee_time_1" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tee_time_2" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tee_time_3" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "on_site_course_representative" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "special_access_instructions" text;
