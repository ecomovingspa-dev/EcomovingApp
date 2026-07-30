-- Add tipo_gasto column to banco_movimientos table
ALTER TABLE banco_movimientos 
ADD COLUMN IF NOT EXISTS tipo_gasto TEXT;

-- Add periodo column to banco_cartolas table (format: YYYY-MM)
ALTER TABLE banco_cartolas 
ADD COLUMN IF NOT EXISTS periodo_mes TEXT;

-- Create a table to store expense categories for autocomplete
CREATE TABLE IF NOT EXISTS banco_categorias (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some default categories
INSERT INTO banco_categorias (nombre) 
VALUES 
    ('Servicios Básicos'),
    ('Arriendo'),
    ('Sueldos'),
    ('Transporte'),
    ('Combustible'),
    ('Mantención'),
    ('Publicidad'),
    ('Honorarios'),
    ('Impuestos'),
    ('Traspaso de cuenta'),
    ('Sin respaldo'),
    ('Crédito'),
    ('Otros')
ON CONFLICT (nombre) DO NOTHING;

-- Add RLS policies for the new table
ALTER TABLE banco_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON banco_categorias
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON banco_categorias
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
