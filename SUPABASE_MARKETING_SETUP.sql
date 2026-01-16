-- PASO 1: Asegurar que la columna existe (Ejecutar en SQL Editor)
ALTER TABLE IF EXISTS marketing ADD COLUMN IF NOT EXISTS html TEXT;

-- PASO 2: Forzar limpieza del caché de la API (Muy importante)
NOTIFY pgrst, 'reload schema';

-- PASO 3: Verificar que el campo existe (Debe aparecer en los resultados)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'marketing';

-- PASO 4: Si sigues con el error, ve a la interfaz de Supabase:
-- 1. Ve a "Table Editor"
-- 2. Busca la tabla "marketing"
-- 3. Click en "Insert row" (solo para ver si te deja escribir en el campo HTML)
-- 4. Si el campo HTML NO aparece ahí, dale a "Add column" manualmente con nombre "html" tipo "text".
