import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";
import { Trash2, CheckCircle2, AlertCircle, Loader2, Building2, Search, RotateCcw, X, Plus, Sparkles, Edit2, Save, Check, Users, Compass, UserPlus, Mail, Pencil } from "lucide-react";
import { DraggableModal } from "@/components/ui/draggable-modal";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVendedores } from "../../hooks/useVendedores";
import { ZohoMailModal } from "@/components/modals/ZohoMailModal";
import { PautaProspeccionModal } from "@/components/modals/PautaProspeccionModal";
import { SEGMENTOS_MAESTROS } from "../../utils/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const SECTORES_CUENTAS = ["Privado", "Público"];

const sanitizarBusqueda = (texto: string): string => {
  if (!texto) return "";
  return texto.replace(/[,()&|]/g, " ").replace(/\s+/g, " ").trim();
};

export default function CuentasPage() {
  const navigate = useNavigate();
  const { vendedores } = useVendedores();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [enriqueciendoId, setEnriqueciendoId] = useState<string | null>(null);
  const [buscandoSimilaresId, setBuscandoSimilaresId] = useState<string | null>(null);
  const [cuentaIdActiva, setCuentaIdActiva] = useState<string | null>(null);
  const [contactsModalOpenId, setContactsModalOpenId] = useState<string | null>(null);
  const [modalBasicAbierto, setModalBasicAbierto] = useState(false);
  const [datosBasicosPropuestos, setDatosBasicosPropuestos] = useState<{ web: string; telefono: string; ciudad: string; segmento: string }>({ web: "", telefono: "", ciudad: "", segmento: "" });
  const [modalSimilaresAbierto, setModalSimilaresAbierto] = useState(false);
  const [modalPautaAbierto, setModalPautaAbierto] = useState(false);
  const [listaSimilaresEncontradas, setListaSimilaresEncontradas] = useState<{ cliente: string; web?: string; ciudad?: string }[]>([]);
  const [empresaOriginalNombre, setEmpresaOriginalNombre] = useState("");

  // Estados para edición inline de segmentos
  const [openSegmentId, setOpenSegmentId] = useState<string | null>(null);
  const [searchSegment, setSearchSegment] = useState("");

  // Estados para prospección
  const [filtroFoco, setFiltroFoco] = useState<string>(() => sessionStorage.getItem("cuentas_filtroFoco") || "todos");
  const [filtroEtapa, setFiltroEtapa] = useState<string>(() => sessionStorage.getItem("cuentas_filtroEtapa") || "todas");
  const [stats, setStats] = useState({
    totalCuentas: 0,
    totalFoco: 0,
    totalActivas: 0,
  });

  // Estados para filtros y búsqueda (limpiando valores heredados inconsistentes)
  const [busqueda, setBusqueda] = useState(() => sessionStorage.getItem("cuentas_busqueda") || "");
  const [filtroSector, setFiltroSector] = useState(() => {
    const saved = sessionStorage.getItem("cuentas_filtroSector") || "";
    return saved;
  });
  const [filtroSegmento, setFiltroSegmento] = useState(() => {
    const saved = sessionStorage.getItem("cuentas_filtroSegmento") || "";
    // Si quedó guardado un valor de sector ('privado' o 'publico') en el filtro de segmento, limpiarlo
    if (["privado", "publico", "Privado", "Público"].includes(saved)) {
      sessionStorage.removeItem("cuentas_filtroSegmento");
      return "";
    }
    return saved;
  });
  const [filtroEstado, setFiltroEstado] = useState(() => sessionStorage.getItem("cuentas_filtroEstado") || "");
  const [filtroVendedor, setFiltroVendedor] = useState(() => sessionStorage.getItem("cuentas_filtroVendedor") || "");
  const [filtroFecha, setFiltroFecha] = useState(() => sessionStorage.getItem("cuentas_filtroFecha") || "");

  // --- Estados para Redacción Manual Zoho ---
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [selectedContactoDraft, setSelectedContactoDraft] = useState<any>(null);
  const [selectedCuentaDraft, setSelectedCuentaDraft] = useState<any>(null);
  const [vendedor, setVendedor] = useState("");

  useEffect(() => {
    if (vendedores && vendedores.length > 0 && (vendedor === "Vendedor 1" || vendedor === "")) {
      setVendedor(vendedores[0].nombre);
    }
  }, [vendedores]);

  // Sincronizar filtros a sessionStorage para persistencia en navegación
  useEffect(() => { sessionStorage.setItem("cuentas_filtroFoco", filtroFoco); }, [filtroFoco]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroEtapa", filtroEtapa); }, [filtroEtapa]);
  useEffect(() => { sessionStorage.setItem("cuentas_busqueda", busqueda); }, [busqueda]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroSector", filtroSector); }, [filtroSector]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroSegmento", filtroSegmento); }, [filtroSegmento]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroEstado", filtroEstado); }, [filtroEstado]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroVendedor", filtroVendedor); }, [filtroVendedor]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroFecha", filtroFecha); }, [filtroFecha]);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;

  // Estados para opciones de filtros (se cargan una vez al inicio)
  const [availableSectors, setAvailableSectors] = useState<string[]>(SECTORES_CUENTAS);
  const [availableSegments, setAvailableSegments] = useState<string[]>(SEGMENTOS_MAESTROS);
  const [totalRecords, setTotalRecords] = useState(0);

  // No longer restricted, we use server-side pagination for performance
  const hayFiltroActivo = true;

  const abrirModalZoho = (contacto: any, cuenta: any) => {
    setSelectedContactoDraft(contacto);
    setSelectedCuentaDraft(cuenta);
    setIsZohoModalOpen(true);
  };

  const formatToInputDate = (dateStr: string): string => {
    if (!dateStr || dateStr === "—") return "";
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return "";
  };

  const cargarEstadisticasProspeccion = async () => {
    try {
      const { count: totalCuentas, error: errorTotal } = await supabase
        .from("cuentas")
        .select("*", { count: "exact", head: true });

      const { count: totalFoco, error: errorFoco } = await supabase
        .from("cuentas")
        .select("*", { count: "exact", head: true })
        .eq("cuenta_foco", true);

      const { count: totalActivas, error: errorActivas } = await supabase
        .from("cuentas")
        .select("*", { count: "exact", head: true })
        .eq("cuenta_activa", true);

      if (errorTotal) throw errorTotal;
      if (errorFoco) throw errorFoco;
      if (errorActivas) throw errorActivas;

      setStats({
        totalCuentas: totalCuentas || 0,
        totalFoco: totalFoco || 0,
        totalActivas: totalActivas || 0,
      });
    } catch (err) {
      console.error("Error al cargar estadísticas de prospección:", err);
    }
  };

  const cargarOpcionesFiltros = async () => {
    try {
      // 1. Opciones de sector (Privado / Público)
      setAvailableSectors(SECTORES_CUENTAS);

      // 2. Cargar segmentos (rubros: Educación, Minería, Salud, etc.)
      const { data: catalogData } = await supabase
        .from("catalogo_segmentos")
        .select("nombre");

      const catalogos = catalogData?.map((s: any) => s.nombre).filter(Boolean) || [];
      const segmentosCombinados = Array.from(new Set([...SEGMENTOS_MAESTROS, ...catalogos])).sort();
      setAvailableSegments(segmentosCombinados);
    } catch (e) {
      console.error("Error cargando opciones de filtros:", e);
      setAvailableSectors(SECTORES_CUENTAS);
      setAvailableSegments(SEGMENTOS_MAESTROS);
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

  // Carga de opciones de filtros y estadísticas al montar
  useEffect(() => {
    cargarEstadisticasProspeccion();
    cargarOpcionesFiltros();
  }, []);

  const cargarCuentas = async () => {
    try {
      setCargando(true);
      setError("");

      const busquedaLimpia = sanitizarBusqueda(busqueda);
      const offset = (paginaActual - 1) * filasPorPagina;
      const limite = filasPorPagina;

      // Determinar si hay algún filtro activo
      const tieneFiltros = Boolean(
        filtroSegmento ||
        busquedaLimpia ||
        filtroSector ||
        filtroEstado ||
        filtroVendedor ||
        filtroFoco === "foco" ||
        (filtroEtapa && filtroEtapa !== "todas") ||
        filtroFecha
      );

      // Usar count "exact" cuando hay filtros activos; "estimated" para tabla total sin condiciones
      const tipoConteo: "exact" | "estimated" = tieneFiltros ? "exact" : "estimated";

      let query = supabase
        .from("cuentas")
        .select(
          "*, vendedores(nombre), contactos:contactos!contactos_cuenta_id_fkey(id, nombre, correo, celular, telefono, imagen, ultimo_envio, ultimo_evento_trazabilidad, estado, etapa)",
          { count: tipoConteo }
        );

      // 1. Filtro directo en sector (Público / Privado) usando ILIKE directo
      if (filtroSector) {
        const sectorNormalizado = filtroSector
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

        if (sectorNormalizado === "publico") {
          query = query.ilike("sector", "Público");
        } else if (sectorNormalizado === "privado") {
          query = query.ilike("sector", "Privado");
        } else {
          query = query.ilike("sector", filtroSector.trim());
        }
      }

      // 2. Filtro de segmento (Rubro: Educación, Minería, Salud, etc.)
      if (filtroSegmento && !["privado", "publico", "Privado", "Público"].includes(filtroSegmento)) {
        query = query.ilike("segmento", filtroSegmento.trim());
      }

      // 3. Búsqueda directa en SQL con ILIKE sanitizado
      if (busquedaLimpia) {
        query = query.or(
          `cliente.ilike.%${busquedaLimpia}%,rut.ilike.%${busquedaLimpia}%,ciudad.ilike.%${busquedaLimpia}%`
        );
      }

      // 4. Filtros adicionales en servidor
      if (filtroEstado) {
        query = query.eq("estado", filtroEstado);
      }
      if (filtroVendedor) {
        if (filtroVendedor === "null") {
          query = query.is("vendedor_id", null);
        } else {
          query = query.eq("vendedor_id", filtroVendedor);
        }
      }
      if (filtroFoco === "foco") {
        query = query.eq("cuenta_foco", true);
      }
      if (filtroEtapa && filtroEtapa !== "todas") {
        if (filtroEtapa === "Sin Verificar") {
          query = query.or("etapa_prospeccion.is.null,etapa_prospeccion.eq.Sin Verificar");
        } else {
          query = query.eq("etapa_prospeccion", filtroEtapa);
        }
      }
      if (filtroFecha) {
        query = query
          .gte("created_at", `${filtroFecha}T00:00:00`)
          .lte("created_at", `${filtroFecha}T23:59:59`);
      }

      // 5. Ordenamiento y Paginación SQL (LIMIT $limite OFFSET $offset)
      query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limite - 1);

      const { data, count, error: queryError } = await query;

      if (queryError) throw queryError;

      setCuentas(data || []);
      setTotalRecords(count || 0);
    } catch (err: any) {
      console.error("Error al cargar cuentas:", err);
      setError("No se pudieron cargar las cuentas: " + (err.message || JSON.stringify(err)));
    } finally {
      setCargando(false);
    }
  };

  // Resetear a página 1 al cambiar cualquier filtro o término de búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [
    busqueda,
    filtroSector,
    filtroSegmento,
    filtroEstado,
    filtroVendedor,
    filtroFoco,
    filtroEtapa,
    filtroFecha,
  ]);

  // Disparador reactivo con debounce para búsquedas y cambios de filtros
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarCuentas();
    }, 300);

    return () => clearTimeout(timer);
  }, [
    paginaActual,
    busqueda,
    filtroSector,
    filtroSegmento,
    filtroEstado,
    filtroVendedor,
    filtroFoco,
    filtroEtapa,
    filtroFecha,
  ]);

  const totalPaginas = Math.ceil(totalRecords / filasPorPagina);
  const cuentasPaginadas = cuentas;

  const handleReset = () => {
    sessionStorage.removeItem("cuentas_busqueda");
    sessionStorage.removeItem("cuentas_filtroSector");
    sessionStorage.removeItem("cuentas_filtroSegmento");
    sessionStorage.removeItem("cuentas_filtroEstado");
    sessionStorage.removeItem("cuentas_filtroVendedor");
    sessionStorage.removeItem("cuentas_filtroFoco");
    sessionStorage.removeItem("cuentas_filtroEtapa");
    sessionStorage.removeItem("cuentas_filtroFecha");
    setBusqueda("");
    setFiltroSector("");
    setFiltroSegmento("");
    setFiltroEstado("");
    setFiltroVendedor("");
    setFiltroFoco("todos");
    setFiltroEtapa("todas");
    setFiltroFecha("");
    setPaginaActual(1);
  };


  const actualizarCuentaInline = async (id: string, campo: keyof Cuenta, valor: any) => {
    const cuentaOriginal = cuentas.find(c => c.id === id);
    if (cuentaOriginal && cuentaOriginal[campo] === valor) return;

    setGuardandoId(id);
    try {
      const updatePayload: any = { [campo]: valor };
      
      // Mutuamente excluyentes: si se marca Foco, se desmarca Activa y viceversa
      if (campo === "cuenta_foco" && valor === true) {
        updatePayload.cuenta_activa = false;
      } else if (campo === "cuenta_activa" && valor === true) {
        updatePayload.cuenta_foco = false;
      }

      const { error } = await supabase
        .from("cuentas")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      // Actualizar estado local
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...updatePayload } : c));
      
      // Recargar estadísticas si cambió la etapa o las marcas de foco/activa
      if (campo === "cuenta_foco" || campo === "cuenta_activa" || campo === "etapa_prospeccion") {
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
      setCuentas(prev => prev.filter((c) => c.id !== id));
      setTotalRecords(prev => Math.max(0, prev - 1));
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
      
      const resData = data.data || {};
      setDatosBasicosPropuestos({
        web: resData.web || "",
        telefono: resData.telefono || "",
        ciudad: resData.ciudad || "",
        segmento: resData.segmento || ""
      });
      setCuentaIdActiva(cuentaId);
      setModalBasicAbierto(true);
    } catch (err: any) {
      console.error("Error al enriquecer con IA:", err);
      setError(err.message || "Error al enriquecer con IA");
      setTimeout(() => setError(""), 5000);
    } finally {
      setEnriqueciendoId(null);
    }
  };

  const guardarDatosBasicosConfirmados = async () => {
    if (!cuentaIdActiva) return;
    try {
      const payload = {
        web: datosBasicosPropuestos.web || null,
        telefono: datosBasicosPropuestos.telefono || null,
        ciudad: datosBasicosPropuestos.ciudad || null,
        segmento: datosBasicosPropuestos.segmento || null,
        origen: 'AI'
      };
      
      const { error } = await supabase
        .from("cuentas")
        .update(payload)
        .eq("id", cuentaIdActiva);
        
      if (error) throw error;
      setModalBasicAbierto(false);
      await cargarCuentas();
    } catch (err: any) {
      console.error("Error al guardar datos enriquecidos:", err);
      alert("Error al guardar datos enriquecidos: " + err.message);
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
      
      const { data: accountData } = await supabase.from("cuentas").select("cliente").eq("id", cuentaId).single();
      const originalName = accountData?.cliente || "";
      const similares = data.data?.similares || [];
      
      setEmpresaOriginalNombre(originalName);
      setListaSimilaresEncontradas(similares);
      setCuentaIdActiva(cuentaId);
      setModalSimilaresAbierto(true);
    } catch (err: any) {
      console.error("Error al buscar similares con IA:", err);
      setError(err.message || "Error al buscar empresas similares con IA");
      setTimeout(() => setError(""), 5000);
    } finally {
      setBuscandoSimilaresId(null);
    }
  };

  const guardarSimilaresConfirmadas = async () => {
    if (!cuentaIdActiva) return;
    try {
      const { data: activeAcc } = await supabase.from("cuentas").select("sector, segmento").eq("id", cuentaIdActiva).single();
      const sector = activeAcc?.sector || 'privado';
      const segmento = activeAcc?.segmento || 'Servicios';

      for (const emp of listaSimilaresEncontradas) {
        if (!emp.cliente || emp.cliente.trim() === "") continue;

        const { data: existingEmp } = await supabase
          .from("cuentas")
          .select("id")
          .ilike("cliente", emp.cliente.trim())
          .maybeSingle();

        if (existingEmp) continue;

        await supabase.from("cuentas").insert([
          {
            cliente: emp.cliente.trim(),
            web: emp.web || null,
            ciudad: emp.ciudad || "Santiago",
            sector,
            segmento,
            estado: "prospecto",
            etapa_prospeccion: "Sin Verificar",
            origen: "AI",
            cuenta_foco: true,
            vendedor_id: null,
            created_at: new Date().toISOString()
          }
        ]);
      }
      setModalSimilaresAbierto(false);
      await cargarCuentas();
    } catch (err: any) {
      console.error("Error al guardar similares:", err);
      alert("Error al guardar similares: " + err.message);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => {
            setFiltroFoco("todos");
            setFiltroEstado("activo");
            setFiltroEtapa("todas");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroEstado === "activo"
              ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">🟢 Cuentas Activas</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.totalActivas}</p>
          </div>
          <span className="text-2xl">🟢</span>
        </button>

        <button
          onClick={() => {
            setFiltroFoco("foco");
            setFiltroEstado("");
            setFiltroEtapa("todas");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco"
              ? "bg-yellow-500/15 border-yellow-500 text-yellow-700 dark:text-yellow-400 ring-2 ring-yellow-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">⭐ Cuentas Foco</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.totalFoco}</p>
          </div>
          <span className="text-2xl">⭐</span>
        </button>

        <button
          onClick={() => setModalPautaAbierto(true)}
          className="p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20"
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">📘 Pauta de Prospección</p>
            <p className="text-sm font-medium mt-1 text-gray-600 dark:text-gray-400">Ver reglas y matriz</p>
          </div>
          <span className="text-2xl">📖</span>
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
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

          <div className="relative">
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => {
                setFiltroFecha(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full border-none rounded-xl px-6 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer"
              title="Filtrar por fecha de ingreso"
            />
            {filtroFecha ? (
              <button
                onClick={() => { setFiltroFecha(""); }}
                className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Limpiar fecha"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {[
            { label: "Sector", val: filtroSector, set: setFiltroSector, opts: availableSectors },
            { label: "Segmento", val: filtroSegmento, set: setFiltroSegmento, opts: availableSegments },
            {
              label: "Vendedor",
              val: filtroVendedor,
              set: setFiltroVendedor,
              opts: [
                { value: "", label: "Vendedor: Todos" },
                ...vendedores.map((v) => ({ value: v.id, label: `👤 ${v.nombre}` })),
                { value: "null", label: "👤 Sin Asignar (IA)" }
              ]
            },
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
                className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-xs font-semibold capitalize"
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
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resetear
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
              {["Cliente", "Teléfono", "Sector", "Segmento", "Etapa", "Fecha ingreso", ""].map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest",
                    h === "Sector" ? "w-[100px] min-w-[90px] text-center" : ""
                  )}
                >
                  {h}
                </th>
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
                        <button
                          type="button"
                          onClick={() => actualizarCuentaInline(cuenta.id, "cuenta_activa", !cuenta.cuenta_activa)}
                          className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-green-500 transition-all transform hover:scale-110 cursor-pointer ml-1"
                          title={cuenta.cuenta_activa ? "Quitar estado activo" : "Marcar como Cuenta Activa (Verde)"}
                        >
                          <span className={`text-[12px] leading-none ${cuenta.cuenta_activa ? "" : "opacity-30 filter grayscale"}`} style={cuenta.cuenta_activa ? { filter: "drop-shadow(0 0 2px rgba(34, 197, 94, 0.5))" } : {}}>🟢</span>
                        </button>
                        {cuenta.origen === 'AI' && (
                          <span className="px-1 py-0.5 rounded bg-cyan-200 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 text-[8px] font-black uppercase tracking-widest leading-none mt-1">
                            IA
                          </span>
                        )}
                      </div>

                      {cuenta.contactos && cuenta.contactos.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setContactsModalOpenId(cuenta.id)}
                            className="mt-1.5 p-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 text-blue-600 dark:text-blue-400 cursor-pointer transition-all hover:scale-105 shrink-0"
                            title={`Ver ${cuenta.contactos.length} contacto(s)`}
                          >
                            <Plus className="h-3 w-3 font-bold" />
                          </button>
                          <DraggableModal
                            isOpen={contactsModalOpenId === cuenta.id}
                            onClose={() => setContactsModalOpenId(null)}
                            title={
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-500" />
                                <span className="font-bold text-sm uppercase tracking-wide">Contactos de la Cuenta</span>
                              </div>
                            }
                            defaultSize={{ width: 400, height: 350 }}
                          >
                            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                              {cuenta.contactos.map((contact: any) => (
                                <div key={contact.id} className="text-xs border-b border-gray-100 dark:border-gray-700/50 pb-3 last:border-0 last:pb-0">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-[13px] text-gray-900 dark:text-gray-100 uppercase truncate">{contact.nombre || "Sin nombre"}</p>
                                      {contact.correo && (
                                        <p className="text-gray-500 dark:text-gray-400 mt-1 truncate" title={contact.correo}>{contact.correo}</p>
                                      )}
                                      {(contact.celular || contact.telefono) && (
                                        <p className="text-gray-500 dark:text-gray-500 mt-1 font-mono font-medium">
                                          📞 {contact.celular || contact.telefono}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => { setContactsModalOpenId(null); navigate(`/contactos/editar/${contact.id}`); }}
                                        className="px-2 py-1.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold transition-colors flex items-center justify-center gap-1 w-full"
                                        title="Editar contacto"
                                      >
                                        <Pencil className="h-3 w-3" /> Editar
                                      </button>
                                      {contact.correo && (
                                        <button
                                          type="button"
                                          onClick={() => { setContactsModalOpenId(null); abrirModalZoho(contact, cuenta); }}
                                          className="px-2 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold transition-colors flex items-center justify-center gap-1 w-full"
                                          title="Preparar correo de Zoho"
                                        >
                                          <Mail className="h-3 w-3" /> Correo
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </DraggableModal>
                        </>
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

                  <td className="px-4 py-2 min-w-[150px]">
                    <input
                      defaultValue={cuenta.telefono || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "telefono", e.target.value)}
                      placeholder="Sin teléfono"
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 w-[100px] min-w-[90px]">
                    <input
                      defaultValue={cuenta.sector || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "sector", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-1 py-1.5 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-center"
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
                  <td className="px-4 py-2 min-w-[150px]">
                    <input
                      type="date"
                      defaultValue={cuenta.created_at ? (() => {
                        const d = new Date(cuenta.created_at);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      })() : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          try {
                            const localDate = new Date(`${e.target.value}T12:00:00`);
                            actualizarCuentaInline(cuenta.id, "created_at", localDate.toISOString());
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all cursor-pointer font-medium"
                    />
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {(cuenta.cuenta_foco || cuenta.cuenta_activa) && (
                        <Link
                          to={`/marketing`}
                          className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Ir a Matrix Sentinel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
                        </Link>
                      )}

                      <Link
                        to={`/contactos/nuevo?cuentaId=${cuenta.id}&returnTo=/cuentas`}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors rounded-lg cursor-pointer"
                        title="Agregar Contacto"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Link>

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

      {/* Modal 1: Datos Básicos Encontrados */}
      <Dialog open={modalBasicAbierto} onOpenChange={setModalBasicAbierto}>
        <DialogContent className="max-w-md p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-500" />
              Datos de Cuenta Propuestos por IA
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Revisa y edita los datos básicos encontrados antes de aplicarlos a la cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Sitio Web</label>
              <input
                type="text"
                value={datosBasicosPropuestos.web}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, web: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="www.ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Teléfono</label>
              <input
                type="text"
                value={datosBasicosPropuestos.telefono}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, telefono: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="+56 2..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Ciudad</label>
              <input
                type="text"
                value={datosBasicosPropuestos.ciudad}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, ciudad: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Santiago"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Segmento</label>
              <select
                value={datosBasicosPropuestos.segmento}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, segmento: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona segmento...</option>
                {availableSegments.map(seg => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setModalBasicAbierto(false)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={guardarDatosBasicosConfirmados}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all shadow-md text-sm cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Empresas Similares Encontradas */}
      <Dialog open={modalSimilaresAbierto} onOpenChange={setModalSimilaresAbierto}>
        <DialogContent className="max-w-md p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-violet-500" />
              Empresas Similares Encontradas
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Hemos detectado los siguientes competidores de <span className="font-bold text-gray-950 dark:text-white">"{empresaOriginalNombre}"</span> en Chile. Presiona Aceptar para crearlos.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
            {listaSimilaresEncontradas.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
                No se encontraron nuevas empresas similares.
              </div>
            ) : (
              listaSimilaresEncontradas.map((emp, index) => (
                <div 
                  key={index}
                  className="flex flex-col p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    ⭐ {emp.cliente}
                  </span>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {emp.ciudad && (
                      <span>📍 {emp.ciudad}</span>
                    )}
                    {emp.web && (
                      <span className="text-blue-500 truncate max-w-[200px]">
                        🔗 {emp.web}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setModalSimilaresAbierto(false)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={guardarSimilaresConfirmadas}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all shadow-md text-sm cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REDACCION ZOHO */}
      <ZohoMailModal
        isOpen={isZohoModalOpen}
        onOpenChange={setIsZohoModalOpen}
        contacto={selectedContactoDraft}
        cuenta={selectedCuentaDraft}
        vendedor={vendedor || ""}
        defaultTab="clientes"
        onRefresh={async () => {
          await cargarCuentas();
        }}
      />
      {/* Modal Pauta de Prospección */}
      <PautaProspeccionModal 
        isOpen={modalPautaAbierto} 
        onClose={() => setModalPautaAbierto(false)} 
      />
    </div >
  );
}

// --- Helper to get clean fantasy/short name for a company ---
const cleanCompanyShortName = (companyName: string): string => {
  if (!companyName) return "";
  
  let clean = companyName;
  
  // 1. Remove long corporate prefixes case-insensitively
  const prefixesToRemove = [
    /^(caja de compensación de asignación familiar|caja de compensación|ccaf)\s+/gi,
    /^(compañía de|compañia de|corp\.?|corporación|corporacion)\s+/gi,
    /^(sociedad|asociación|asociacion|federación|federacion|fundación|fundacion)\s+/gi,
    /^(distribuidora|importadora|exportadora|comercializadora)\s+/gi,
    /^(servicios|consultoría|consultoria|asesorías|asesorias)\s+/gi
  ];
  
  for (const regex of prefixesToRemove) {
    clean = clean.replace(regex, "");
  }
  
  // 2. Remove common Chilean legal suffixes case-insensitively
  clean = clean.replace(/,?\s*(s\.?a\.?|spa|limitada|ltda\.?|s\.?a\.?c\.?|e\.?i\.?r\.?l\.?|chile|group|grupo|s\.a\.s\.?)\b/gi, "");
  
  // 3. Clean up extra spaces, trailing/leading commas or periods
  clean = clean.replace(/^[ ,.\t]+/, "").replace(/[,.\s]+$/, "").trim();
  
  return clean || companyName;
};

// --- Soporte de variables e inicialización ---

