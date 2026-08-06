-- Add column 'imagen' to 'contactos' table to store render image URLs
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS imagen text;
