import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";

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
  const [availableSegments, setAvailableSegments] = useState<string[]>([
    "Alimentos / Agrícola",
    "Automotoras",
    "Comercializadores",
    "Constructoras / Inmobiliarias",
    "Educación",
    "Logística / Transporte",
    "Minería / Industria",
    "Salud",
    "Servicios",
    "Servicios Públicos"
  ]);

  useEffect(() => {
    if (esEdicion) {
      cargarCuenta();
    }
    cargarOpcionesFiltros();
  }, [id]);

  const cargarOpcionesFiltros = async () => {
    try {
      const { data } = await supabase.from("cuentas").select("sector, segmento");
      if (data) {
        const dbSectors = data.map((c: any) => c.sector).filter(Boolean);
        const dbSegments = data.map((c: any) => c.segmento).filter(Boolean);
        
        setAvailableSectors(prev => Array.from(new Set([...prev, ...dbSectors])).sort());
        setAvailableSegments(prev => Array.from(new Set([...prev, ...dbSegments])).sort());
      }
    } catch (error) {
      console.error("Error loading filter options:", error);
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Segmento
              </label>
              <select
                value={cuenta.segmento || ""}
                onChange={(e) => handleChange("segmento", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona un segmento...</option>
                {availableSegments.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
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
