-- Limpiar tablas de conciliación bancaria para subir nuevos archivos
-- Ejecutar esto en el SQL Editor de Supabase

-- 1. Eliminar todos los movimientos bancarios
TRUNCATE TABLE banco_movimientos RESTART IDENTITY CASCADE;

-- 2. Eliminar todas las cabeceras de cartolas
TRUNCATE TABLE banco_cartolas RESTART IDENTITY CASCADE;

-- Opcional: Si deseas limpiar también las categorías de gasto personalizadas (descomenta si quieres)
-- TRUNCATE TABLE banco_categorias_gasto RESTART IDENTITY CASCADE;

COMMENT ON TABLE banco_movimientos IS 'Tabla limpia para nueva carga de cartolas detalladas BCI';
