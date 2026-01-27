-- Add BCI detailed columns to banco_movimientos
-- Execute this in Supabase SQL Editor

DO $$
BEGIN
    -- 1. Add Glosa Detalle
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_movimientos' AND column_name = 'bci_glosa_detalle') THEN
        ALTER TABLE banco_movimientos ADD COLUMN bci_glosa_detalle TEXT;
    END IF;

    -- 2. Add Comentario Transferencia
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_movimientos' AND column_name = 'bci_comentario_transferencia') THEN
        ALTER TABLE banco_movimientos ADD COLUMN bci_comentario_transferencia TEXT;
    END IF;

    -- 3. Add RUT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_movimientos' AND column_name = 'bci_rut') THEN
        ALTER TABLE banco_movimientos ADD COLUMN bci_rut TEXT;
    END IF;

    -- 4. Add Nombre
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_movimientos' AND column_name = 'bci_nombre') THEN
        ALTER TABLE banco_movimientos ADD COLUMN bci_nombre TEXT;
    END IF;
END $$;

COMMENT ON COLUMN banco_movimientos.bci_glosa_detalle IS 'BCI - Glosa detalle detallada';
COMMENT ON COLUMN banco_movimientos.bci_comentario_transferencia IS 'BCI - Comentario de la transferencia';
COMMENT ON COLUMN banco_movimientos.bci_rut IS 'BCI - RUT del emisor/receptor';
COMMENT ON COLUMN banco_movimientos.bci_nombre IS 'BCI - Nombre del emisor/receptor';
