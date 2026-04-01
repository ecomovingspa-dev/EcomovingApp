-- ============================================================================
-- ETAPA 1: SETUP BASE DE DATOS — SISTEMA DE PROSPECCIÓN
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- PARTE A: Nueva columna "etapa" en tabla contactos
-- Valores: 'prospeccion' | 'marketing'
-- ────────────────────────────────────────────────────────────────

ALTER TABLE contactos
ADD COLUMN IF NOT EXISTS etapa TEXT DEFAULT 'marketing';

-- Índice para filtrado rápido en el cron
CREATE INDEX IF NOT EXISTS idx_contactos_etapa ON contactos (etapa);

-- Índice compuesto para el cron de Prospección: estado + etapa
CREATE INDEX IF NOT EXISTS idx_contactos_estado_etapa ON contactos (estado, etapa);

COMMENT ON COLUMN contactos.etapa IS 'Pipeline del contacto: prospeccion (sin nombre, buscando interlocutor) | marketing (con nombre, secuencia activa)';


-- ────────────────────────────────────────────────────────────────
-- PARTE B: Tabla configuracion_prospeccion
-- Estructura basada en configuracion_cobranza
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS configuracion_prospeccion (
    id            SERIAL PRIMARY KEY,
    nombre        TEXT NOT NULL,                        -- Identificador interno (ej: 'ice_breaker')
    etiqueta      TEXT NOT NULL,                        -- Nombre visible en sidebar (ej: 'Ice-Breaker')
    orden         INTEGER NOT NULL DEFAULT 1,           -- Orden de la etapa (1, 2, 3...)
    dias_espera   INTEGER NOT NULL DEFAULT 3,           -- Días laborales de espera antes de enviar
    asunto_template TEXT NOT NULL DEFAULT '',            -- Asunto del correo con variables
    mensaje_intro   TEXT NOT NULL DEFAULT '',            -- Cuerpo principal del correo
    mensaje_cierre  TEXT NOT NULL DEFAULT '',            -- Cierre / llamada a la acción
    activo        BOOLEAN NOT NULL DEFAULT true,        -- ¿Esta etapa está activa?
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE configuracion_prospeccion IS 'Plantillas de correo para la campaña de Prospección (descubrimiento de contactos). Variables disponibles: {empresa}, {correo}, {dominio}';

-- ────────────────────────────────────────────────────────────────
-- PARTE C: Datos iniciales (2 etapas de ejemplo)
-- ────────────────────────────────────────────────────────────────

INSERT INTO configuracion_prospeccion (nombre, etiqueta, orden, dias_espera, asunto_template, mensaje_intro, mensaje_cierre)
VALUES
(
    'ice_breaker',
    'Ice-Breaker',
    1,
    0,
    'Consulta para {empresa}',
    'Estimado equipo de {empresa}, nos comunicamos desde Ecomoving SpA. Estamos interesados en contactar al encargado del área de Compras o Sustentabilidad de su organización para compartir una propuesta de valor en merchandising corporativo sustentable.',
    'Agradeceríamos nos pudiera indicar el nombre y cargo de la persona indicada, o bien reenviar este correo al área correspondiente. Quedamos atentos a su respuesta.'
),
(
    'follow_up',
    'Follow-Up',
    2,
    5,
    'Seguimiento — {empresa}',
    'Estimado equipo de {empresa}, hace unos días enviamos una consulta buscando al encargado del área de Compras o Sustentabilidad. Entendemos que las agendas son exigentes, por lo que reiteramos brevemente nuestro interés.',
    'Solo necesitamos el nombre de la persona indicada para dirigir nuestra comunicación correctamente. Cualquier orientación será de gran ayuda. Saludos cordiales.'
);

-- ────────────────────────────────────────────────────────────────
-- PARTE D: RLS (Row Level Security) para configuracion_prospeccion
-- Misma política que configuracion_cobranza
-- ────────────────────────────────────────────────────────────────

ALTER TABLE configuracion_prospeccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura configuracion_prospeccion"
    ON configuracion_prospeccion FOR SELECT
    USING (true);

CREATE POLICY "Permitir escritura configuracion_prospeccion"
    ON configuracion_prospeccion FOR ALL
    USING (true)
    WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────
-- VERIFICACIÓN: Ejecutar después para confirmar
-- ────────────────────────────────────────────────────────────────

-- 1. Ver nueva columna en contactos:
-- SELECT id, nombre, correo, estado, etapa FROM contactos LIMIT 5;

-- 2. Ver tabla de configuración creada:
-- SELECT * FROM configuracion_prospeccion ORDER BY orden;
