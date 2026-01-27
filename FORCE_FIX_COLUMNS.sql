-- SCRIPT DE REPARACIÓN DE COLUMNAS BCI
-- Ejecuta esto en el SQL Editor de Supabase para solucionar el error de "schema cache"

-- 1. Asegurar que las columnas existen
ALTER TABLE banco_movimientos ADD COLUMN IF NOT EXISTS bci_glosa_detalle TEXT;
ALTER TABLE banco_movimientos ADD COLUMN IF NOT EXISTS bci_comentario_transferencia TEXT;
ALTER TABLE banco_movimientos ADD COLUMN IF NOT EXISTS bci_rut TEXT;
ALTER TABLE banco_movimientos ADD COLUMN IF NOT EXISTS bci_nombre TEXT;

-- 2. Limpiar datos antiguos para evitar conflictos
TRUNCATE TABLE banco_movimientos RESTART IDENTITY CASCADE;
TRUNCATE TABLE banco_cartolas RESTART IDENTITY CASCADE;

-- 3. Refrescar el caché de la API (PostgREST)
-- Nota: En Supabase esto ocurre automáticamente al ejecutar un ALTER TABLE, 
-- pero este comando asegura que las columnas sean visibles.
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE banco_movimientos IS 'Tabla actualizada con columnas BCI Detallado';
