-- Agregar columna vendedor_id a la tabla cuentas
ALTER TABLE cuentas 
ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL;

-- Agregar columna vendedor_id a la tabla contactos
ALTER TABLE contactos 
ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL;
