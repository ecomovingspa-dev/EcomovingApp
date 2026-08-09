-- Script para agregar las columnas de Días Trabajados y Tasa SIS al Libro de Remuneraciones
-- Ejecuta este script en el editor SQL de tu panel de Supabase

ALTER TABLE liquidaciones_sueldo ADD COLUMN IF NOT EXISTS dias_trabajados INTEGER DEFAULT 30;
ALTER TABLE liquidaciones_sueldo ADD COLUMN IF NOT EXISTS tasa_sis NUMERIC DEFAULT 1.62;
