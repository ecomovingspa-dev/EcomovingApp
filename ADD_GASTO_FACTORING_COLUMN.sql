-- Add gasto_factoring column to abonos table
ALTER TABLE abonos ADD COLUMN IF NOT EXISTS gasto_factoring NUMERIC DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
