
-- Script robusto para asegurar estructura de tabla COMPRAS
-- Ejecuta esto completo en el SQL Editor de Supabase

-- 1. Crear tabla base si no existe
create table if not exists compras (
  id bigint primary key generated always as identity,
  created_at timestamp with time zone default now()
);

-- 2. Función auxiliar para agregar columnas si no existen
do $$
begin
    -- Identificación
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='tipo_dte') then
        alter table compras add column tipo_dte integer;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='folio') then
        alter table compras add column folio integer;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='rut_proveedor') then
        alter table compras add column rut_proveedor text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='razon_social') then
        alter table compras add column razon_social text;
    end if;

    -- Fechas
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='fecha_emision') then
        alter table compras add column fecha_emision date;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='fecha_vencimiento') then
        alter table compras add column fecha_vencimiento date;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='fecha_recepcion') then
        alter table compras add column fecha_recepcion timestamp with time zone;
    end if;

    -- Montos Clave
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='monto_total') then
        alter table compras add column monto_total numeric default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='monto_neto') then
        alter table compras add column monto_neto numeric default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='monto_iva') then
        alter table compras add column monto_iva numeric default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='saldo') then
        alter table compras add column saldo numeric default 0;
    end if;

    -- Estados
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='estado_pago') then
        alter table compras add column estado_pago text default 'Pendiente';
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='estado_contable') then
        alter table compras add column estado_contable text;
    end if;

    -- CAMPOS EXTRA (Recientes)
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='lista_nc') then
        alter table compras add column lista_nc text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='monto_exento') then
        alter table compras add column monto_exento numeric default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='monto_sin_credito') then
        alter table compras add column monto_sin_credito numeric default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='impuestos_especificos') then
        alter table compras add column impuestos_especificos numeric default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='codigo_sucursal') then
        alter table compras add column codigo_sucursal text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='lista_referencias') then
        alter table compras add column lista_referencias text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='compras' and column_name='iva_uso_comun') then
        alter table compras add column iva_uso_comun numeric default 0;
    end if;

end $$;
