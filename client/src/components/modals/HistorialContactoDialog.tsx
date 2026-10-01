import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Send, Eye, EyeOff, AlertTriangle, Undo2, Loader2 } from "lucide-react";

// Estados de la tabla trazabilidad_correos que cuentan como "apertura real"
export const ESTADOS_APERTURA = ["opened", "unique_opened", "clicks", "click", "loadedbyproxy"];
// Estado que se le pone a una apertura que el usuario decidió ignorar (no cuenta como lectura)
export const ESTADO_APERTURA_IGNORADA = "opened_ignored";

// Margen para tolerar que el reloj del envío quede unos segundos después de la apertura
const TOLERANCIA_MS = 2 * 60 * 1000;

interface Entrada {
  id: string;
  tipo: "envio" | "apertura";
  ts: number;
  plantilla: string;
  ignorada: boolean;
  dudosa: boolean;
  envioAsociado?: string;
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
  onCambio: () => Promise<void> | void;
}

export function HistorialContactoDialog({ open, onOpenChange, contacto, onCambio }: Props) {
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    if (open) cargarNombresPlantillas().then(setNombres);
  }, [open]);

  const entradas: Entrada[] = useMemo(() => {
    if (!contacto) return [];
    const eventos: any[] = contacto.historialCompleto || contacto.historial || [];

    const base = eventos.map((h: any) => {
      const estado = String(h.estado || "").toLowerCase();
      const ts = new Date(h.created_at || h.fecha).getTime();
      const partes = String(h.mensaje_id || "").split(":");
      const esApertura = ESTADOS_APERTURA.includes(estado) || estado === ESTADO_APERTURA_IGNORADA;

      let plantilla = "";
      if (esApertura) {
        // manual_open:<contacto>:<plantilla>:<hora>  (sin plantilla: manual_open:<contacto>:<hora>)
        plantilla = partes.length >= 4 ? nombrePlantilla(partes[2], nombres) : "";
      } else if ((h.mensaje_id || "").startsWith("manual_send:")) {
        plantilla = nombrePlantilla(partes[1], nombres);
      } else if ((h.mensaje_id || "").startsWith("manual_template:") || (h.mensaje_id || "").startsWith("manual_templ")) {
        plantilla = "Plantilla de cortesía";
      } else {
        plantilla = "Registro antiguo";
      }
      return {
        id: h.id as string,
        tipo: (esApertura ? "apertura" : "envio") as "envio" | "apertura",
        ts,
        plantilla,
        ignorada: estado === ESTADO_APERTURA_IGNORADA,
        dudosa: false,
        envioAsociado: undefined as string | undefined,
      };
    });

    const envios = base.filter((e) => e.tipo === "envio").sort((a, b) => a.ts - b.ts);

    base.forEach((e) => {
      if (e.tipo !== "apertura") return;
      let previo: typeof envios[number] | undefined;
      for (const s of envios) {
        if (s.ts <= e.ts + TOLERANCIA_MS) previo = s;
        else break;
      }
      if (previo) {
        e.envioAsociado = previo.plantilla;
      } else {
        e.dudosa = true;
      }
    });

    return base.sort((a, b) => b.ts - a.ts);
  }, [contacto, nombres]);

  const totalEnvios = entradas.filter((e) => e.tipo === "envio").length;
  const totalAperturas = entradas.filter((e) => e.tipo === "apertura" && !e.ignorada).length;
  const totalIgnoradas = entradas.filter((e) => e.ignorada).length;

  const cambiarApertura = async (entrada: Entrada, ignorar: boolean) => {
    if (!contacto) return;
    setProcesando(entrada.id);
    try {
      const { error } = await supabase
        .from("trazabilidad_correos")
        .update({ estado: ignorar ? ESTADO_APERTURA_IGNORADA : "opened" })
        .eq("id", entrada.id);
      if (error) throw error;

      // Dejar el estado resumen del contacto coherente con las aperturas que siguen contando
      const quedan = entradas.filter(
        (e) => e.tipo === "apertura" && e.id !== entrada.id && !e.ignorada
      ).length + (ignorar ? 0 : 1);
      const nuevoEstado = quedan > 0 ? "opened" : totalEnvios > 0 ? "request" : null;
      await supabase.from("contactos").update({ ultimo_estado_brevo: nuevoEstado }).eq("id", contacto.id);

      toast.success(ignorar ? "Apertura ignorada: ya no cuenta como lectura" : "Apertura restaurada");
      await onCambio();
    } catch (err) {
      console.error("Error al actualizar apertura:", err);
      toast.error("No se pudo actualizar la apertura");
    } finally {
      setProcesando(null);
    }
  };

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
            {totalIgnoradas > 0 ? `, ${totalIgnoradas} ignorada(s)` : ""}
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
                  : e.ignorada
                  ? "border-gray-800 bg-gray-900/40 opacity-60"
                  : e.dudosa
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-purple-500/20 bg-purple-500/5"
              }`}
            >
              <div className="mt-0.5">
                {e.tipo === "envio" ? (
                  <Send className="h-4 w-4 text-emerald-400" />
                ) : e.ignorada ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : e.dudosa ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <Eye className="h-4 w-4 text-purple-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">
                  {e.tipo === "envio"
                    ? `Enviado · ${e.plantilla}`
                    : e.ignorada
                    ? "Apertura ignorada"
                    : "Apertura"}
                </div>
                <div className="text-[11px] text-gray-400">{formatearFechaHora(e.ts)}</div>
                {e.tipo === "apertura" && e.envioAsociado && (
                  <div className="text-[10px] text-gray-500">Del envío: {e.envioAsociado}</div>
                )}
                {e.tipo === "apertura" && e.dudosa && !e.ignorada && (
                  <div className="text-[10px] text-amber-400">
                    Dudosa: no hay un envío registrado antes de esta apertura. Puede ser tuya al revisar la bandeja de enviados.
                  </div>
                )}
              </div>

              {e.tipo === "apertura" && (
                <button
                  disabled={procesando === e.id}
                  onClick={() => cambiarApertura(e, !e.ignorada)}
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-50"
                  title={e.ignorada ? "Volver a contar esta apertura" : "No contar esta apertura como lectura"}
                >
                  {procesando === e.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : e.ignorada ? (
                    <Undo2 className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                  {e.ignorada ? "Restaurar" : "Ignorar"}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-gray-600">
          Las aperturas que llegan dentro de los 5 minutos siguientes a copiar el correo se descartan solas. Las demás pueden ser tuyas: ignóralas si lo son.
        </div>
      </DialogContent>
    </Dialog>
  );
}
