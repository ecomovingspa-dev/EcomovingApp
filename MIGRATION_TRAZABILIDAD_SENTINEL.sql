-- ============================================================================
-- MIGRACIÓN MATRIX SENTINEL V2.0 - HISTORIAL + REFORZAMIENTO DE CONTACTOS
-- PROPÓSITO: Reparar el error de columna faltante y activar el historial multi-envío.
-- ============================================================================

-- 1. Asegurar campos en tabla contactos (Requeridos para el Dashboard y API de Sync)
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS ultimo_estado_brevo TEXT;
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS es_bloqueado BOOLEAN DEFAULT false;
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS ultimo_envio TIMESTAMPTZ;
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS proximo_envio TIMESTAMPTZ;
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS etapa_envio INTEGER DEFAULT 1;
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS ultimo_evento_trazabilidad TIMESTAMPTZ;

-- 2. Tabla de Trazabilidad Histórica (La 'Caja Negra' de @correos)
CREATE TABLE IF NOT EXISTS trazabilidad_correos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contacto_id UUID REFERENCES contactos(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    fecha DATE NOT NULL,
    estado TEXT NOT NULL,
    mensaje_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices de rendimiento
CREATE UNIQUE INDEX IF NOT EXISTS idx_trazabilidad_unique_msg ON trazabilidad_correos(mensaje_id) WHERE mensaje_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trazabilidad_fecha ON trazabilidad_correos(fecha);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_email ON trazabilidad_correos(email);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_contacto ON trazabilidad_correos(contacto_id);

-- 4. Forzar recarga de esquema para que la API vea la nueva columna
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN contactos.ultimo_estado_brevo IS 'Último estado reportado por la API de Brevo (Ej: opened, delivered)';
