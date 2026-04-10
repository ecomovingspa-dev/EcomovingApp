-- 🛡️ PROTOCOLO SENTINEL - Nueva Tabla de Packing
-- Creación de tabla para gestión de dimensiones y pesos de productos (Logística)

CREATE TABLE IF NOT EXISTS packing_productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    proveedor TEXT,
    n_cajas INTEGER DEFAULT 0,
    cantidad_por_caja INTEGER DEFAULT 0,
    ancho NUMERIC(10,2) DEFAULT 0, -- cm
    alto NUMERIC(10,2) DEFAULT 0,  -- cm
    largo NUMERIC(10,2) DEFAULT 0, -- cm
    kg_por_caja NUMERIC(10,2) DEFAULT 0,
    peso_volumen NUMERIC(10,2) DEFAULT 0,
    peso_kg NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) según protocolo
ALTER TABLE packing_productos ENABLE ROW LEVEL SECURITY;

-- Política de acceso total (Administrador/Operaciones)
-- Nota: En producción esto debería limitarse a usuarios autenticados
CREATE POLICY "Permitir gestión total en packing_productos" ON packing_productos
    FOR ALL USING (true);

COMMENT ON TABLE packing_productos IS 'Tabla maestra de packing y logística para productos de merchandising.';
