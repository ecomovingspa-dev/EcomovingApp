-- 1. Crear la tabla de configuración
CREATE TABLE IF NOT EXISTS config_oportunidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE config_oportunidades ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para permitir lectura pública (o ajustar según necesidad)
CREATE POLICY "Permitir lectura para todos" ON config_oportunidades
    FOR SELECT USING (true);

-- 4. Crear política para permitir inserción/borrado (ajustar según necesidad)
CREATE POLICY "Permitir gestión total" ON config_oportunidades
    FOR ALL USING (true);

-- 5. Insertar tu lista oficial de palabras clave
INSERT INTO config_oportunidades (keyword) VALUES
('agendas'),
('alfombrilla mouse'),
('articulo de publicidad'),
('banano'),
('billetera'),
('boligrafo'),
('bolsa'),
('bolsa ecologica'),
('bolso'),
('botella'),
('caramayola'),
('carpeta'),
('chapita'),
('cooler'),
('corporativo'),
('credencial'),
('cuaderno'),
('destacador'),
('dia de la madre'),
('dia del padre'),
('dia del trabajo'),
('ecologica'),
('ecologico'),
('estuche'),
('galvano'),
('gorro'),
('gorro legionario'),
('gorro pescador'),
('impresion'),
('jockey'),
('lanyard'),
('lapices'),
('libreta'),
('linterna'),
('llavero'),
('logo'),
('lonchera'),
('mancuernas'),
('mat yoga'),
('memo set'),
('mochila'),
('morral'),
('mouse pad'),
('mug'),
('neveras'),
('pad mouse'),
('paragua'),
('parlantes'),
('pendrive'),
('personalizado'),
('pesa muñequera'),
('pesa tobillera'),
('polera'),
('porta credencial'),
('portacredencial'),
('power bank'),
('premiacion'),
('promocion'),
('promocional'),
('quitasol'),
('regalo publicitario'),
('reutilizable'),
('taza'),
('tazon'),
('tazones'),
('termico'),
('vaso'),
('vaso termico'),
('volantes')
ON CONFLICT (keyword) DO NOTHING;
