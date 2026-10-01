import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Send, Eye } from "lucide-react";

// Estados de la tabla trazabilidad_correos que cuentan como "apertura"
export const ESTADOS_APERTURA = ["opened", "unique_opened", "clicks", "click", "loadedbyproxy"];
// Aperturas que se marcaron como ignoradas en una versión anterior: no se cuentan ni se muestran
export const ESTADO_APERTURA_IGNORADA = "opened_ignored";

// Regla de negocio: una apertura que llega dentro de los 5 minutos siguientes al envío
// (momento en que se copia el correo) se descarta y no cuenta como lectura.
// Todo lo que llega después se considera lectura.
export const VENTANA_DESCARTE_MS = 5 * 60 * 1000;

const esApertura = (h: any) => ESTADOS_APERTURA.includes(String(h?.estado || "").toLowerCase());
const momento = (h: any) => new Date(h.created_at || h.fecha).getTime();

/**
 * Devuelve el historial que cuenta: quita las aperturas ignoradas y las que llegaron
 * dentro de los 5 minutos siguientes a un envío. Los envíos se mantienen siempre.
 */
export function aperturasValidas(eventos: any[]): any[] {
  const lista = eventos || [];
  const envios = lista
    .filter((h) => !esApertura(h) && String(h?.estado || "").toLowerCase() !== ESTADO_APERTURA_IGNORADA)
    .map(momento);
  return lista.filter((h) => {
    const estado = String(h?.estado || "").toLowerCase();
    if (estado === ESTADO_APERTURA_IGNORADA) return false;
    if (!esApertura(h)) return true;
    const t = momento(h);
    return !envios.some((s) => t >= s && t - s < VENTANA_DESCARTE_MS);
  });
}

interface Entrada {
  id: string;
  tipo: "envio" | "apertura";
  ts: number;
  plantilla: string;
  envioAsociado?: string;
  imagenUrl?: string;
}

let cachePlantillas: Record<string, string> | null = null;

async function cargarNombresPlantillas(): Promise<Record<string, string>> {
  if (cachePlantillas) return cachePlantillas;
  const nombres: Record<string, string> = {};
  try {
    const { data: prosp } = await supabase
      .from("configuracion_prospeccion")
      .select("orden, nombre");
    (prosp || []).forEach((e: any) => {
      nombres[`builtin-prospeccion-${e.orden}`] = `Prospección · ${e.orden}. ${e.nombre}`;
    });
    const { data: clientes } = await supabase
      .from("configuracion_clientes")
      .select("orden, nombre");
    (clientes || []).forEach((e: any) => {
      nombres[`builtin-clientes-${e.orden}`] = `Cuentas Activas · ${e.orden}. ${e.nombre}`;
    });
  } catch {
    // Si falla la carga se usan nombres genéricos
  }
  cachePlantillas = nombres;
  return nombres;
}

function nombrePlantilla(id: string | undefined, nombres: Record<string, string>): string {
  if (!id || id === "unknown") return "Plantilla no identificada";
  if (nombres[id]) return nombres[id];
  const m = id.match(/^builtin-(prospeccion|clientes)-(\d+)$/);
  if (m) return `${m[1] === "prospeccion" ? "Prospección" : "Cuentas Activas"} · correo ${m[2]}`;
  return "Plantilla personalizada";
}

function formatearFechaHora(ts: number): string {
  return new Date(ts).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacto: any | null;
}

export function HistorialContactoDialog({ open, onOpenChange, contacto }: Props) {
  const [nombres, setNombres] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) cargarNombresPlantillas().then(setNombres);
  }, [open]);

  const entradas: Entrada[] = useMemo(() => {
    if (!contacto) return [];
    // contacto.historial ya viene sin las aperturas descartadas (ver aperturasValidas)
    const eventos: any[] = contacto.historial || [];

    const base = eventos.map((h: any) => {
      const apertura = esApertura(h);
      const ts = momento(h);
      const partes = String(h.mensaje_id || "").split(":");

      let plantilla = "";
      if (apertura) {
        // manual_open:<contacto>:<plantilla>:<hora>  (sin plantilla: manual_open:<contacto>:<hora>)
        plantilla = partes.length >= 4 ? nombrePlantilla(partes[2], nombres) : "";
      } else if ((h.mensaje_id || "").startsWith("manual_send:")) {
        plantilla = nombrePlantilla(partes[1], nombres);
      } else if ((h.mensaje_id || "").startsWith("manual_templ")) {
        plantilla = "Plantilla de cortesía";
      } else {
        plantilla = "Registro antiguo";
      }
      return {
        id: h.id as string,
        tipo: (apertura ? "apertura" : "envio") as "envio" | "apertura",
        ts,
        plantilla,
        envioAsociado: undefined as string | undefined,
        imagenUrl: !apertura && h.imagen_url ? String(h.imagen_url) : undefined,
      };
    });

    const envios = base.filter((e) => e.tipo === "envio").sort((a, b) => a.ts - b.ts);
    base.forEach((e) => {
      if (e.tipo !== "apertura") return;
      let previo: typeof envios[number] | undefined;
      for (const s of envios) {
        if (s.ts <= e.ts) previo = s;
        else break;
      }
      if (previo) e.envioAsociado = previo.plantilla;
    });

    return base.sort((a, b) => b.ts - a.ts);
  }, [contacto, nombres]);

  const totalEnvios = entradas.filter((e) => e.tipo === "envio").length;
  const totalAperturas = entradas.filter((e) => e.tipo === "apertura").length;
  const nombreContacto = contacto?.nombre?.replace("Contacto Principal - ", "") || "Contacto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-indigo-400 text-base">
            Historial · {nombreContacto}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {contacto?.correo} — {totalEnvios} envío(s), {totalAperturas} apertura(s)
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {entradas.length === 0 && (
            <div className="text-sm text-gray-500 py-8 text-center">
              Este contacto todavía no tiene envíos ni aperturas registradas.
            </div>
          )}

          {entradas.map((e) => (
            <div
              key={e.id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                e.tipo === "envio"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-purple-500/20 bg-purple-500/5"
              }`}
            >
              <div className="mt-0.5">
                {e.tipo === "envio" ? (
                  <Send className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Eye className="h-4 w-4 text-purple-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">
                  {e.tipo === "envio" ? `Enviado · ${e.plantilla}` : "Apertura"}
                </div>
                <div className="text-[11px] text-gray-400">{formatearFechaHora(e.ts)}</div>

                {e.tipo === "envio" && e.imagenUrl && (
                  <a href={e.imagenUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5" title="Abrir imagen enviada">
                    <img
                      src={e.imagenUrl}
                      alt="Imagen enviada en este correo"
                      loading="lazy"
                      className="h-20 w-auto max-w-[220px] rounded-md border border-gray-700 object-cover"
                    />
                  </a>
                )}
                {e.tipo === "envio" && !e.imagenUrl && e.plantilla !== "Registro antiguo" && (
                  <div className="text-[10px] text-gray-600">Imagen no registrada (envío anterior a esta función)</div>
                )}

                {e.tipo === "apertura" && (
                  <div className="text-[10px] text-gray-500">
                    {e.envioAsociado ? `Del envío: ${e.envioAsociado}` : "Sin envío registrado antes de esta apertura"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-gray-600">
          Las aperturas dentro de los 5 minutos siguientes al envío se descartan y no se muestran. Todas las demás cuentan como lectura.
        </div>
      </DialogContent>
    </Dialog>
  );
}
