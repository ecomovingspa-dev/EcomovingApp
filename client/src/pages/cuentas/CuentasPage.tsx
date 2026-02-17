import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";
import { Trash2, CheckCircle2, AlertCircle, Loader2, Building2, Search, RotateCcw, Zap } from "lucide-react";
import ProspectorIAModal from "../../components/crm/ProspectorIAModal";

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentasFiltradas, setCuentasFiltradas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [cuentaParaInvestigar, setCuentaParaInvestigar] = useState<Cuenta | null>(null);




  // Estados para filtros y búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;

  // Estados para opciones de filtros (se cargan una vez al inicio)
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  // Determinar si hay algún filtro activo
  // No longer restricted, we use server-side pagination for performance
  const hayFiltroActivo = true;

  useEffect(() => {
    cargarOpcionesFiltros();
  }, []);

  const cargarOpcionesFiltros = async () => {
    try {
      // Cargamos solo las columnas necesarias para los filtros, sin descargar toda la tabla
      const { data } = await supabase.from("cuentas").select("sector, segmento");
      if (data) {
        setAvailableSectors(Array.from(new Set(data.map((c: any) => c.sector).filter(Boolean))));
        setAvailableSegments(Array.from(new Set(data.map((c: any) => c.segmento).filter(Boolean))));
      }
    } catch (e) {
      console.error("Error cargando opciones de filtros:", e);
    }
  };



  useEffect(() => {
    if (hayFiltroActivo) {
      cargarCuentas();
    } else {
      setCuentas([]);
      setCuentasFiltradas([]);
      setTotalRecords(0);
      setCargando(false);
    }
  }, [paginaActual, busqueda, filtroSector, filtroSegmento, filtroEstado, hayFiltroActivo]);


  const cargarCuentas = async () => {
    try {
      setCargando(true);
      setError("");

      let query = supabase
        .from("cuentas")
        .select("*", { count: "exact" });

      if (busqueda) {
        query = query.or(`cliente.ilike.%${busqueda}%,rut.ilike.%${busqueda}%,ciudad.ilike.%${busqueda}%`);
      }
      if (filtroSector) {
        query = query.eq("sector", filtroSector);
      }
      if (filtroSegmento) {
        query = query.eq("segmento", filtroSegmento);
      }
      if (filtroEstado) {
        query = query.eq("estado", filtroEstado);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina - 1);

      if (error) throw error;

      setCuentas(data || []);
      setCuentasFiltradas(data || []); // Consistency for existing UI
      if (count !== null) setTotalRecords(count);
    } catch (error: any) {
      console.error("Error:", error);
      setError("Error al cargar las cuentas");
    } finally {
      setCargando(false);
    }
  };

  const totalPaginas = Math.ceil(totalRecords / filasPorPagina);
  const cuentasPaginadas = cuentas; // Already paginated from server


  const actualizarCuentaInline = async (id: string, campo: keyof Cuenta, valor: string) => {
    const cuentaOriginal = cuentas.find(c => c.id === id);
    if (cuentaOriginal && cuentaOriginal[campo] === valor) return;

    setGuardandoId(id);
    try {
      const { error } = await supabase
        .from("cuentas")
        .update({ [campo]: valor })
        .eq("id", id);

      if (error) throw error;

      // Actualizar estado local
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
    } catch (err) {
      console.error("Error al actualizar:", err);
      setError("Error al guardar los cambios");
      setTimeout(() => setError(""), 3000);
    } finally {
      setGuardandoId(null);
    }
  };

  const eliminarCuenta = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta cuenta?")) return;
    try {
      const { error } = await supabase.from("cuentas").delete().eq("id", id);
      if (error) throw error;
      setCuentas(cuentas.filter((c) => c.id !== id));
    } catch (error: any) {
      console.error("Error:", error);
      alert("Error al eliminar la cuenta");
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
        <div className="text-lg text-gray-600 dark:text-gray-400 font-medium">⏳ Cargando cuentas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Cuentas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
            Gestión inteligente de empresas. <span className="text-blue-500 font-bold underline">Nota:</span> Correo y Teléfono ahora se gestionan en la pestaña de <Link to="/contactos" className="hover:text-blue-600">Contactos</Link>.
          </p>
        </div>
        <Link
          to="/cuentas/nueva"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
        >
          ➕ Nueva Cuenta
        </Link>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, RUT o ciudad..."
            className="w-full border-none rounded-xl px-12 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Estado", val: filtroEstado, set: setFiltroEstado, opts: ["activo", "inactivo", "prospecto"] },
            { label: "Sector", val: filtroSector, set: setFiltroSector, opts: availableSectors },
            { label: "Segmento", val: filtroSegmento, set: setFiltroSegmento, opts: availableSegments },
          ].map((f, i) => (
            <div key={i}>
              <select
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium capitalize"
              >
                <option value="">{f.label}: Todos</option>
                {f.opts.map((opt) => (
                  <option key={opt} value={opt || ""}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={() => { setBusqueda(""); setFiltroSector(""); setFiltroSegmento(""); setFiltroEstado(""); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            <RotateCcw className="h-4 w-4" /> Resetear
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 animate-pulse">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}

      {/* Tabla con Edición Inline */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {["Cliente", "RUT", "Estado", "Sector", "Segmento", "Ciudad", ""].map((h, i) => (
                <th key={i} className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {cuentasPaginadas.length > 0 ? (
              cuentasPaginadas.map((cuenta) => (
                <tr key={cuenta.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                  <td className="px-4 py-2 min-w-[450px]">
                    <textarea
                      defaultValue={cuenta.cliente || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "cliente", e.target.value)}
                      rows={2}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-1 text-sm font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all resize-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      defaultValue={cuenta.rut || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "rut", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all font-mono"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={cuenta.estado || "activo"}
                      onChange={(e) => actualizarCuentaInline(cuenta.id, "estado", e.target.value)}
                      className={`text-xs font-bold rounded-full px-4 py-1.5 border-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer ${cuenta.estado === "activo" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        cuenta.estado === "prospecto" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                    >
                      <option value="activo">ACTIVO</option>
                      <option value="prospecto">PROSPECTO</option>
                      <option value="inactivo">INACTIVO</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 min-w-[120px]">
                    <input
                      defaultValue={cuenta.sector || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "sector", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all"
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[150px]">
                    <input
                      defaultValue={cuenta.segmento || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "segmento", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all"
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[120px]">
                    <input
                      defaultValue={cuenta.ciudad || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "ciudad", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all"
                    />
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {guardandoId === cuenta.id ? (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}

                      <button
                        onClick={() => setCuentaParaInvestigar(cuenta)}
                        className="p-2 text-amber-500 hover:text-amber-600 transition-colors bg-amber-50 dark:bg-amber-900/20 rounded-lg"
                        title="Investigar con Prospector IA"
                      >
                        <Zap className="h-4 w-4 fill-current" />
                      </button>

                      <button
                        onClick={() => eliminarCuenta(cuenta.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        title="Eliminar Cuenta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4 text-gray-500 dark:text-gray-400">
                    <Search className="h-12 w-12 opacity-20" />
                    <div className="max-w-xs mx-auto">
                      <p className="text-lg font-bold">No se encontraron cuentas</p>
                      <p className="text-sm">Intenta ajustar los filtros o la búsqueda para encontrar lo que buscas.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* Paginación */}
      {
        totalPaginas > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 px-6 py-4">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Página <span className="text-gray-900 dark:text-white">{paginaActual}</span> de <span className="text-gray-900 dark:text-white">{totalPaginas}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold disabled:opacity-50 transition-all"
              >
                Anterior
              </button>
              <button
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold disabled:opacity-50 transition-all"
              >
                Siguiente
              </button>
            </div>
          </div>
        )
      }


      {
        cuentaParaInvestigar && (
          <ProspectorIAModal
            cuenta={cuentaParaInvestigar}
            onClose={() => setCuentaParaInvestigar(null)}
            onSuccess={() => {
              setCuentaParaInvestigar(null);
              cargarCuentas();
            }}
          />
        )
      }
    </div >
  );
}
