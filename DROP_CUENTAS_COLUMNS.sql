-- Eliminar columnas correo y telefono de la tabla cuentas
-- Estos datos ya han sido migrados a la tabla contactos
ALTER TABLE cuentas DROP COLUMN IF EXISTS correo;
ALTER TABLE cuentas DROP COLUMN IF EXISTS telefono;
