-- =============================================
-- FIX: Enable RLS policies for 'oportunidades' table
-- Problem: Delete operations fail silently because
-- RLS is enabled but no DELETE policy exists for anon role
-- =============================================

-- 1. First, let's check if RLS is enabled (run this to verify)
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'oportunidades';

-- 2. Enable RLS if not already enabled
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any (safe to re-run)
DROP POLICY IF EXISTS "Allow full access for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow select for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow insert for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow update for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow delete for anon on oportunidades" ON oportunidades;

-- 4. Create comprehensive policies for anon role (internal app, no auth)
CREATE POLICY "Allow select for anon on oportunidades"
  ON oportunidades FOR SELECT
  USING (true);

CREATE POLICY "Allow insert for anon on oportunidades"
  ON oportunidades FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update for anon on oportunidades"
  ON oportunidades FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for anon on oportunidades"
  ON oportunidades FOR DELETE
  USING (true);

-- 5. Verify policies were created
-- SELECT * FROM pg_policies WHERE tablename = 'oportunidades';
