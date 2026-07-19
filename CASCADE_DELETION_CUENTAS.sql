-- Habilitar la eliminación en cascada para cuentas y sus tablas dependientes
-- Esto evita que falle la eliminación de una cuenta cuando tiene contactos o cotizaciones asociados.

-- 1. Tabla: contactos
ALTER TABLE contactos
DROP CONSTRAINT IF EXISTS contactos_cuenta_id_fkey,
ADD CONSTRAINT contactos_cuenta_id_fkey
  FOREIGN KEY (cuenta_id)
  REFERENCES cuentas(id)
  ON DELETE CASCADE;

-- 2. Tabla: cotizaciones
ALTER TABLE cotizaciones
DROP CONSTRAINT IF EXISTS cotizaciones_cuenta_id_fkey,
ADD CONSTRAINT cotizaciones_cuenta_id_fkey
  FOREIGN KEY (cuenta_id)
  REFERENCES cuentas(id)
  ON DELETE CASCADE;
