-- ============================================================================
-- MIGRACIÓN: SINCRONIZAR AUTOMÁTICAMENTE EL VENDEDOR DE LA CUENTA A SUS CONTACTOS
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================================

-- 1. Sincronizar todos los contactos existentes actualmente con el vendedor de su cuenta
UPDATE contactos c
SET vendedor_id = cu.vendedor_id
FROM cuentas cu
WHERE c.cuenta_id = cu.id
  AND (c.vendedor_id IS DISTINCT FROM cu.vendedor_id);

-- 2. Crear función para propagar cambios futuros de vendedor de la cuenta a sus contactos
CREATE OR REPLACE FUNCTION sync_contacto_vendedor_on_cuenta_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id) THEN
        UPDATE contactos
        SET vendedor_id = NEW.vendedor_id
        WHERE cuenta_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el disparador (trigger) en la tabla 'cuentas'
DROP TRIGGER IF EXISTS tr_sync_contacto_vendedor ON cuentas;
CREATE TRIGGER tr_sync_contacto_vendedor
AFTER UPDATE OF vendedor_id ON cuentas
FOR EACH ROW EXECUTE FUNCTION sync_contacto_vendedor_on_cuenta_change();
