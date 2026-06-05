-- ============================================================================
-- MIGRACIÓN: AGREGAR COLUMNA DE ORIGEN PARA SEGUIMIENTO DE IA
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Agregar columna origen a la tabla cuentas
ALTER TABLE cuentas 
ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'manual';

-- 2. Agregar columna origen a la tabla contactos
ALTER TABLE contactos 
ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'manual';

-- 3. Comentarios de documentación para el esquema
COMMENT ON COLUMN cuentas.origen IS 'Origen del registro: manual (creado por usuario) | AI (enriquecido por agente IA)';
COMMENT ON COLUMN contactos.origen IS 'Origen del registro: manual (creado por usuario) | AI (enriquecido por agente IA)';

-- 4. Recargar el esquema para PostgREST
NOTIFY pgrst, 'reload schema';
