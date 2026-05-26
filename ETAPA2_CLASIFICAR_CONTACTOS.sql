-- ============================================================================
-- ETAPA 2: CLASIFICAR CONTACTOS EXISTENTES (Actualizado a 3 etapas)
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Prospección: Sin Nombre y Sin Correo (o correos genéricos)
UPDATE contactos
SET etapa = 'prospeccion'
WHERE (nombre IS NULL OR TRIM(nombre) = '')
  AND (correo IS NULL OR TRIM(correo) = '');

-- 2. Nutrición: Sin Nombre pero CON Correo
UPDATE contactos
SET etapa = 'nutricion'
WHERE (nombre IS NULL OR TRIM(nombre) = '')
  AND (correo IS NOT NULL AND TRIM(correo) != '');

-- 3. Marketing: CON Nombre y CON Correo
UPDATE contactos
SET etapa = 'marketing'
WHERE (nombre IS NOT NULL AND TRIM(nombre) != '')
  AND (correo IS NOT NULL AND TRIM(correo) != '');

-- Verificación de cómo quedaron los datos
SELECT etapa, COUNT(*) AS total
FROM contactos
GROUP BY etapa
ORDER BY etapa;
