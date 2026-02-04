-- Migration: Add conciliation flag to invoices
-- 1. Añadir columna conciliado a compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT false;

-- 2. Añadir columna conciliado a ventas
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT false;

-- 3. Sincronizar compras ya conciliadas
UPDATE compras 
SET conciliado = true 
WHERE id IN (
    SELECT conciliado_id 
    FROM banco_movimientos 
    WHERE tipo_conciliacion = 'compra' 
      AND estado = 'conciliado' 
      AND conciliado_id IS NOT NULL
);

-- 4. Sincronizar ventas ya conciliadas (individuales)
UPDATE ventas 
SET conciliado = true 
WHERE id IN (
    SELECT conciliado_id 
    FROM banco_movimientos 
    WHERE tipo_conciliacion = 'venta' 
      AND estado = 'conciliado' 
      AND conciliado_id IS NOT NULL
);

-- 5. Nota: Para conciliaciones múltiples, tendríamos que buscar en una tabla intermedia 
-- o confiar en que se marcaron al momento de conciliar (que haremos a partir de ahora).
