-- Adición de columnas para flujo de prospección y seguimiento especial
ALTER TABLE cuentas 
ADD COLUMN IF NOT EXISTS cuenta_foco BOOLEAN DEFAULT FALSE;

ALTER TABLE cuentas 
ADD COLUMN IF NOT EXISTS etapa_prospeccion TEXT DEFAULT 'Sin contactar';

-- Comentarios explicativos
COMMENT ON COLUMN cuentas.cuenta_foco IS 'Indica si la cuenta es prioritaria para seguimiento manual personalizado (ABM)';
COMMENT ON COLUMN cuentas.etapa_prospeccion IS 'Etapa del flujo de prospección manual: Sin contactar, Por Investigar, Por Llamar, En Proceso, Calificado';
