-- ============================================================================
-- ETAPA 2: CLASIFICAR CONTACTOS EXISTENTES
-- Asigna etapa = 'prospeccion' o 'marketing' según datos del contacto
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- PASO 1: Diagnóstico previo (ver cuántos hay en cada caso)
-- ────────────────────────────────────────────────────────────────

-- Contactos CON correo y SIN nombre → candidatos a Prospección
SELECT 'PROSPECCION' AS clasificacion, COUNT(*) AS total
FROM contactos
WHERE correo IS NOT NULL
  AND correo != ''
  AND (nombre IS NULL OR TRIM(nombre) = '');

-- Contactos CON correo y CON nombre → Marketing
-- (ya tienen etapa = 'marketing' por default, pero verificamos)
SELECT 'MARKETING' AS clasificacion, COUNT(*) AS total
FROM contactos
WHERE correo IS NOT NULL
  AND correo != ''
  AND nombre IS NOT NULL
  AND TRIM(nombre) != '';


-- ────────────────────────────────────────────────────────────────
-- PASO 2: Clasificar contactos sin nombre como 'prospeccion'
-- ────────────────────────────────────────────────────────────────

UPDATE contactos
SET etapa = 'prospeccion'
WHERE correo IS NOT NULL
  AND correo != ''
  AND (nombre IS NULL OR TRIM(nombre) = '')
  AND etapa != 'prospeccion';


-- ────────────────────────────────────────────────────────────────
-- PASO 3: Verificación final
-- ────────────────────────────────────────────────────────────────

SELECT etapa, estado, COUNT(*) AS total
FROM contactos
GROUP BY etapa, estado
ORDER BY etapa, estado;
