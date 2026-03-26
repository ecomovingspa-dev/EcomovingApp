-- ============================================================================
-- MIGRACIÓN MATRIX SENTINEL V2.0 - HISTORIAL DE TRAZABILIDAD
-- PROPÓSITO: Permitir el seguimiento histórico multienvío y evitar sobrescritura del 24 y 26.
-- ============================================================================

-- 1. Tabla de Trazabilidad Histórica
CREATE TABLE IF NOT EXISTS trazabilidad_correos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contacto_id UUID REFERENCES contactos(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    fecha DATE NOT NULL,
    estado TEXT NOT NULL, -- 'request', 'delivered', 'opened', 'hard_bounce', 'blocked'
    mensaje_id TEXT, -- Unicidad por mensaje enviado via Brevo
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices de rendimiento
CREATE UNIQUE INDEX IF NOT EXISTS idx_trazabilidad_unique_msg ON trazabilidad_correos(mensaje_id) WHERE mensaje_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trazabilidad_fecha ON trazabilidad_correos(fecha);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_email ON trazabilidad_correos(email);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_contacto ON trazabilidad_correos(contacto_id);

-- 3. Comentario de integridad financiera (@protocolo)
COMMENT ON TABLE trazabilidad_correos IS 'Registro de auditoría de envíos y aperturas. Fuente de verdad para @ventas.';

-- 4. Extender tabla contactos (Opcional, pero ayuda a @ventas a filtrar Hot Leads rápido)
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS ultimo_evento_trazabilidad TIMESTAMPTZ;
