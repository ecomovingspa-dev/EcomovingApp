-- Enable RLS (Row Level Security) if not already enabled, but for now we will just create tables
-- We assume public access or authenticated access is handled. 
-- For simplicity in this "dev" phase, we might keep RLS off or open.

-- 1. Tabla de Compras (Gastos)
create table if not exists compras (
  id bigint primary key generated always as identity,
  tipo_dte integer,
  folio integer,
  fecha_recepcion timestamp with time zone,
  fecha_emision date,
  fecha_vencimiento date,
  rut_proveedor text,
  razon_social text,
  monto_total numeric,
  monto_neto numeric,
  monto_iva numeric,
  saldo numeric,
  estado_contable text,
  estado_pago text default 'Pendiente', -- Pendiente, Pagada, Vencida
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add unique constraint to prevent duplicate uploads of the same invoice
alter table compras add constraint compras_unique_invoice unique (rut_proveedor, tipo_dte, folio);

-- 2. Tabla de Cartolas Bancarias (Headers)
create table if not exists banco_cartolas (
  id bigint primary key generated always as identity,
  nombre_archivo text,
  fecha_carga timestamp with time zone default now(),
  banco text,
  cuenta text,
  periodo text,
  saldo_inicial numeric,
  saldo_final numeric,
  created_at timestamp with time zone default now()
);

-- 3. Tabla de Movimientos Bancarios (Lines)
create table if not exists banco_movimientos (
  id bigint primary key generated always as identity,
  cartola_id bigint references banco_cartolas(id) on delete cascade,
  fecha date,
  sucursal text,
  descripcion text,
  numero_documento text,
  cargos numeric default 0,
  abonos numeric default 0,
  saldo numeric,
  estado text default 'pendiente', -- pendiente, conciliado, ignorado
  tipo_conciliacion text, -- 'venta', 'compra', 'manual'
  conciliado_id bigint, -- ID de la venta o compra con la que se concilió
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists idx_compras_fecha_emision on compras(fecha_emision);
create index if not exists idx_banco_movimientos_cartola_id on banco_movimientos(cartola_id);
create index if not exists idx_banco_movimientos_fecha on banco_movimientos(fecha);

-- RLS Policies (Basic)
alter table compras enable row level security;
alter table banco_cartolas enable row level security;
alter table banco_movimientos enable row level security;

create policy "Allow all access to authenticated users for compras"
  on compras for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all access to authenticated users for banco_cartolas"
  on banco_cartolas for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all access to authenticated users for banco_movimientos"
  on banco_movimientos for all
  to authenticated
  using (true)
  with check (true);

-- 4. Tabla de Abonos de Compras (Historial de Pagos)
create table if not exists compras_abonos (
  id bigint primary key generated always as identity,
  compra_id bigint references compras(id) on delete cascade,
  monto_abono numeric not null,
  fecha_abono date default current_date,
  tipo_abono text,
  detalle_abono text,
  created_at timestamp with time zone default now()
);

alter table compras_abonos enable row level security;

create policy "Allow all access to authenticated users for compras_abonos"
  on compras_abonos for all
  to authenticated
  using (true)
  with check (true);
