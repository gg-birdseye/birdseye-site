ALTER TABLE client_courses
  ADD COLUMN IF NOT EXISTS custom_unit_price_cents integer;
