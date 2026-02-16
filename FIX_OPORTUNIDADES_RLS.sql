-- =============================================
-- FIX: Oportunidades table - Disable RLS
-- This is an internal app with no public users,
-- so RLS is not needed on this table.
-- =============================================

-- Disable RLS (already executed in Supabase)
ALTER TABLE oportunidades DISABLE ROW LEVEL SECURITY;

-- Clean up any leftover policies
DROP POLICY IF EXISTS "Allow full access for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow select for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow insert for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow update for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow delete for anon on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Permitir eliminar por anon en oportunidad" ON oportunidades;
DROP POLICY IF EXISTS "Allow select on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow insert on oportunidades" ON oportunidades;
DROP POLICY IF EXISTS "Allow update on oportunidades" ON oportunidades;
