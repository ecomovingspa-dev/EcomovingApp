-- ============================================================================
-- MIGRACIÓN: AGREGAR COLUMNAS PARA TRAZABILIDAD DE CORREOS DE CORTESÍA
-- EJECUTAR EN: Supabase -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Agregar columna para saber si se envió el correo de cortesía
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS correo_cortesia_enviado BOOLEAN DEFAULT false;

-- 2. Agregar columna para saber si el contacto respondió
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS correo_cortesia_respondido BOOLEAN DEFAULT false;

-- 3. Agregar columna para saber qué vendedor/usuario abordó al cliente
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS correo_cortesia_vendedor TEXT;

-- 4. Recargar el esquema para que la API detecte las nuevas columnas
NOTIFY pgrst, 'reload schema';
