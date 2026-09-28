import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Regla de negocio: para pasar una cuenta a "Cuenta Foco" o "Cuenta Activa"
// deben estar completos el Sector, el Segmento y la Ciudad.
export type CampoObligatorio = "sector" | "segmento" | "ciudad";

export const CAMPOS_OBLIGATORIOS: CampoObligatorio[] = ["sector", "segmento", "ciudad"];

export const ETIQUETA_CAMPO: Record<CampoObligatorio, string> = {
  sector: "Sector",
  segmento: "Segmento",
  ciudad: "Ciudad",
};

// Devuelve los campos obligatorios que aun estan vacios en la cuenta
export function camposFaltantes(cuenta: any): CampoObligatorio[] {
  return CAMPOS_OBLIGATORIOS.filter((campo) => !String(cuenta?.[campo] ?? "").trim());
}

interface CompletarCamposDialogProps {
  abierto: boolean;
  faltantes: CampoObligatorio[];
  nombreCuenta?: string;
  destino: string;
  textoConfirmar?: string;
  onCancelar: () => void;
  onConfirmar: (valores: Partial<Record<CampoObligatorio, string>>) => void | Promise<void>;
}

export function CompletarCamposDialog({
  abierto,
  faltantes,
  nombreCuenta,
  destino,
  textoConfirmar,
  onCancelar,
  onConfirmar,
}: CompletarCamposDialogProps) {
  const [valores, setValores] = useState<Partial<Record<CampoObligatorio, string>>>({});
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const clave = faltantes.join(",");

  useEffect(() => {
    if (abierto) {
      setValores({});
      setError("");
      setGuardando(false);
    }
  }, [abierto, clave]);

  useEffect(() => {
    if (!abierto || !faltantes.includes("segmento")) return;
    let activo = true;
    supabase
      .from("catalogo_segmentos")
      .select("nombre")
      .order("nombre", { ascending: true })
      .then(({ data }) => {
        if (activo) setSegmentos((data || []).map((s: any) => s.nombre).filter(Boolean));
      });
    return () => {
      activo = false;
    };
  }, [abierto, clave]);

  const confirmar = async () => {
    const sinCompletar = faltantes.filter((campo) => !String(valores[campo] ?? "").trim());
    if (sinCompletar.length > 0) {
      setError(`Falta completar: ${sinCompletar.map((c) => ETIQUETA_CAMPO[c]).join(", ")}`);
      return;
    }
    setGuardando(true);
    try {
      const limpios: Partial<Record<CampoObligatorio, string>> = {};
      faltantes.forEach((campo) => {
        limpios[campo] = String(valores[campo]).trim();
      });
      await onConfirmar(limpios);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={(abrir) => {
        if (!abrir) onCancelar();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Completa los datos de la cuenta</DialogTitle>
          <DialogDescription>
            {nombreCuenta ? `"${nombreCuenta}" ` : "Esta cuenta "}
            necesita {faltantes.map((c) => ETIQUETA_CAMPO[c]).join(", ")} para pasar a {destino}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {faltantes.includes("sector") && (
            <div className="space-y-1">
              <Label>Sector *</Label>
              <Select value={valores.sector || ""} onValueChange={(v) => setValores((p) => ({ ...p, sector: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un sector..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Privado">Privado</SelectItem>
                  <SelectItem value="Público">Público</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {faltantes.includes("segmento") && (
            <div className="space-y-1">
              <Label>Segmento *</Label>
              <Select value={valores.segmento || ""} onValueChange={(v) => setValores((p) => ({ ...p, segmento: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un segmento..." />
                </SelectTrigger>
                <SelectContent>
                  {segmentos.map((seg) => (
                    <SelectItem key={seg} value={seg}>
                      {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {faltantes.includes("ciudad") && (
            <div className="space-y-1">
              <Label>Ciudad *</Label>
              <Input
                value={valores.ciudad || ""}
                onChange={(e) => setValores((p) => ({ ...p, ciudad: e.target.value }))}
                placeholder="Ej: Santiago"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={guardando}>
            {textoConfirmar || "Guardar y continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
