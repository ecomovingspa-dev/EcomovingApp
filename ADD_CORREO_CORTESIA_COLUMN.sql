-- ============================================================================
-- ADICIÓN DE COLUMNA CORREO_CORTESIA_ENVIADO A TABLA CONTACTOS
-- PROPÓSITO: Registrar si al contacto ya se le ha enviado el correo de cortesía/seguimiento.
-- ============================================================================

ALTER TABLE contactos ADD COLUMN IF NOT EXISTS correo_cortesia_enviado BOOLEAN DEFAULT false;

-- Forzar recarga de esquema de PostgREST
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN contactos.correo_cortesia_enviado IS 'Indica si ya se le envió el correo manual de cortesía/seguimiento';
