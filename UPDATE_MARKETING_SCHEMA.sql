-- PASO 1: Ajustar la tabla 'marketing' para que coincida con la fábrica y Coda
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='marketing' AND column_name='numero_secuencia') THEN
        ALTER TABLE marketing RENAME COLUMN numero_secuencia TO nombre_envio;
    END IF;
END $$;

ALTER TABLE IF EXISTS marketing 
  ADD COLUMN IF NOT EXISTS asunto TEXT,
  ADD COLUMN IF NOT EXISTS cuerpo_html TEXT,
  ADD COLUMN IF NOT EXISTS nombre_imagen TEXT,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- PASO 2: Recargar el esquema para PostgREST
NOTIFY pgrst, 'reload schema';

-- PASO 3: Verificar columnas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'marketing';
