import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";
import { Trash2, CheckCircle2, AlertCircle, Loader2, Building2, Search, RotateCcw, X, Plus, Sparkles, Edit2, Save, Check, Users, Compass } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SEGMENTOS_MAESTROS } from "../../utils/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentasFiltradas, setCuentasFiltradas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [enriqueciendoId, setEnriqueciendoId] = useState<string | null>(null);
  const [buscandoSimilaresId, setBuscandoSimilaresId] = useState<string | null>(null);

  // Estados para edición inline de segmentos
  const [openSegmentId, setOpenSegmentId] = useState<string | null>(null);
  const [searchSegment, setSearchSegment] = useState("");

  // Estados para prospección
  const [filtroFoco, setFiltroFoco] = useState<string>("todos");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");
  const [stats, setStats] = useState({
    totalFoco: 0,
    sinVerificar: 0,
    verificado: 0,
  });

  // Estados para filtros y búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
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
    cargarEstadisticasProspeccion();
  }, []);

  const cargarEstadisticasProspeccion = async () => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select("etapa_prospeccion")
        .eq("cuenta_foco", true);

      if (error) throw error;

      const counts = {
        totalFoco: 0,
        sinVerificar: 0,
        verificado: 0,
      };

      if (data) {
        counts.totalFoco = data.length;
        data.forEach((c: any) => {
          if (c.etapa_prospeccion === "Verificado") {
            counts.verificado++;
          } else {
            counts.sinVerificar++;
          }
        });
      }
      setStats(counts);
    } catch (err) {
      console.error("Error al cargar estadísticas de prospección:", err);
    }
  };

  const cargarOpcionesFiltros = async () => {
    try {
      // 1. Cargar sectores de las cuentas
      const { data: accountsData } = await supabase.from("cuentas").select("sector");
      if (accountsData) {
        setAvailableSectors(Array.from(new Set(accountsData.map((c: any) => c.sector).filter(Boolean))));
      }

      // 2. Cargar segmentos de la tabla de catálogo
      const { data: catalogData } = await supabase.from("catalogo_segmentos").select("nombre");
      if (catalogData && catalogData.length > 0) {
        const dbSegments = catalogData.map((s: any) => s.nombre).filter(Boolean);
        setAvailableSegments(Array.from(new Set([...SEGMENTOS_MAESTROS, ...dbSegments])).sort());
      } else {
        setAvailableSegments([...SEGMENTOS_MAESTROS].sort());
      }
    } catch (e) {
      console.error("Error cargando opciones de filtros:", e);
    }
  };

  const agregarNuevoSegmentoAlCatálogo = async (nuevoNombre: string, cuentaId: string) => {
    try {
      const { data, error } = await supabase
        .from("catalogo_segmentos")
        .insert([{ nombre: nuevoNombre }])
        .select("nombre")
        .single();

      if (error) throw error;

      if (data) {
        setAvailableSegments(prev => Array.from(new Set([...prev, data.nombre])).sort());
        await actualizarCuentaInline(cuentaId, "segmento", data.nombre);
        setOpenSegmentId(null);
        setSearchSegment("");
      }
    } catch (error: any) {
      console.error("Error al crear segmento inline:", error);
      alert("Error al crear segmento: " + error.message);
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
    } catch (error: any) {
      console.error("Error al eliminar segmento del catálogo:", error);
      alert("Error al eliminar segmento: " + error.message);
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
  }, [paginaActual, busqueda, filtroSector, filtroSegmento, filtroEstado, filtroFoco, filtroEtapa, hayFiltroActivo]);


  const cargarCuentas = async () => {
    try {
      setCargando(true);
      setError("");

      let query = supabase
        .from("cuentas")
        .select("*, vendedores(nombre), contactos:contactos!contactos_cuenta_id_fkey(id, nombre, correo, celular, telefono)", { count: "exact" });

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
      if (filtroFoco === "foco") {
        query = query.eq("cuenta_foco", true);
      }
      if (filtroEtapa !== "todas") {
        if (filtroEtapa === "Sin Verificar") {
          query = query.or("etapa_prospeccion.eq.Sin Verificar,etapa_prospeccion.is.null");
        } else {
          query = query.eq("etapa_prospeccion", filtroEtapa);
        }
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

  const handleReset = () => {
    setBusqueda("");
    setFiltroSector("");
    setFiltroSegmento("");
    setFiltroEstado("");
    setFiltroFoco("todos");
    setFiltroEtapa("todas");
    setPaginaActual(1);
  };


  const actualizarCuentaInline = async (id: string, campo: keyof Cuenta, valor: any) => {
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
      
      // Recargar estadísticas si cambió la etapa o el foco
      if (campo === "cuenta_foco" || campo === "etapa_prospeccion") {
        cargarEstadisticasProspeccion();
      }
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

  const enriquecerConIA = async (cuentaId: string) => {
    setEnriqueciendoId(cuentaId);
    setError("");
    try {
      const response = await fetch("/api/enrich-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cuentaId, mode: 'basic' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al enriquecer con IA");
      }
      await cargarCuentas();
    } catch (err: any) {
      console.error("Error al enriquecer con IA:", err);
      setError(err.message || "Error al enriquecer con IA");
      setTimeout(() => setError(""), 5000);
    } finally {
      setEnriqueciendoId(null);
    }
  };

  const buscarSimilaresConIA = async (cuentaId: string) => {
    setBuscandoSimilaresId(cuentaId);
    setError("");
    try {
      const response = await fetch("/api/enrich-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cuentaId, mode: 'similar' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al buscar empresas similares");
      }
      await cargarCuentas();
    } catch (err: any) {
      console.error("Error al buscar similares con IA:", err);
      setError(err.message || "Error al buscar empresas similares con IA");
      setTimeout(() => setError(""), 5000);
    } finally {
      setBuscandoSimilaresId(null);
    }
  };


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

      {/* Panel de Agenda de Prospección Rápida */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => {
            const act = filtroFoco === "foco" && filtroEtapa === "todas";
            setFiltroFoco(act ? "todos" : "foco");
            setFiltroEtapa("todas");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco" && filtroEtapa === "todas"
              ? "bg-yellow-500/15 border-yellow-500 text-yellow-700 dark:text-yellow-400 ring-2 ring-yellow-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">⭐ Cuentas Foco Totales</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.totalFoco}</p>
          </div>
          <span className="text-2xl">⭐</span>
        </button>

        <button
          onClick={() => {
            const act = filtroFoco === "foco" && filtroEtapa === "Sin Verificar";
            setFiltroFoco(act ? "todos" : "foco");
            setFiltroEtapa(act ? "todas" : "Sin Verificar");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco" && filtroEtapa === "Sin Verificar"
              ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">🔍 Sin Verificar (Foco)</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.sinVerificar}</p>
          </div>
          <span className="text-2xl">🔍</span>
        </button>

        <button
          onClick={() => {
            const act = filtroFoco === "foco" && filtroEtapa === "Verificado";
            setFiltroFoco(act ? "todos" : "foco");
            setFiltroEtapa(act ? "todas" : "Verificado");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco" && filtroEtapa === "Verificado"
              ? "bg-green-500/15 border-green-500 text-green-700 dark:text-green-400 ring-2 ring-green-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">✅ Verificado (Foco)</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.verificado}</p>
          </div>
          <span className="text-2xl">✅</span>
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por cliente, RUT o ciudad..."
              className="w-full border-none rounded-xl px-12 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
            {cargando ? (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : busqueda ? (
              <button
                onClick={() => { setBusqueda(""); }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {[
            { label: "Estado", val: filtroEstado, set: setFiltroEstado, opts: ["activo", "inactivo", "prospecto"] },
            { label: "Sector", val: filtroSector, set: setFiltroSector, opts: availableSectors },
            { label: "Segmento", val: filtroSegmento, set: setFiltroSegmento, opts: availableSegments },
            {
              label: "Prioridad",
              val: filtroFoco,
              set: setFiltroFoco,
              opts: [
                { value: "todos", label: "Prioridad: Todas" },
                { value: "foco", label: "⭐ Solo Foco" }
              ]
            },
            {
              label: "Etapa Prosp.",
              val: filtroEtapa,
              set: setFiltroEtapa,
              opts: [
                { value: "todas", label: "Etapa: Todas" },
                { value: "Sin Verificar", label: "🔍 Sin Verificar" },
                { value: "Verificado", label: "✅ Verificado" }
              ]
            }
          ].map((f, i) => (
            <div key={i}>
              <select
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium capitalize"
              >
                {Array.isArray(f.opts) && typeof f.opts[0] === 'string' ? (
                  <>
                    <option value="">{f.label}: Todos</option>
                    {f.opts.map((opt) => (
                      <option key={opt} value={opt || ""}>{opt}</option>
                    ))}
                  </>
                ) : (
                  (f.opts as any[]).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))
                )}
              </select>
            </div>
          ))}
          <button
            onClick={handleReset}
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
              {["Cliente", "Estado", "Sector", "Segmento", "Etapa", "Ciudad", ""].map((h, i) => (
                <th key={i} className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y divide-gray-100 dark:divide-gray-700 transition-opacity duration-200 ${cargando ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {cargando && cuentasPaginadas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
                    <div className="text-gray-600 dark:text-gray-400 font-medium">⏳ Sincronizando cuentas...</div>
                  </div>
                </td>
              </tr>
            ) : cuentasPaginadas.length > 0 ? (
              cuentasPaginadas.map((cuenta) => (
                <tr
                  key={cuenta.id}
                  className={`group transition-colors ${
                    cuenta.origen === 'AI'
                      ? "bg-cyan-100/80 dark:bg-cyan-950/50 hover:bg-cyan-200/60 dark:hover:bg-cyan-900/50"
                      : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                  }`}
                >
                  <td className="px-4 py-2 min-w-[280px]">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[28px]">
                        {/* Botón de estrella de prioridad */}
                        <button
                          type="button"
                          onClick={() => actualizarCuentaInline(cuenta.id, "cuenta_foco", !cuenta.cuenta_foco)}
                          className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-yellow-500 transition-all transform hover:scale-110 cursor-pointer"
                          title={cuenta.cuenta_foco ? "Quitar prioridad" : "Marcar como prioridad (Foco)"}
                        >
                          <span className={`text-lg leading-none ${cuenta.cuenta_foco ? "text-yellow-500 fill-current font-bold" : "opacity-30"}`}>★</span>
                        </button>
                        {cuenta.origen === 'AI' && (
                          <span className="px-1 py-0.5 rounded bg-cyan-200 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 text-[8px] font-black uppercase tracking-widest leading-none">
                            IA
                          </span>
                        )}
                      </div>

                      {cuenta.contactos && cuenta.contactos.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="mt-1.5 p-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 text-blue-600 dark:text-blue-400 cursor-pointer transition-all hover:scale-105 shrink-0"
                              title={`Ver ${cuenta.contactos.length} contacto(s)`}
                            >
                              <Plus className="h-3 w-3 font-bold" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl z-50" align="start">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2 mb-2 uppercase tracking-wide flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-500" />
                              Contactos de la Cuenta
                            </h4>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                              {cuenta.contactos.map((contact: any) => (
                                <div key={contact.id} className="text-xs border-b border-gray-50 dark:border-gray-700/50 pb-2 last:border-0 last:pb-0">
                                  <p className="font-bold text-gray-900 dark:text-gray-100 uppercase">{contact.nombre || "Sin nombre"}</p>
                                  {contact.correo && (
                                    <p className="text-gray-500 dark:text-gray-400 mt-0.5 truncate">{contact.correo}</p>
                                  )}
                                  {(contact.celular || contact.telefono) && (
                                    <p className="text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                                      📞 {contact.celular || contact.telefono}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="w-5 shrink-0" />
                      )}
                      
                      <div className="flex-grow flex flex-col">
                        <textarea
                          defaultValue={cuenta.cliente || ""}
                          onBlur={(e) => actualizarCuentaInline(cuenta.id, "cliente", e.target.value)}
                          rows={2}
                          className="w-full bg-transparent border-none rounded-lg px-2 py-1 text-sm font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all resize-none"
                        />
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold px-2 pb-1">
                          👤 {cuenta.vendedores?.nombre || "Sin Asignar (IA)"}
                        </span>
                      </div>
                    </div>
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
                  <td className="px-4 py-2 min-w-[200px]">
                    <Popover 
                      open={openSegmentId === cuenta.id} 
                      onOpenChange={(open) => {
                        if (open) {
                          setOpenSegmentId(cuenta.id);
                        } else {
                          setOpenSegmentId(null);
                          setSearchSegment("");
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-lg text-sm transition-all focus:ring-1 focus:ring-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                            cuenta.segmento ? "text-gray-900 dark:text-white font-medium" : "text-gray-400 dark:text-gray-500 italic"
                          )}
                        >
                          {cuenta.segmento || "Seleccionar..."}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl z-50" align="start">
                        <div className="flex flex-col space-y-2">
                          <input
                            type="text"
                            placeholder="Buscar o escribir nuevo..."
                            value={searchSegment}
                            onChange={(e) => setSearchSegment(e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <div className="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar">
                            {availableSegments
                              .filter((seg) => seg.toLowerCase().includes(searchSegment.toLowerCase()))
                              .length === 0 ? (
                                <div className="py-2 text-center text-xs text-gray-500">
                                  No se encontraron segmentos.
                                </div>
                              ) : (
                                availableSegments
                                  .filter((seg) => seg.toLowerCase().includes(searchSegment.toLowerCase()))
                                  .map((seg) => (
                                    <div
                                      key={seg}
                                      className="group/item flex items-center justify-between px-2 py-1 text-xs rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await actualizarCuentaInline(cuenta.id, "segmento", seg);
                                          setOpenSegmentId(null);
                                          setSearchSegment("");
                                        }}
                                        className="flex-1 text-left text-gray-900 dark:text-gray-100 font-medium"
                                      >
                                        {seg}
                                      </button>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {cuenta.segmento === seg && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                                        {!SEGMENTOS_MAESTROS.includes(seg) && (
                                          <button
                                            type="button"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm(`¿Estás seguro de que deseas eliminar el segmento "${seg}" del catálogo?`)) {
                                                await eliminarSegmentoDelCatálogo(seg);
                                              }
                                            }}
                                            className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer"
                                            title="Eliminar de la lista"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                              )}
                          </div>
                          {searchSegment.trim() && !availableSegments.some(s => s.toLowerCase() === searchSegment.trim().toLowerCase()) && (
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                              <button
                                type="button"
                                className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center gap-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                                onClick={() => {
                                  agregarNuevoSegmentoAlCatálogo(searchSegment.trim(), cuenta.id);
                                }}
                              >
                                <Plus className="h-3 w-3" />
                                Crear "{searchSegment.trim()}"
                              </button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-4 py-2 min-w-[150px]">
                    <select
                      value={cuenta.etapa_prospeccion || "Sin Verificar"}
                      onChange={(e) => actualizarCuentaInline(cuenta.id, "etapa_prospeccion", e.target.value)}
                      className={`text-xs font-bold rounded-lg px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                        cuenta.etapa_prospeccion === "Verificado" 
                          ? "text-green-600 dark:text-green-400 font-bold" 
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      <option value="Sin Verificar">🔍 Sin Verificar</option>
                      <option value="Verificado">✅ Verificado</option>
                    </select>
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
                        <Link
                          to={`/cuentas/editar/${cuenta.id}`}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Editar Cuenta"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                      )}

                      {enriqueciendoId === cuenta.id ? (
                        <Loader2 className="h-4 w-4 text-cyan-500 animate-spin" />
                      ) : (
                        <button
                          onClick={() => enriquecerConIA(cuenta.id)}
                          className="p-2 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Enriquecer Datos Básicos con IA"
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                      )}

                      {buscandoSimilaresId === cuenta.id ? (
                        <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
                      ) : (
                        <button
                          onClick={() => buscarSimilaresConIA(cuenta.id)}
                          className="p-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Buscar 5 empresas similares en Chile"
                        >
                          <Compass className="h-4 w-4" />
                        </button>
                      )}

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
    </div >
  );
}
