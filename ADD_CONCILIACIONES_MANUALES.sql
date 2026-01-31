-- =====================================================
-- CONCILIACIONES MANUALES - Tabla de Auditoría
-- =====================================================
-- Esta tabla registra las conciliaciones que NO corresponden
-- a facturas de venta o compra (gastos operacionales, 
-- comisiones bancarias, impuestos, etc.)
-- 
-- NO MODIFICA ninguna tabla existente.
-- REUTILIZA banco_categorias_gasto existente.
-- =====================================================

CREATE TABLE IF NOT EXISTS conciliaciones_manuales (
    id SERIAL PRIMARY KEY,
    
    -- Relación con movimiento bancario
    movimiento_id BIGINT REFERENCES banco_movimientos(id) ON DELETE CASCADE,
    
    -- Clasificación (usa valores de banco_categorias_gasto)
    categoria VARCHAR(100),
    
    -- Detalle/Justificación del usuario
    detalle TEXT,
    
    -- Referencia externa opcional (número de voucher, recibo, etc.)
    referencia VARCHAR(100),
    
    -- Auditoría
    fecha_conciliacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar doble conciliación manual del mismo movimiento
    UNIQUE(movimiento_id)
);

-- Índices para rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_conc_manual_movimiento ON conciliaciones_manuales(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_conc_manual_fecha ON conciliaciones_manuales(fecha_conciliacion);

-- RLS Policies
ALTER TABLE conciliaciones_manuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all" ON conciliaciones_manuales
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated" ON conciliaciones_manuales
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated" ON conciliaciones_manuales
    FOR DELETE USING (true);

-- =====================================================
-- NOTA: Esta tabla es solo para AUDITORÍA.
-- El estado del movimiento se actualiza en banco_movimientos
-- usando los campos existentes: estado, tipo_conciliacion, tipo_gasto
-- =====================================================
