-- Script para crear la tabla de liquidaciones de sueldo en Supabase
-- Copia y ejecuta este script en el editor SQL de tu panel de Supabase

CREATE TABLE IF NOT EXISTS liquidaciones_sueldo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    rut_empresa TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    rut_trabajador TEXT NOT NULL,
    nombre_trabajador TEXT NOT NULL,
    mes_anio TEXT NOT NULL,
    sueldo_bruto NUMERIC NOT NULL,
    cotiza_afp BOOLEAN NOT NULL,
    afp_seleccionada TEXT NOT NULL,
    afp_tasa_custom NUMERIC NOT NULL,
    cotiza_salud BOOLEAN NOT NULL,
    tipo_salud TEXT NOT NULL,
    isapre_uf NUMERIC NOT NULL,
    colacion NUMERIC NOT NULL,
    movilizacion NUMERIC NOT NULL,
    otros_descuentos NUMERIC NOT NULL,
    uf_usada NUMERIC NOT NULL,
    utm_usada NUMERIC NOT NULL,
    tope_imponible_uf_usado NUMERIC NOT NULL,
    reforma_porcentaje_usado NUMERIC NOT NULL,
    imponible NUMERIC NOT NULL,
    descuento_afp NUMERIC NOT NULL,
    descuento_salud NUMERIC NOT NULL,
    base_impuesto NUMERIC NOT NULL,
    impuesto_unico NUMERIC NOT NULL,
    sueldo_liquido NUMERIC NOT NULL,
    costo_empresa NUMERIC NOT NULL
);

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE liquidaciones_sueldo ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso
CREATE POLICY "Permitir lectura para todos" ON liquidaciones_sueldo FOR SELECT USING (true);
CREATE POLICY "Permitir insercion para todos" ON liquidaciones_sueldo FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir eliminacion para todos" ON liquidaciones_sueldo FOR DELETE USING (true);
CREATE POLICY "Permitir actualizacion para todos" ON liquidaciones_sueldo FOR UPDATE USING (true);

-- Crear índices para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS idx_liq_rut_trabajador ON liquidaciones_sueldo(rut_trabajador);
CREATE INDEX IF NOT EXISTS idx_liq_mes_anio ON liquidaciones_sueldo(mes_anio);
