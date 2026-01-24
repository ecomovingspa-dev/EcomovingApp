-- Add lista_nc column to compras table
alter table compras add column if not exists lista_nc text;
