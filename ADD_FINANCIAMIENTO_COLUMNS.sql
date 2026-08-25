-- =====================================================================
-- Migración: Persistencia de condición de pago y tasa de financiamiento
-- Tabla: cotizaciones
-- Motivo: Los campos condicion_pago y tasa_financiamiento no existían en
--         el esquema, por lo que el cálculo de factoring/contado se perdía
--         al salir y volver a la cotización.
-- =====================================================================

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS condicion_pago TEXT NOT NULL DEFAULT 'Ninguno',
  ADD COLUMN IF NOT EXISTS tasa_financiamiento NUMERIC(8,4) NOT NULL DEFAULT 0;

-- Refrescar caché del schema de PostgREST
NOTIFY pgrst, 'reload schema';
