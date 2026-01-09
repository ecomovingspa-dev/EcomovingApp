import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Briefcase } from "lucide-react";
import { useVendedores } from "../../hooks/useVendedores";

const ESTADOS = [
  { value: "abierta", label: "Abierta" },
  { value: "pendiente", label: "Pendiente" },
  { value: "cerrada", label: "Cerrada" },
  { value: "cancelada", label: "Cancelada" },
];

interface OportunidadFormData {
  fecha_cierre: string;
  organismo: string;
  monto_disponible: string;
  estado: string;
  vendedor_id: string;
}

export default function OportunidadForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const esEdicion = Boolean(id);
  const { vendedores } = useVendedores();

  const RESPONSABLES = vendedores.map((v) => ({
    value: v.id,
    label: v.nombre,
  }));

  const [form, setForm] = useState<OportunidadFormData>({
    fecha_cierre: "",
    organismo: "",
    monto_disponible: "",
    estado: "abierta",
    vendedor_id: "",
  });

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (esEdicion) {
      cargarOportunidad();
    }
  }, [id]);

  const cargarOportunidad = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from("oportunidades")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setForm({
          fecha_cierre: data.fecha_cierre || "",
          organismo: data.organismo || "",
          monto_disponible: data.monto_disponible?.toString() || "",
          estado: data.estado || "abierta",
          vendedor_id: data.vendedor_id || "",
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("Error al cargar oportunidad: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (field: keyof OportunidadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setGuardando(true);

      const datos = {
        fecha_cierre: form.fecha_cierre || null,
        organismo: form.organismo || null,
        monto_disponible: form.monto_disponible
          ? parseFloat(form.monto_disponible)
          : null,
        estado: form.estado || "abierta",
        vendedor_id: form.vendedor_id || null,
      };

      if (esEdicion) {
        const { error } = await supabase
          .from("oportunidades")
          .update(datos)
          .eq("id", id);

        if (error) throw error;
        setMensaje("Oportunidad actualizada");
      } else {
        const { error } = await supabase.from("oportunidades").insert(datos);

        if (error) throw error;
        setMensaje("Oportunidad creada");
      }

      setTimeout(() => navigate("/oportunidades"), 1500);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("Error: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/oportunidades")}
          className="p-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-blue-600" />
            {esEdicion ? "Editar Oportunidad" : "Nueva Oportunidad"}
          </h1>
          <p className="text-gray-600">
            {esEdicion
              ? "Modifica los datos de la oportunidad"
              : "Ingresa los datos de la nueva oportunidad"}
          </p>
        </div>
      </div>

      {mensaje && (
        <div
          className={`p-4 rounded-lg font-medium border ${
            mensaje.includes("Error")
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-green-50 text-green-700 border-green-200"
          }`}
        >
          {mensaje}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la Oportunidad</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organismo">Organismo</Label>
                <Input
                  id="organismo"
                  value={form.organismo}
                  onChange={(e) => handleChange("organismo", e.target.value)}
                  placeholder="Organismo"
                  data-testid="input-organismo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_cierre">Fecha Cierre</Label>
                <Input
                  id="fecha_cierre"
                  type="datetime-local"
                  value={form.fecha_cierre}
                  onChange={(e) => handleChange("fecha_cierre", e.target.value)}
                  data-testid="input-fecha-cierre"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monto_disponible">Monto Disponible</Label>
                <Input
                  id="monto_disponible"
                  type="number"
                  value={form.monto_disponible}
                  onChange={(e) =>
                    handleChange("monto_disponible", e.target.value)
                  }
                  placeholder="0"
                  data-testid="input-monto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={form.estado}
                  onValueChange={(v) => handleChange("estado", v)}
                >
                  <SelectTrigger data-testid="select-estado">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendedor">Responsable</Label>
              <Select
                value={form.vendedor_id}
                onValueChange={(v) => handleChange("vendedor_id", v)}
              >
                <SelectTrigger data-testid="select-responsable">
                  <SelectValue placeholder="Seleccionar responsable" />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSABLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/oportunidades")}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-guardar"
              >
                {guardando ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {esEdicion ? "Actualizar" : "Crear"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
