-- Fix Row-Level Security policies on catalogo_segmentos table
-- Allowing SELECT, INSERT, UPDATE and DELETE for all users (anon and authenticated)

DROP POLICY IF EXISTS "Permitir todo para todos" ON catalogo_segmentos;
DROP POLICY IF EXISTS "Permitir todo" ON catalogo_segmentos;
DROP POLICY IF EXISTS "Allow all for everyone" ON catalogo_segmentos;

CREATE POLICY "Permitir todo para todos" ON catalogo_segmentos
FOR ALL 
TO public
USING (true)
WITH CHECK (true);
