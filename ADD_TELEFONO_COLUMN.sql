-- ============================================================================
-- MIGRACIÓN: AGREGAR COLUMNA TELEFONO A LA TABLA CUENTAS
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================================

-- 1. Agregar la columna 'telefono' a la tabla 'cuentas'
ALTER TABLE cuentas 
ADD COLUMN IF NOT EXISTS telefono TEXT;

-- 2. Agregar comentario explicativo
COMMENT ON COLUMN cuentas.telefono IS 'Teléfono corporativo principal de la empresa/cuenta';

-- 3. Recargar el esquema para PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
