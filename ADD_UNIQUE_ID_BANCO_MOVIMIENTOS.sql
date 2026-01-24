-- Add unique_id column to banco_movimientos table to prevent duplicates
-- Execute this in Supabase SQL Editor

-- 1. Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'banco_movimientos' 
        AND column_name = 'unique_id'
    ) THEN
        ALTER TABLE banco_movimientos 
        ADD COLUMN unique_id TEXT;
    END IF;
END $$;

-- 2. Create a unique index on unique_id to enforce uniqueness at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_banco_movimientos_unique_id 
ON banco_movimientos(unique_id);

-- 3. Add a comment to document the column
COMMENT ON COLUMN banco_movimientos.unique_id IS 
'Hash único generado a partir de cartola_id, fecha, descripcion, cargos, abonos y saldo para prevenir duplicados';

-- 4. Optional: Generate unique_id for existing records (if any)
-- This will create a hash for existing movements that don't have one yet
UPDATE banco_movimientos
SET unique_id = 'mov_' || md5(
    COALESCE(cartola_id::text, '') || '|' ||
    COALESCE(fecha::text, '') || '|' ||
    COALESCE(descripcion, '') || '|' ||
    COALESCE(cargos::text, '0') || '|' ||
    COALESCE(abonos::text, '0') || '|' ||
    COALESCE(saldo::text, '0')
)
WHERE unique_id IS NULL;
