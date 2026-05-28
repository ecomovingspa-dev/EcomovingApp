-- ==========================================================
-- Ecomoving SpA - Pizarrón Digital (Calendarización Diaria)
-- ==========================================================

-- 1. Crear la tabla de tareas gestionadas por fecha
CREATE TABLE IF NOT EXISTS public.gestion_tareas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(50) DEFAULT 'pendiente' NOT NULL, -- 'pendiente', 'en_proceso', 'completado'
    prioridad VARCHAR(20) DEFAULT 'media' NOT NULL,  -- 'baja', 'media', 'alta'
    fecha_limite DATE DEFAULT CURRENT_DATE NOT NULL, -- Fecha programada de la calendarización diaria
    creado_por VARCHAR(100) DEFAULT 'Ecomoving User',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Habilitar la seguridad a nivel de filas (Row Level Security - RLS)
ALTER TABLE public.gestion_tareas ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas de Acceso (Políticas Permisivas para usuarios autenticados)
DROP POLICY IF EXISTS "Permitir lectura completa a usuarios" ON public.gestion_tareas;
CREATE POLICY "Permitir lectura completa a usuarios" 
ON public.gestion_tareas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserción a usuarios" ON public.gestion_tareas;
CREATE POLICY "Permitir inserción a usuarios" 
ON public.gestion_tareas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización a usuarios" ON public.gestion_tareas;
CREATE POLICY "Permitir actualización a usuarios" 
ON public.gestion_tareas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminación a usuarios" ON public.gestion_tareas;
CREATE POLICY "Permitir eliminación a usuarios" 
ON public.gestion_tareas FOR DELETE USING (true);

-- 4. Habilitar publicación en Tiempo Real en Supabase para actualizaciones instantáneas
ALTER PUBLICATION supabase_realtime ADD TABLE public.gestion_tareas;
