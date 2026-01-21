
-- Tabla para configuración de reglas de cobranza
create table if not exists configuracion_cobranza (
  id bigint primary key generated always as identity,
  nombre text not null unique, -- preventivo, moderado, etc.
  etiqueta text not null, -- Nombre legible: "Preventivo", "Mora Grave"
  dias_min int not null,
  dias_max int not null,
  asunto_template text not null, -- Usará {folio} y {dias} como placeholders
  mensaje_intro text not null,   -- Usará {dias} como placeholder
  mensaje_cierre text not null,
  urgencia text not null default 'media', -- normal, media, alta, critica
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insertar datos iniciales (Default)
insert into configuracion_cobranza (nombre, etiqueta, dias_min, dias_max, asunto_template, mensaje_intro, mensaje_cierre, urgencia)
values
('preventivo', 'Preventivo', -10, -7, 'Recordatorio: Factura N° {folio} vence en {dias} días', 'Le recordamos que la siguiente factura <strong>vencerá en {dias} días</strong>:', 'Si la factura presenta algún problema, contáctenos.', 'normal'),

('recien_vencido', 'Recién Vencido', 1, 7, 'Aviso de Vencimiento: Factura N° {folio} ({dias} días)', 'La factura <strong>venció hace {dias} día(s)</strong>:', 'Le agradecemos regularizar el pago a la brevedad.', 'media'),

('moderado', 'Mora Moderada', 8, 15, 'Factura N° {folio} - Mora Moderada ({dias} días)', 'La factura presenta <strong>{dias} días de vencimiento</strong>:', 'Le agradecemos regularizar el pago a la brevedad.', 'media'),

('grave', 'Mora Grave', 16, 21, 'URGENTE - Factura N° {folio} - Mora Grave ({dias} días)', 'La factura presenta <strong>{dias} días de vencimiento</strong>:', 'Le instamos a regularizar URGENTEMENTE para evitar acciones adicionales.', 'alta'),

('critico', 'Crítico', 22, 30, 'CRÍTICO - Factura N° {folio} - Gestión Legal ({dias} días)', 'La factura tiene <strong>{dias} días de vencimiento</strong>:', 'De no regularizarse en <strong>5 días hábiles</strong>, procederemos a:<ul style="margin-top: 10px;"><li>Reclamo formal en Mercado Público</li><li>Elevación a Contraloría General de la República</li></ul><p>Confiamos en su compromiso institucional.</p>', 'critica')
on conflict (nombre) do nothing;

-- Habilitar RLS (opcional si es interno, pero recomendado)
alter table configuracion_cobranza enable row level security;

-- Política: permitir lectura a todos (autenticados) y escritura solo a usuarios autenticados (temp)
create policy "Public Read Config" on configuracion_cobranza for select using (true);
create policy "Authenticated Update Config" on configuracion_cobranza for update using (auth.role() = 'authenticated');
