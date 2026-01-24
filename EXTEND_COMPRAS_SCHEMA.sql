-- Extension of table 'compras' to include more fields from standard Libro de Compras

-- Montos Adicionales
alter table compras add column if not exists monto_exento numeric default 0;
alter table compras add column if not exists monto_sin_credito numeric default 0; -- IVA No Recuperable
alter table compras add column if not exists iva_uso_comun numeric default 0;
alter table compras add column if not exists impuestos_especificos numeric default 0; -- Otros impuestos
alter table compras add column if not exists monto_activo_fijo numeric default 0;
alter table compras add column if not exists monto_bien_raiz numeric default 0;

-- Otros Datos
alter table compras add column if not exists codigo_sucursal text;
alter table compras add column if not exists lista_referencias text; -- Referencias a otros documentos
