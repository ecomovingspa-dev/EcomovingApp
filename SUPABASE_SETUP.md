# Configuración de Base de Datos Supabase

## Campos Nuevos para la Tabla `cotizaciones`

Para que la aplicación funcione completamente, necesitas agregar los siguientes campos a la tabla `cotizaciones` en Supabase:

### Campos de Contactos Adicionales

Ejecuta el siguiente SQL en el editor SQL de Supabase:

```sql
-- Agregar campos de contacto comprador
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS contacto_comprador TEXT,
ADD COLUMN IF NOT EXISTS correo_comprador TEXT;

-- Agregar campos de contacto proyecto
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS contacto_proyecto TEXT,
ADD COLUMN IF NOT EXISTS correo_proyecto TEXT;
```

## Estructura Completa de la Tabla `cotizaciones`

La tabla debe tener las siguientes columnas:

### Campos Principales
- `id` (uuid, primary key)
- `numero_cotizacion` (text) - Formato: COT-5000, COT-5001, etc.
- `nombre` (text)
- `ejecutiva_o` (text)
- `estado_cotizacion` (text) - Valores: 'borrador', 'enviada', 'aprobada', 'produccion', 'despachada'
- `cuenta_id` (uuid, foreign key → cuentas)
- `contacto_id` (uuid, foreign key → contactos)
- `tiempo_entrega` (text)
- `validez_oferta` (text)
- `created_at` (timestamp)

### Campos de Documentación Tributaria
- `nro_oc` (text) - Número de Orden de Compra
- `nro_guia` (text) - Número de Guía de Despacho
- `nro_factura` (text) - Número de Factura
- `id_mercado_publico` (text)

### Campos de Contactos Adicionales
- `contacto_comprador` (text)
- `correo_comprador` (text)
- `contacto_proyecto` (text)
- `correo_proyecto` (text)
- `contacto_cobranza` (text)
- `correo_cobranza` (text)
- `telefono_cobranza` (text)

### Campos de Productos y Totales
- `items` (jsonb) - Array de productos con subcostos
- `costo_total` (numeric)
- `total_neto` (numeric)
- `iva` (numeric)
- `total` (numeric)
- `ganancias` (numeric)
- `mg` (text) - Margen global

## Tablas Requeridas

### Tabla `cuentas`
```sql
CREATE TABLE IF NOT EXISTS cuentas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente TEXT NOT NULL,
  rut TEXT,
  sector TEXT,
  segmento TEXT,
  estado TEXT,
  correo TEXT,
  telefono TEXT,
  ciudad TEXT,
  web TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla `contactos`
```sql
CREATE TABLE IF NOT EXISTS contactos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  correo TEXT,
  celular TEXT,
  estado TEXT,
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla `ventas`
```sql
CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  folio TEXT NOT NULL,
  rut_recep TEXT,
  rzn_soc_recep TEXT NOT NULL,
  mnt_total NUMERIC NOT NULL,
  saldo NUMERIC NOT NULL,
  estado_deuda TEXT NOT NULL,
  fch_emis DATE NOT NULL,
  fch_venc DATE NOT NULL,
  contacto_cobranza TEXT,
  correo_cobranza TEXT,
  telefono_cobranza TEXT,
  fecha_abono DATE,
  tipo_abono TEXT,
  detalle_abono TEXT,
  monto_abono NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Agregar campos de cobranza y abono (si la tabla ya existe)
```sql
-- Agregar campos de contacto cobranza
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS contacto_cobranza TEXT,
ADD COLUMN IF NOT EXISTS correo_cobranza TEXT,
ADD COLUMN IF NOT EXISTS telefono_cobranza TEXT,
ADD COLUMN IF NOT EXISTS correo_vendedor TEXT;

-- Agregar campos de abono/pago
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS fecha_abono DATE,
ADD COLUMN IF NOT EXISTS tipo_abono TEXT,
ADD COLUMN IF NOT EXISTS detalle_abono TEXT,
ADD COLUMN IF NOT EXISTS monto_abono NUMERIC;
```

## Políticas de Seguridad (RLS)

Si tienes Row Level Security habilitado, asegúrate de tener políticas que permitan:

```sql
-- Habilitar RLS
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

-- Políticas de ejemplo (ajusta según tus necesidades de autenticación)
CREATE POLICY "Permitir todo para usuarios autenticados" ON cotizaciones
  FOR ALL USING (true);

CREATE POLICY "Permitir todo para usuarios autenticados" ON cuentas
  FOR ALL USING (true);

CREATE POLICY "Permitir todo para usuarios autenticados" ON contactos
  FOR ALL USING (true);

CREATE POLICY "Permitir todo para usuarios autenticados" ON ventas
  FOR ALL USING (true);
```

## Verificación

Después de aplicar los cambios, verifica que:

1. ✅ Las 4 tablas existen: `cuentas`, `contactos`, `cotizaciones`, `ventas`
2. ✅ Los campos nuevos están en la tabla `cotizaciones`
3. ✅ Las relaciones (foreign keys) funcionan correctamente
4. ✅ Las políticas RLS permiten las operaciones necesarias

## Estado Actual

La aplicación ya está configurada para usar estos campos. Solo necesitas aplicar las migraciones SQL en Supabase.
