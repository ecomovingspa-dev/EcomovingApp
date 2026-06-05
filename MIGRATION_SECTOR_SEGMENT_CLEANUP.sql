-- ============================================================================
-- MIGRACIÓN Y LIMPIEZA MASIVA: NORMALIZACIÓN DE SECTOR Y SEGMENTO
-- Ejecutar en Supabase SQL Editor (Una sola vez)
-- ============================================================================

-- 1. Clasificar sector 'público' para cuentas que contengan palabras clave gubernamentales
UPDATE cuentas
SET sector = 'público'
WHERE sector IS NULL 
  AND (
    cliente ILIKE '%municipal%' OR 
    cliente ILIKE '%corporacion municipal%' OR 
    cliente ILIKE '%ministerio%' OR 
    cliente ILIKE '%gobierno%' OR 
    cliente ILIKE '%hospital%' OR 
    cliente ILIKE '%servicio de salud%' OR 
    cliente ILIKE '%ilustre%' OR 
    cliente ILIKE '%carabineros%' OR 
    cliente ILIKE '%fuerzas armadas%' OR
    cliente ILIKE '%serviu%' OR
    cliente ILIKE '%intendencia%' OR
    cliente ILIKE '%tesoreria%' OR
    cliente ILIKE '%senado%' OR
    cliente ILIKE '%camara de diputados%'
  );

-- 2. Clasificar el resto de las cuentas con sector nulo o en blanco como 'privado'
UPDATE cuentas
SET sector = 'privado'
WHERE sector IS NULL OR sector = '';

-- 3. Clasificación masiva inicial de segmentos por palabras clave (Para las cuentas existentes del sector privado)
-- Automotoras
UPDATE cuentas
SET segmento = 'Automotoras'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%auto%' OR
  cliente ILIKE '%vehiculo%' OR
  cliente ILIKE '%motors%' OR
  cliente ILIKE '%garage%' OR
  cliente ILIKE '%taller%' OR
  cliente ILIKE '%repuesto%' OR
  cliente ILIKE '%kaufmann%' OR
  cliente ILIKE '%chevrolet%' OR
  cliente ILIKE '%toyota%' OR
  cliente ILIKE '%hyundai%' OR
  cliente ILIKE '%ford%' OR
  cliente ILIKE '%automotriz%'
);

-- Salud
UPDATE cuentas
SET segmento = 'Salud'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%clinica%' OR
  cliente ILIKE '%salud%' OR
  cliente ILIKE '%dental%' OR
  cliente ILIKE '%dent%' OR
  cliente ILIKE '%laboratorio%' OR
  cliente ILIKE '%medico%' OR
  cliente ILIKE '%sanatorio%' OR
  cliente ILIKE '%diagnostico%'
);

-- Minería / Industria
UPDATE cuentas
SET segmento = 'Minería / Industria'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%minera%' OR
  cliente ILIKE '%mineria%' OR
  cliente ILIKE '%cobre%' OR
  cliente ILIKE '%metal%' OR
  cliente ILIKE '%acero%' OR
  cliente ILIKE '%fabrica%' OR
  cliente ILIKE '%industrial%' OR
  cliente ILIKE '%maestranza%' OR
  cliente ILIKE '%aceros%' OR
  cliente ILIKE '%manufactura%' OR
  cliente ILIKE '%fundicion%'
);

-- Constructoras / Inmobiliarias
UPDATE cuentas
SET segmento = 'Constructoras / Inmobiliarias'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%constructora%' OR
  cliente ILIKE '%inmobiliaria%' OR
  cliente ILIKE '%obras%' OR
  cliente ILIKE '%edificacion%' OR
  cliente ILIKE '%construccion%' OR
  cliente ILIKE '%ingenieria y construccion%'
);

-- Logística / Transporte
UPDATE cuentas
SET segmento = 'Logística / Transporte'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%transporte%' OR
  cliente ILIKE '%logistica%' OR
  cliente ILIKE '%cargo%' OR
  cliente ILIKE '%flete%' OR
  cliente ILIKE '%bodega%' OR
  cliente ILIKE '%naviera%' OR
  cliente ILIKE '%mudanza%' OR
  cliente ILIKE '%distribucion%'
);

-- Alimentos / Agrícola
UPDATE cuentas
SET segmento = 'Alimentos / Agrícola'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%alimento%' OR
  cliente ILIKE '%agro%' OR
  cliente ILIKE '%frut%' OR
  cliente ILIKE '%gastronomia%' OR
  cliente ILIKE '%catering%' OR
  cliente ILIKE '%viña%' OR
  cliente ILIKE '%agricola%' OR
  cliente ILIKE '%pesquera%' OR
  cliente ILIKE '%restaurante%' OR
  cliente ILIKE '%ccu%' OR
  cliente ILIKE '%soprole%' OR
  cliente ILIKE '%agromarket%'
);

-- Servicios
UPDATE cuentas
SET segmento = 'Servicios'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%servicios%' OR
  cliente ILIKE '%consultora%' OR
  cliente ILIKE '%tecnologia%' OR
  cliente ILIKE '%software%' OR
  cliente ILIKE '%seguridad%' OR
  cliente ILIKE '%aseo%' OR
  cliente ILIKE '%asesor%' OR
  cliente ILIKE '%publicidad%' OR
  cliente ILIKE '%marketing%' OR
  cliente ILIKE '%consultoria%' OR
  cliente ILIKE '%limpieza%'
);

-- Comercializadores (Todo el resto que comercializa/distribuye o tiene perfil de retail)
UPDATE cuentas
SET segmento = 'Comercializadores'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '') AND (
  cliente ILIKE '%comercial%' OR
  cliente ILIKE '%distribuidora%' OR
  cliente ILIKE '%retail%' OR
  cliente ILIKE '%importadora%' OR
  cliente ILIKE '%tienda%' OR
  cliente ILIKE '%venta%' OR
  cliente ILIKE '%comercio%' OR
  cliente ILIKE '%supermercado%' OR
  cliente ILIKE '%mall%' OR
  cliente ILIKE '%cencosud%' OR
  cliente ILIKE '%falabella%' OR
  cliente ILIKE '%ripley%'
);

-- 4. Valor por defecto para cuentas del sector privado que no coincidieron con ninguna palabra clave anterior
UPDATE cuentas
SET segmento = 'Servicios'
WHERE sector = 'privado' AND (segmento IS NULL OR segmento = '');

-- 5. Valor por defecto para cuentas del sector público (para dejarlas uniformes)
UPDATE cuentas
SET segmento = 'Servicios Públicos'
WHERE sector = 'público' AND (segmento IS NULL OR segmento = '');

-- 6. Recargar el esquema para PostgREST (por si acaso)
NOTIFY pgrst, 'reload schema';
