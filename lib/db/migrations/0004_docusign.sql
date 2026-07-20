ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "docusign_envelope_id" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "docusign_contract_status" text;
