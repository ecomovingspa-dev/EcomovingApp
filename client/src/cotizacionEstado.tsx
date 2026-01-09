// client/src/cotizacionEstado.ts

export type DatosEstadoCotizacion = {
  nro_oc?: string | null;
  nro_guia?: string | null;
  nro_factura?: string | null;
  pagada?: boolean | null;
};

export function calcularEstadoCotizacion(data: DatosEstadoCotizacion): string {
  if (data.pagada) return "Cerrada";
  if (data.nro_factura && data.nro_factura !== "") return "Facturada";
  if (data.nro_guia && data.nro_guia !== "") return "Despachada";
  if (data.nro_oc && data.nro_oc !== "") return "Producción";

  return "Pendiente";
}
