ALTER TABLE "client_courses" ADD COLUMN IF NOT EXISTS "course_address_line1" text;
ALTER TABLE "client_courses" ADD COLUMN IF NOT EXISTS "course_city" text;
ALTER TABLE "client_courses" ADD COLUMN IF NOT EXISTS "course_state" text;
ALTER TABLE "client_courses" ADD COLUMN IF NOT EXISTS "course_zip" text;

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "travel_distance_miles" integer;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "travel_mobilization_fee_override" boolean;
