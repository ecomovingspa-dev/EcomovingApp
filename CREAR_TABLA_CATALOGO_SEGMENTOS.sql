-- ============================================================================
-- MIGRACIÓN: CREACIÓN DEL CATÁLOGO DE SEGMENTOS
-- Ejecutar en Supabase SQL Editor (Una sola vez)
-- ============================================================================

-- 1. Crear la tabla de catálogo de segmentos
CREATE TABLE IF NOT EXISTS catalogo_segmentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Deshabilitar RLS para permitir acceso directo de lectura/escritura (Aplicación Interna)
ALTER TABLE catalogo_segmentos DISABLE ROW LEVEL SECURITY;

-- 3. Poblar la tabla inicialmente con el listado oficial de segmentos
INSERT INTO catalogo_segmentos (nombre)
VALUES 
  ('Expomin'),
  ('Servicios'),
  ('Mineras'),
  ('Educación'),
  ('Comercializadores'),
  ('Alimentos / Agrícola'),
  ('Corporación'),
  ('Salud'),
  ('Gran Empresa'),
  ('Municipalidad'),
  ('Servicios Públicos'),
  ('Gobierno Central'),
  ('Laboratorios'),
  ('Comercial/Industrial - Shell Chile'),
  ('Pequeña Empresa'),
  ('Caja de Compensación'),
  ('Minería / Industria') -- Se agrega este segmento que determinamos para Atlas Copco
ON CONFLICT (nombre) DO NOTHING;

-- 4. Recargar el esquema para PostgREST (por si acaso)
NOTIFY pgrst, 'reload schema';
