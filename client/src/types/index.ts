// Tipos para Cuentas
export interface Cuenta {
  id: string;
  cliente: string;
  rut?: string;
  sector?: string;
  segmento?: string;
  estado?: string;
  ciudad?: string;
  web?: string;
  origen?: string;
  created_at?: string; // ISO 8601
  contactos?: {
    id: string;
    nombre: string;
    correo?: string;
    celular?: string;
    telefono?: string;
  }[];
}

// Tipos para Contactos
export interface Contacto {
  id: string;
  nombre: string;
  correo?: string;
  celular?: string;
  telefono?: string;
  departamento?: string;
  cargo?: string;
  nivel?: string;
  estado?: string;
  cuenta_id: string;
  origen?: string;
  created_at?: string; // ISO 8601
}

// Tipos para SubCostos (costos por proveedor)
export interface SubCosto {
  id: number;
  proveedor: string; // Antes "descripción", ahora "Proveedor"
  codigo?: string; // Nuevo: identificador del producto en el proveedor
  cantidad: number;
  precio_unitario: number;
  descuento: number; // Porcentaje o monto según tu lógica (ajusta si es %)
  valor?: number; // Calculado: (cantidad * precio_unitario) * (1 - descuento/100) o similar
}

// Tipos para Ítems de Cotización
export interface Item {
  id: number;
  descripcion: string;
  imagen?: string; // URL de la imagen (miniatura)
  cantidad: number;
  margen: number; // Porcentaje de margen (%)
  subcostos: SubCosto[];
  // Campos para Propuesta Técnica Premium
  categoria_producto?: string; // e.g., "botellas", "morrales", "mugs", "totes"
  especificaciones_tecnicas?: string; // Párrafo descriptivo técnico
  imagenes_secundarias?: string[]; // URLs de los 3 marcos manuales
  _activeTab?: string; // Estado de UI: 'costos' | 'marketing'
  precio_fijo?: boolean; // Bloquea el precio de venta en la conciliación
}

// Tipos para Cotizaciones
export interface Cotizacion {
  id?: string; // UUID generado por Supabase
  correlativo?: number; // ✅ Auto-generado por Supabase (serial)
  numero_cotizacion?: string; // Ej: "COT-2026-001"
  ejecutiva_o?: string;
  estado_cotizacion?:
  | "Borrador"
  | "Pendiente"
  | "Aprobada"
  | "Rechazada"
  | "Cerrada"
  | string;
  vendedor_id?: string; // Relación con vendedor (si aplica)
  cuenta_id: string; // Obligatorio
  contacto_id: string; // Obligatorio
  tiempo_entrega?: string; // Ej: "5 días hábiles"
  validez_oferta?: string; // Ej: "30 días"
  nro_oc?: string;
  nro_guia?: string;
  contacto_comprador?: string;
  correo_comprador?: string;
  nro_factura?: string;
  contacto_proyecto?: string;
  correo_proyecto?: string;
  contacto_cobranza?: string;
  correo_cobranza?: string;
  telefono_cobranza?: string;
  correo_vendedor?: string; // ✅ Añadido recientemente
  celular_vendedor?: string; // ✅ Añadido recientemente
  nombre_vendedor?: string; // ✅ Añadido recientemente
  id_mercado_publico?: string;
  fecha?: string; // ✅ Nueva: Fecha manual/comercial de la cotización
  items: Item[];
  costo_total: number; // Suma de todos los subcostos
  total_neto: number; // Costo total + márgenes
  iva: number; // 19% en Chile → total_neto * 0.19
  total: number; // total_neto + iva
  ganancias: number; // total_neto - costo_total
  mg?: string; // Margen global (ej: "25%")
  created_at?: string; // ISO 8601
  // Relaciones (solo para lectura en frontend, no se guardan en Supabase directamente)
  cuenta?: Cuenta;
  contacto?: Contacto;
  // Aliases para compatibilidad con código legado
  cuentas?: any;
  contactos?: any;
}

// Tipos para Ventas (Facturas desde XML o Excel)
export interface Venta {
  id: number;
  folio: string; // ✅ Siempre string (evita pérdida de ceros a la izquierda)
  rut_recep: string; // RUT del receptor
  rzn_soc_recep: string; // Razón social del receptor
  mnt_total: number; // Monto total de la factura
  mnt_neto?: number;
  mnt_iva?: number;
  total_nc?: number;
  total_ncnd?: number;
  saldo: number; // Saldo pendiente
  estado_deuda: "PE" | "PA" | "Protestable" | "PROTESTABLE" | string;
  fch_emis: string; // ✅ Formato: 'YYYY-MM-DD' (obligatorio, corregido de fch_em)
  fch_venc: string; // Formato: 'YYYY-MM-DD'
  fec_recepcion?: string | null;
  fec_reclamado?: string | null;
  anulada?: boolean;
  dte_cesion?: boolean;
  tipo_dte?: number;
  contacto_cobranza?: string;
  correo_cobranza?: string;
  telefono_cobranza?: string;
  correo_vendedor?: string;
  fecha_abono?: string; // Formato: 'YYYY-MM-DD' o null
  tipo_abono?: "Efectivo" | "Transferencia" | "Cheque" | string;
  detalle_abono?: string;
  monto_abono?: number;
  // Campos útiles para lógica de negocio
  fecha_procesamiento?: string | null; // ✅ Nullable, formato 'YYYY-MM-DD', solo para registros nuevos
  ultimo_tipo_aviso?: string | null;
  fecha_ultimo_aviso?: string | null;
  conciliado?: boolean;
}
