
-- Función para sincronizar el estado de la cuenta automáticamente
CREATE OR REPLACE FUNCTION update_cuenta_estado_on_contacto_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Si se inserta un contacto, la cuenta pasa a 'activo'
        UPDATE cuentas 
        SET estado = 'activo' 
        WHERE id = NEW.cuenta_id;
    ELSIF (TG_OP = 'DELETE') THEN
        -- Si se elimina un contacto, verificar si quedan otros
        IF NOT EXISTS (SELECT 1 FROM contactos WHERE cuenta_id = OLD.cuenta_id) THEN
            UPDATE cuentas 
            SET estado = 'prospecto' 
            WHERE id = OLD.cuenta_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Manejar cambio de cuenta del contacto
        IF (OLD.cuenta_id <> NEW.cuenta_id) THEN
            -- Nueva cuenta activada
            UPDATE cuentas SET estado = 'activo' WHERE id = NEW.cuenta_id;
            -- Vieja cuenta a prospecto si quedó vacía
            IF NOT EXISTS (SELECT 1 FROM contactos WHERE cuenta_id = OLD.cuenta_id) THEN
                UPDATE cuentas SET estado = 'prospecto' WHERE id = OLD.cuenta_id;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger asociado
DROP TRIGGER IF EXISTS tr_sync_cuenta_estado ON contactos;
CREATE TRIGGER tr_sync_cuenta_estado
AFTER INSERT OR UPDATE OR DELETE ON contactos
FOR EACH ROW EXECUTE FUNCTION update_cuenta_estado_on_contacto_change();
