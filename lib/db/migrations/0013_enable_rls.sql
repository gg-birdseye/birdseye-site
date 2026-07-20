-- Lock down Supabase Data API access on public tables.
-- With RLS enabled and no policies for anon/authenticated, the PostgREST
-- Data API cannot read or write these tables. The server-side Drizzle
-- connection (postgres role) bypasses RLS and continues to work as before.

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
