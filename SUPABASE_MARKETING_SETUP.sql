-- Crear tabla de marketing si no existe
CREATE TABLE IF NOT EXISTS marketing (
    id SERIAL PRIMARY KEY,
    asunto TEXT NOT NULL,
    html TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE marketing ENABLE ROW LEVEL SECURITY;

-- Crear políticas (permitir todo para usuarios autenticados / anon según tu configuración)
-- Si usas anon Key como en el resto de la app, usa estas:
CREATE POLICY "Permitir lectura para todos" ON marketing FOR SELECT USING (true);
CREATE POLICY "Permitir inserción para todos" ON marketing FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir eliminación para todos" ON marketing FOR DELETE USING (true);
CREATE POLICY "Permitir actualización para todos" ON marketing FOR UPDATE USING (true);

-- Nota: Si tu sistema ya tiene la tabla pero le falta la columna html, podrías ejecutar:
-- ALTER TABLE marketing ADD COLUMN IF NOT EXISTS html TEXT;
