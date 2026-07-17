import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";
import { SEGMENTOS_MAESTROS } from "../../utils/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, AlertTriangle, Plus, Trash2 } from "lucide-react";

export default function CuentaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const esEdicion = !!id;

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cuenta, setCuenta] = useState<Partial<Cuenta>>({
    cliente: "",
    rut: "",
    sector: "",
    segmento: "",
    estado: "activo",
    ciudad: "",
    web: "",
  });

  const [availableSectors, setAvailableSectors] = useState<string[]>([
    "Privado",
    "Público"
  ]);
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [searchSegment, setSearchSegment] = useState("");

  useEffect(() => {
    if (esEdicion) {
      cargarCuenta();
    }
    cargarOpcionesFiltros();
  }, [id]);

  const cargarOpcionesFiltros = async () => {
    try {
      // 1. Cargar sectores de las cuentas
      const { data: accountsData } = await supabase.from("cuentas").select("sector");
      if (accountsData) {
        const dbSectors = accountsData.map((c: any) => c.sector).filter(Boolean);
        setAvailableSectors(prev => Array.from(new Set([...prev, ...dbSectors])).sort());
      }

      // 2. Cargar segmentos oficiales del catálogo
      const { data: catalogData } = await supabase.from("catalogo_segmentos").select("nombre");
      if (catalogData && catalogData.length > 0) {
        const dbSegments = catalogData.map((s: any) => s.nombre).filter(Boolean);
        setAvailableSegments(Array.from(new Set([...SEGMENTOS_MAESTROS, ...dbSegments])).sort());
      } else {
        setAvailableSegments([...SEGMENTOS_MAESTROS].sort());
      }
    } catch (error) {
      console.error("Error loading filter options:", error);
    }
  };

  const agregarNuevoSegmentoAlCatálogo = async (nuevoNombre: string) => {
    try {
      const { data, error } = await supabase
        .from("catalogo_segmentos")
        .insert([{ nombre: nuevoNombre }])
        .select("nombre")
        .single();

      if (error) throw error;

      if (data) {
        setAvailableSegments(prev => Array.from(new Set([...prev, data.nombre])).sort());
        handleChange("segmento", data.nombre);
        setSegmentOpen(false);
        setSearchSegment("");
        setMensaje("✅ Segmento creado y asignado");
        setTimeout(() => setMensaje(""), 2000);
      }
    } catch (error: any) {
      console.error("Error al agregar segmento al catálogo:", error);
      setMensaje("❌ Error al crear segmento: " + error.message);
    }
  };

  const eliminarSegmentoDelCatálogo = async (nombre: string) => {
    try {
      const { error } = await supabase
        .from("catalogo_segmentos")
        .delete()
        .eq("nombre", nombre);
      if (error) throw error;
      setAvailableSegments(prev => prev.filter(s => s !== nombre));
      if (cuenta.segmento === nombre) {
        handleChange("segmento", "");
      }
      setMensaje("✅ Segmento eliminado");
      setTimeout(() => setMensaje(""), 2000);
    } catch (error: any) {
      console.error("Error al eliminar segmento del catálogo:", error);
      setMensaje("❌ Error al eliminar segmento: " + error.message);
    }
  };

  const cargarCuenta = async () => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) setCuenta(data);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("❌ Error al cargar cuenta");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cuenta.cliente?.trim()) {
      setMensaje("⚠️ El nombre del cliente es obligatorio");
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      if (esEdicion) {
        const { error } = await supabase
          .from("cuentas")
          .update(cuenta)
          .eq("id", id);

        if (error) throw error;
        setMensaje("✅ Cuenta actualizada");
      } else {
        const { error } = await supabase.from("cuentas").insert([cuenta]);

        if (error) throw error;
        setMensaje("✅ Cuenta creada");
      }

      setTimeout(() => navigate("/cuentas"), 1500);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("❌ Error: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleChange = (field: keyof Cuenta, value: string) => {
    setCuenta((prev) => ({ ...prev, [field]: value }));
  };

  const filteredSegments = availableSegments.filter((seg) =>
    seg.toLowerCase().includes(searchSegment.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/cuentas"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          ← Volver
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {esEdicion ? "Editar Cuenta" : "Nueva Cuenta"}
        </h1>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div
          className={`p-4 rounded-lg font-medium ${mensaje.includes("❌") || mensaje.includes("⚠️")
            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            }`}
        >
          {mensaje}
        </div>
      )}

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      >
        {/* Información Principal */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Información Principal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                value={cuenta.cliente}
                onChange={(e) => handleChange("cliente", e.target.value)}
                className="w-[70%] border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Empresa XYZ S.A."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                RUT
              </label>
              <input
                type="text"
                value={cuenta.rut}
                onChange={(e) => handleChange("rut", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: 12.345.678-9"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estado
              </label>
              <select
                value={cuenta.estado}
                onChange={(e) => handleChange("estado", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="prospecto">Prospecto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sector
              </label>
              <select
                value={cuenta.sector || ""}
                onChange={(e) => handleChange("sector", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona un sector...</option>
                {availableSectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Segmento
              </label>
              <Popover open={segmentOpen} onOpenChange={setSegmentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={segmentOpen}
                    className="w-full justify-between h-[50px] border border-gray-300 dark:border-gray-600 rounded-lg px-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 text-left font-normal"
                  >
                    <span className="truncate">
                      {cuenta.segmento || "Selecciona o crea un segmento..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl" align="start">
                  <div className="flex flex-col space-y-2">
                    <input
                      type="text"
                      placeholder="Buscar o escribir nuevo segmento..."
                      value={searchSegment}
                      onChange={(e) => setSearchSegment(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredSegments.length === 0 ? (
                        <div className="py-3 text-center text-xs text-gray-500">
                          No se encontraron segmentos.
                        </div>
                      ) : (
                        filteredSegments.map((seg) => (
                          <div
                            key={seg}
                            className="group/item flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleChange("segmento", seg);
                                setSegmentOpen(false);
                                setSearchSegment("");
                              }}
                              className="flex-1 text-left text-sm text-gray-900 dark:text-gray-100"
                            >
                              {seg}
                            </button>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {cuenta.segmento === seg && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                              {!SEGMENTOS_MAESTROS.includes(seg) && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`¿Estás seguro de que deseas eliminar el segmento "${seg}" del catálogo?`)) {
                                      await eliminarSegmentoDelCatálogo(seg);
                                    }
                                  }}
                                  className="opacity-0 group-hover/item:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer"
                                  title="Eliminar de la lista"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {searchSegment.trim() && !availableSegments.some(s => s.toLowerCase() === searchSegment.trim().toLowerCase()) && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 border-blue-200 hover:border-blue-300 dark:border-blue-900/50 font-bold flex items-center justify-center gap-1 cursor-pointer"
                          onClick={() => {
                            agregarNuevoSegmentoAlCatálogo(searchSegment.trim());
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Crear segmento "{searchSegment.trim()}"
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {cuenta.segmento && !availableSegments.includes(cuenta.segmento) && (
                <p className="text-xs text-amber-500 font-medium mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  El segmento actual "{cuenta.segmento}" es histórico/inválido. Favor seleccionar uno del catálogo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Información de Contacto */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Información de Contacto
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ciudad
              </label>
              <input
                type="text"
                value={cuenta.ciudad}
                onChange={(e) => handleChange("ciudad", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Santiago, Valparaíso"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sitio Web
              </label>
              <input
                type="url"
                value={cuenta.web}
                onChange={(e) => handleChange("web", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.empresa.com"
              />
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
          <Link
            to="/cuentas"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={guardando}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {guardando
              ? "⏳ Guardando..."
              : esEdicion
                ? "💾 Actualizar"
                : "💾 Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
