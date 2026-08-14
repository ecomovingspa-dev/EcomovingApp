-- Ejecuta este script en el SQL Editor de Supabase
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS cuenta_activa boolean DEFAULT false;
