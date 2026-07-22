import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { ConfiguracionProspeccion } from "../../components/contactos/ConfiguracionProspeccion";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEGMENTOS_POR_DEFECTO = [
  "Servicios",
  "Educación",
  "Comercializadores",
  "Alimentos / Agrícola",
  "Corporación",
  "Salud",
  "Gran Empresa",
  "Municipalidad",
  "Servicios Públicos",
  "Gobierno Central",
  "Laboratorios",
  "Comercial/Industrial - Shell Chile",
  "Pequeña Empresa",
  "Caja de Compensación"
];

import {
  Trash2,
  UserPlus,
  Users,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
  SearchCheck,
  GraduationCap,
  Play,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ContactoConCuenta {
  id: string;
  nombre: string;
  correo?: string;
  celular?: string;
  telefono?: string;
  departamento?: string;
  estado?: string;
  etapa?: string;
  cuenta_id: string;
  origen?: string;
  cuentas?: {
    cliente: string;
    segmento?: string;
    sector?: string;
  };
  indice_secuencia?: number | null;
  etapa_envio?: number | null;
}



export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoConCuenta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [enriqueciendoId, setEnriqueciendoId] = useState<string | null>(null);
  const [loadingEnriquecimiento, setLoadingEnriquecimiento] = useState(false);

  const enriquecerContactoConIA = async (cuentaId: string, contactoId: string) => {
    if (!cuentaId) return;
    setEnriqueciendoId(cuentaId);
    setMensaje("Buscando correo con IA...");
    try {
      const response = await fetch("/api/enrich-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cuentaId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al enriquecer con IA");
      }
      
      setMensaje("✓ Enriquecimiento completo");
      setTimeout(() => setMensaje(""), 3000);
      await cargarContactos();
    } catch (err: any) {
      console.error("Error al enriquecer contacto:", err);
      setMensaje("Error al enriquecer: " + (err.message || "Error desconocido"));
      setTimeout(() => setMensaje(""), 5000);
    } finally {
      setEnriqueciendoId(null);
    }
  };

  const enriquecerFaltantes = async () => {
    const faltantes = contactos.filter(c => (!c.correo || c.correo.trim() === "") && c.cuenta_id);
    if (faltantes.length === 0) {
      alert("No hay contactos faltantes de correo en la vista actual para enriquecer.");
      return;
    }

    if (!confirm(`Se procesarán ${faltantes.length} empresas con la IA para buscar sus correos de contacto. ¿Deseas continuar?`)) {
      return;
    }

    setLoadingEnriquecimiento(true);
    let exitos = 0;
    
    try {
      for (let i = 0; i < faltantes.length; i++) {
        const c = faltantes[i];
        setMensaje(`Enriqueciendo ${i + 1} de ${faltantes.length}: ${c.cuentas?.cliente || 'Empresa'}...`);
        try {
          const response = await fetch("/api/enrich-accounts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cuentaId: c.cuenta_id }),
          });
          const data = await response.json();
          if (response.ok && data.success) {
            exitos++;
          }
        } catch (err) {
          console.error(`Error enriqueciendo cuenta ${c.cuenta_id}:`, err);
        }
      }
      setMensaje(`✓ Proceso completado. Se enriquecieron ${exitos} empresas.`);
      setTimeout(() => setMensaje(""), 4000);
      await cargarContactos();
    } catch (e: any) {
      console.error("Error en enriquecerFaltantes:", e);
      setMensaje("Error en proceso: " + e.message);
      setTimeout(() => setMensaje(""), 5000);
    } finally {
      setLoadingEnriquecimiento(false);
    }
  };
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [modalProspeccion, setModalProspeccion] = useState(false);
  // Graduación
  const [contactoAGraduar, setContactoAGraduar] = useState<ContactoConCuenta | null>(null);
  const [nombreGraduacion, setNombreGraduacion] = useState("");
  const [graduando, setGraduando] = useState(false);

  // Desactivación/Degradación
  const [showDesactivarModal, setShowDesactivarModal] = useState(false);
  const [contactoADesactivar, setContactoADesactivar] = useState<ContactoConCuenta | null>(null);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;
  const [totalRecords, setTotalRecords] = useState(0);

  // Estados para opciones de filtros
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<string[]>(SEGMENTOS_POR_DEFECTO);
  const [totalEtapasProspeccion, setTotalEtapasProspeccion] = useState<number>(3);

  // Estados para edición de cuenta
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [popoverAbierto, setPopoverAbierto] = useState<string | null>(null);
  const [busquedaCuentas, setBusquedaCuentas] = useState("");

  const cuentasFiltradas = useMemo(() => {
    if (!busquedaCuentas.trim()) return cuentas;
    return cuentas.filter((c) =>
      c.cliente?.toLowerCase().includes(busquedaCuentas.toLowerCase()) ||
      c.rut?.toLowerCase().includes(busquedaCuentas.toLowerCase())
    );
  }, [cuentas, busquedaCuentas]);

  // Determinar si hay algún filtro activo
  // No restriction on loading, server-side pagination handles performance
  const hayFiltroActivo = true;

  const navigate = useNavigate();

  useEffect(() => {
    cargarOpcionesFiltros();
  }, []);

  const cargarOpcionesFiltros = async () => {
    try {
      const { data: qSectors } = await supabase.from("cuentas").select("sector, segmento");
      if (qSectors) {
        const sectorSet = new Set<string>();
        qSectors.forEach((c: any) => {
          if (c.sector && typeof c.sector === 'string') {
            const trimmed = c.sector.trim();
            if (trimmed) {
              const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
              sectorSet.add(normalized);
            }
          }
        });
        setAvailableSectors(Array.from(sectorSet).sort());
        const dbSegments = qSectors.map((c: any) => c.segmento).filter(Boolean);
        setAvailableSegments(Array.from(new Set([...SEGMENTOS_POR_DEFECTO, ...dbSegments])));
      }
      
      const { data: qCuentas, error: errorCuentas } = await supabase
        .from("cuentas")
        .select("id, cliente, rut, estado, segmento, sector, contactos:contactos!contactos_cuenta_id_fkey(id)")
        .order("cliente");
      if (!errorCuentas && qCuentas) {
        setCuentas(qCuentas);
      }

      // Obtener el número total de etapas activas en la secuencia de prospección
      const { count } = await supabase
        .from("configuracion_prospeccion")
        .select("*", { count: "exact", head: true })
        .eq("activo", true);
      if (count !== null) {
        setTotalEtapasProspeccion(count);
      }
    } catch (e) {
      console.error("Error cargando opciones de filtros:", e);
    }
  };

  useEffect(() => {
    if (hayFiltroActivo) {
      cargarContactos();
    } else {
      setContactos([]);
      setTotalRecords(0);
      setCargando(false);
    }
  }, [paginaActual, busqueda, filtroEstado, filtroEtapa, filtroSegmento, filtroSector, hayFiltroActivo]);

  const cargarContactos = async (silent = false) => {
    try {
      if (!silent) setCargando(true);
      
      // Intentamos buscar IDs de empresas si hay un término de búsqueda para ampliar resultados
      let idsDeCuentas: string[] = [];
      if (busqueda && busqueda.length >= 2) {
        const { data: cuentasCoincidentes } = await supabase
          .from("cuentas")
          .select("id")
          .ilike("cliente", `%${busqueda}%`);
        
        if (cuentasCoincidentes) {
          idsDeCuentas = cuentasCoincidentes.map(c => c.id);
        }
      }

      let query = supabase
        .from("contactos")
        .select(
          `
          *,
          vendedores(nombre),
          cuentas:cuentas!contactos_cuenta_id_fkey${(filtroSegmento || filtroSector) ? "!inner" : ""}(cliente, segmento, sector)
        `,
          { count: "exact" }
        );

      if (busqueda) {
        // Combinamos búsqueda de nombre, correo y los IDs de empresas encontradas
        const orConditions = [
          `nombre.ilike.%${busqueda}%`,
          `correo.ilike.%${busqueda}%`
        ];
        
        if (idsDeCuentas.length > 0) {
          // Limitamos a 50 IDs para evitar errores en el parseo del filtro OR
          const limitedIds = idsDeCuentas.slice(0, 50);
          orConditions.push(`cuenta_id.in.(${limitedIds.join(',')})`);
        }
        
        query = query.or(orConditions.join(','));
      }

      if (filtroEstado) {
        query = query.eq("estado", filtroEstado);
      }

      if (filtroEtapa) {
        query = query.eq("etapa", filtroEtapa);
      }

      if (filtroSegmento) {
        query = query.eq("cuentas.segmento", filtroSegmento);
      }

      if (filtroSector) {
        query = query.eq("cuentas.sector", filtroSector);
      }


      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina - 1);

      if (error) throw error;

      const contactosData = data || [];
      setContactos(contactosData);
      if (count !== null) setTotalRecords(count);
    } catch (error: any) {
      console.error("Error al cargar contactos:", error);
      setMensaje("❌ Error al cargar contactos");
    } finally {
      setCargando(false);
    }
  };

  const toggleGrupo = (cuentaId: string) => {
    // Ya no es necesario el toggle en la vista tipo Excel
  };

  const eliminarContacto = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este contacto?")) return;

    try {
      const { error } = await supabase.from("contactos").delete().eq("id", id);
      if (error) throw error;

      // Verificar si la cuenta se quedó sin contactos
      const contactoEliminado = contactos.find(c => c.id === id);
      if (contactoEliminado?.cuenta_id) {
        const { count, error: countError } = await supabase
          .from("contactos")
          .select("*", { count: 'exact', head: true })
          .eq("cuenta_id", contactoEliminado.cuenta_id);

        if (!countError && count === 0) {
          await supabase
            .from("cuentas")
            .update({ estado: "prospecto" })
            .eq("id", contactoEliminado.cuenta_id);
        }
      }

      setMensaje("✅ Contacto eliminado correctamente");
      cargarContactos(true);
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error al eliminar:", error);
      setMensaje("❌ Error al eliminar el contacto");
    }
  };

  const actualizarCampo = async (id: string, campo: string, valor: string) => {
    try {
      // Obtener el contacto actual para calcular la nueva etapa
      const contactoActual = contactos.find(c => c.id === id);
      if (!contactoActual) return;

      const nombre = (campo === "nombre" ? valor : (contactoActual.nombre || "")).trim();
      const correo = (campo === "correo" ? valor : (contactoActual.correo || "")).trim();

      let nuevaEtapa = contactoActual.etapa;
      
      if (!nombre && !correo) {
        nuevaEtapa = "prospeccion";
      } else if (!nombre && correo) {
        nuevaEtapa = "prospeccion"; // Contactos con correo pero sin nombre van a Prospección
      } else if (nombre && correo) {
        nuevaEtapa = "marketing";
      }

      const updates: any = { [campo]: valor };
      if (nuevaEtapa !== contactoActual.etapa) {
        updates.etapa = nuevaEtapa;
      }

      const { error } = await supabase
        .from("contactos")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      // Actualización optimista
      setContactos(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updates } : c))
      );
      
      setMensaje(`✅ Registro actualizado`);
      setTimeout(() => setMensaje(""), 2000);
    } catch (error: any) {
      console.error("Error al actualizar campo:", error);
      setMensaje("❌ Error al guardar cambios");
    }
  };

  const actualizarSegmentoCuenta = async (cuentaId: string, nuevoSegmento: string) => {
    if (!cuentaId) return;
    try {
      const { error } = await supabase
        .from("cuentas")
        .update({ segmento: nuevoSegmento })
        .eq("id", cuentaId);

      if (error) throw error;

      // Actualización optimista
      setContactos(prev =>
        prev.map(c => (c.cuenta_id === cuentaId ? { ...c, cuentas: { ...c.cuentas!, segmento: nuevoSegmento } } : c))
      );
      
      setMensaje(`✅ Segmento actualizado`);
      setTimeout(() => setMensaje(""), 2000);
    } catch (error: any) {
      console.error("Error al actualizar segmento:", error);
      setMensaje("❌ Error al guardar cambios");
    }
  };

  const actualizarSectorCuenta = async (cuentaId: string, nuevoSector: string) => {
    if (!cuentaId) return;
    try {
      const { error } = await supabase
        .from("cuentas")
        .update({ sector: nuevoSector })
        .eq("id", cuentaId);

      if (error) throw error;

      // Actualización optimista
      setContactos(prev =>
        prev.map(c => (c.cuenta_id === cuentaId ? { ...c, cuentas: { ...c.cuentas!, sector: nuevoSector } } : c))
      );
      
      setMensaje(`✅ Sector actualizado`);
      setTimeout(() => setMensaje(""), 2000);
    } catch (error: any) {
      console.error("Error al actualizar sector:", error);
      setMensaje("❌ Error al guardar cambios");
    }
  };

  const actualizarCuentaContacto = async (contactoId: string, nuevaCuentaId: string) => {
    if (!contactoId || !nuevaCuentaId) return;
    
    const contactoActual = contactos.find(c => c.id === contactoId);
    if (!contactoActual) return;
    
    const antiguaCuentaId = contactoActual.cuenta_id;
    if (antiguaCuentaId === nuevaCuentaId) return;

    try {
      const { error } = await supabase
        .from("contactos")
        .update({ cuenta_id: nuevaCuentaId })
        .eq("id", contactoId);

      if (error) throw error;

      // Regla: Si tiene contactos -> Activo
      await supabase
        .from("cuentas")
        .update({ estado: "activo" })
        .eq("id", nuevaCuentaId);

      // Verificar si la antigua cuenta se quedó sin contactos
      if (antiguaCuentaId) {
        const { count, error: countError } = await supabase
          .from("contactos")
          .select("*", { count: 'exact', head: true })
          .eq("cuenta_id", antiguaCuentaId);

        if (!countError && count === 0) {
          await supabase
            .from("cuentas")
            .update({ estado: "prospecto" })
            .eq("id", antiguaCuentaId);
        }
      }

      // Actualización optimista
      const nuevaCuenta = cuentas.find(c => c.id === nuevaCuentaId);
      const clienteNombre = nuevaCuenta ? nuevaCuenta.cliente : "";
      const segmento = nuevaCuenta ? nuevaCuenta.segmento : undefined;
      const sector = nuevaCuenta ? nuevaCuenta.sector : undefined;

      setContactos(prev =>
        prev.map(c => (c.id === contactoId ? { 
          ...c, 
          cuenta_id: nuevaCuentaId, 
          cuentas: { 
            ...c.cuentas, 
            cliente: clienteNombre,
            segmento: segmento !== undefined ? segmento : c.cuentas?.segmento,
            sector: sector !== undefined ? sector : c.cuentas?.sector
          } 
        } : c))
      );

      setMensaje(`✅ Cuenta de contacto actualizada`);
      setTimeout(() => setMensaje(""), 2000);
    } catch (error: any) {
      console.error("Error al actualizar cuenta del contacto:", error);
      setMensaje("❌ Error al guardar cambios");
    }
  };

  // Los grupos ya están filtrados por el servidor ahora
  const gruposFiltrados = contactos;

  const graduarContactoDirecto = async (contacto: ContactoConCuenta, nombreEspecifico?: string) => {
    try {
      // Verificar si hay una etapa de marketing congelada en `indice_secuencia`
      const stageCongelada = contacto.indice_secuencia && contacto.indice_secuencia > 0
        ? contacto.indice_secuencia
        : 1;

      const updates: any = {
        etapa: "marketing",
        estado: "activo",
        etapa_envio: stageCongelada, // Restaurar etapa de marketing congelada
        indice_secuencia: -1 // Marcar que ya pasó por prospección
      };

      if (nombreEspecifico && nombreEspecifico.trim()) {
        updates.nombre = nombreEspecifico.trim();
      }

      const { error } = await supabase
        .from("contactos")
        .update(updates)
        .eq("id", contacto.id);
      if (error) throw error;
      
      const nombreMostrar = nombreEspecifico?.trim() || contacto.nombre || "Contacto";
      setMensaje(`✅ ${nombreMostrar} graduado a Marketing correctamente (Etapa de envío: ${stageCongelada})`);
      cargarContactos(true);
      setTimeout(() => setMensaje(""), 4000);
    } catch (err: any) {
      console.error("Error al graduar:", err);
      setMensaje("❌ Error al graduar: " + err.message);
    }
  };

  const iniciarGraduacion = (contacto: ContactoConCuenta) => {
    if (contacto.nombre && contacto.nombre.trim()) {
      // Si ya tiene nombre, se gradúa directamente sin abrir el formulario/modal
      graduarContactoDirecto(contacto);
    } else {
      // Si no tiene nombre, se abre el modal para que lo ingrese
      setContactoAGraduar(contacto);
      setNombreGraduacion("");
    }
  };

  const graduarContacto = async () => {
    if (!contactoAGraduar || !nombreGraduacion.trim()) return;
    setGraduando(true);
    await graduarContactoDirecto(contactoAGraduar, nombreGraduacion);
    setContactoAGraduar(null);
    setNombreGraduacion("");
    setGraduando(false);
  };

  const desactivarCampañaDirecto = async (contacto: ContactoConCuenta) => {
    try {
      const { error } = await supabase
        .from("contactos")
        .update({
          estado: "inactivo",
          proximo_envio: null
        })
        .eq("id", contacto.id);
      if (error) throw error;
      setMensaje(`✅ Campaña de marketing desactivada para ${contacto.nombre || "contacto"}`);
      cargarContactos(true);
      setTimeout(() => setMensaje(""), 4000);
    } catch (err: any) {
      console.error("Error al desactivar campaña:", err);
      setMensaje("❌ Error al desactivar campaña: " + err.message);
    }
  };
  const totalPaginas = Math.ceil(totalRecords / filasPorPagina);
  const totalContactosFiltrados = totalRecords;

  return (
    <div className="space-y-6 dark:bg-gray-900 min-h-screen max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Contactos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalRecords} contactos registrados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {contactos.some(c => !c.correo || c.correo.trim() === "") && (
            <Button
              onClick={enriquecerFaltantes}
              disabled={loadingEnriquecimiento}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md font-semibold"
            >
              {loadingEnriquecimiento ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {loadingEnriquecimiento ? "Buscando..." : "Buscar Correos Faltantes (IA)"}
            </Button>
          )}
          <Button
            onClick={() => setModalProspeccion(true)}
            className="bg-violet-700 hover:bg-violet-800 text-white shadow-md"
          >
            <SearchCheck className="mr-2 h-4 w-4" /> Prospección
          </Button>
          <Button
            onClick={() => navigate("/contactos/nuevo")}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Nuevo Contacto
          </Button>
        </div>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div
          className={`p-4 rounded-lg font-medium border ${mensaje.includes("❌")
            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
            : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
            }`}
        >
          {mensaje}
        </div>
      )}

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-6">
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o correo (min. 2 caracteres)..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
            className="w-full border-none rounded-xl px-12 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Filtro Etapa */}
          <select
            value={filtroEtapa}
            onChange={(e) => { setFiltroEtapa(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 transition-all text-xs font-semibold"
          >
            <option value="">Etapa: Todas</option>
            <option value="prospeccion">🔍 Prospeccion</option>
            <option value="marketing">📬 Marketing</option>
          </select>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-xs font-semibold"
          >
            <option value="">Estado: Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>

          {/* Filtro Segmento */}
          <select
            value={filtroSegmento}
            onChange={(e) => { setFiltroSegmento(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-xs font-semibold"
          >
            <option value="">Segmento: Todos</option>
            {availableSegments.map((segmento) => (
              <option key={segmento} value={segmento}>
                {segmento}
              </option>
            ))}
          </select>

          {/* Filtro Sector */}
          <select
            value={filtroSector}
            onChange={(e) => { setFiltroSector(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-xs font-semibold"
          >
            <option value="">Sector: Todos</option>
            {availableSectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          {/* Botón Resetear */}
          <Button
            variant="outline"
            onClick={() => {
              setBusqueda("");
              setFiltroEstado("");
              setFiltroEtapa("");
              setFiltroSegmento("");
              setFiltroSector("");
              setPaginaActual(1);
            }}
            className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-xs uppercase cursor-pointer"
          >
            Resetear
          </Button>
        </div>
      </div>

      {/* Tabla Plana Estilo Excel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {cargando ? (
          <div className="p-20 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-gray-500 font-medium">Sincronizando registros...</p>
          </div>
        ) : contactos.length === 0 ? (
          <div className="p-20 text-center">
            <Search className="h-16 w-16 text-gray-200 dark:text-gray-700 mx-auto mb-6" />
            <p className="text-gray-600 dark:text-gray-400 font-bold mb-2">
              No se encontraron resultados
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm">
              Intenta ajustar los filtros o la búsqueda para encontrar lo que buscas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-4 text-left w-[18%]">Nombre / Empresa</th>
                  <th className="px-4 py-4 text-left w-[14%]">Correo</th>
                  <th className="px-4 py-4 text-left w-[11%]">Cel/Tel</th>
                  <th className="px-4 py-4 text-left w-[11%]">Depto</th>
                  <th className="px-4 py-4 text-left w-[7%]">Campaña</th>
                  <th className="px-4 py-4 text-left w-[9%]">Etapa</th>
                  <th className="px-4 py-4 text-left w-[11%]">Segmento</th>
                  <th className="px-4 py-4 text-left w-[11%]">Sector</th>
                  <th className="sticky right-0 px-4 py-4 text-right w-[8%] bg-gray-900 border-l border-gray-800 z-10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.5)]">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50">
                {contactos.map((contacto) => (
                  <tr
                    key={contacto.id}
                    className={`transition-colors group ${
                      contacto.origen === 'AI' && contacto.etapa === 'prospeccion'
                        ? "bg-cyan-100/80 dark:bg-cyan-950/50 hover:bg-cyan-200/60 dark:hover:bg-cyan-900/50"
                        : "hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                    }`}
                  >
                    {/* Nombre / Empresa */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <input
                          type="text"
                          defaultValue={contacto.nombre || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (contacto.nombre || "")) {
                              actualizarCampo(contacto.id, "nombre", e.target.value);
                            }
                          }}
                          className="bg-transparent border-none p-0 w-full font-bold text-gray-900 dark:text-gray-100 text-[11px] uppercase tracking-tight focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          title={contacto.nombre}
                        />
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                          <Popover 
                            open={popoverAbierto === contacto.id} 
                            onOpenChange={(open) => {
                              if (open) {
                                setPopoverAbierto(contacto.id);
                              } else {
                                setPopoverAbierto(null);
                                setBusquedaCuentas("");
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline outline-none text-left max-w-[140px] cursor-pointer"
                                title={contacto.cuentas?.cliente || "Sin empresa asignada"}
                              >
                                {contacto.cuentas?.cliente || "Sin empresa asignada"}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-50" align="start">
                              <div className="flex flex-col h-[250px]">
                                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                                  <input
                                    type="text"
                                    placeholder="Buscar empresa..."
                                    className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none text-gray-900 dark:text-white"
                                    value={busquedaCuentas}
                                    onChange={(e) => setBusquedaCuentas(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                                  {cuentasFiltradas.length === 0 ? (
                                    <div className="py-4 text-center text-xs text-gray-500">
                                      No se encontraron cuentas.
                                    </div>
                                  ) : (
                                    cuentasFiltradas.map((cuenta) => (
                                      <button
                                        key={cuenta.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          actualizarCuentaContacto(contacto.id, cuenta.id);
                                          setPopoverAbierto(null);
                                          setBusquedaCuentas("");
                                        }}
                                        className={cn(
                                          "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded transition-colors text-left font-sans cursor-pointer",
                                          contacto.cuenta_id === cuenta.id
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                        )}
                                      >
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="truncate pr-2 font-bold">{cuenta.cliente}</span>
                                          <span className="text-[9px] text-gray-400 dark:text-gray-500">
                                            {cuenta.contactos && cuenta.contactos.length > 0
                                              ? `👤 ${cuenta.contactos.length} contacto${cuenta.contactos.length > 1 ? 's' : ''}`
                                              : '⚠️ Sin contactos'}
                                          </span>
                                        </div>
                                        {contacto.cuenta_id === cuenta.id && (
                                          <Check className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400 ml-2" />
                                        )}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          {contacto.origen === 'AI' && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-cyan-200 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 text-[8px] font-black uppercase tracking-widest leading-none">
                              IA
                            </span>
                          )}
                          {contacto.etapa !== "prospeccion" && (contacto.indice_secuencia === -1 || (contacto.indice_secuencia !== null && contacto.indice_secuencia !== undefined && contacto.indice_secuencia > 0)) ? (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 text-[8px] font-black uppercase tracking-wider leading-none flex items-center gap-0.5" title="Este contacto ya recibió la campaña de Prospección">
                              ✓ Prosp. Ok
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1">
                          👤 {contacto.vendedores?.nombre || "Sin Asignar (IA)"}
                        </span>
                      </div>
                    </td>

                    {/* Correo */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                      <div className="flex items-center gap-1">
                        <input
                          type="email"
                          defaultValue={contacto.correo || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (contacto.correo || "")) {
                              actualizarCampo(contacto.id, "correo", e.target.value);
                            }
                          }}
                          className="bg-transparent border-none p-0 w-full text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          title={contacto.correo}
                          placeholder="Sin correo"
                        />
                        {(!contacto.correo || contacto.correo.trim() === "") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 shrink-0"
                            onClick={() => enriquecerContactoConIA(contacto.cuenta_id, contacto.id)}
                            disabled={enriqueciendoId === contacto.cuenta_id}
                            title="Buscar correo con IA (Google Search)"
                          >
                            {enriqueciendoId === contacto.cuenta_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>

                    {/* Celular / Teléfono */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="Celular"
                          defaultValue={contacto.celular || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (contacto.celular || "")) {
                              actualizarCampo(contacto.id, "celular", e.target.value);
                            }
                          }}
                          className="bg-transparent border-none p-0 w-full text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                          title={contacto.celular}
                        />
                        <input
                          type="text"
                          placeholder="Teléfono"
                          defaultValue={contacto.telefono || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (contacto.telefono || "")) {
                              actualizarCampo(contacto.id, "telefono", e.target.value);
                            }
                          }}
                          className="bg-transparent border-none p-0 w-full text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                          title={contacto.telefono}
                        />
                      </div>
                    </td>

                    {/* Departamento */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] uppercase font-mono italic">
                      <input
                        type="text"
                        defaultValue={contacto.departamento || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (contacto.departamento || "")) {
                            actualizarCampo(contacto.id, "departamento", e.target.value);
                          }
                        }}
                        className="bg-transparent border-none p-0 w-full text-gray-400 dark:text-gray-500 focus:ring-1 focus:ring-blue-500 rounded outline-none"
                        title={contacto.departamento}
                      />
                    </td>

                    {/* Campaña: Activo = Marketing/Nutrición, Desactivado = Prospección */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (contacto.etapa === "prospeccion" || contacto.estado === "inactivo") {
                              iniciarGraduacion(contacto);
                            } else {
                              desactivarCampañaDirecto(contacto);
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${(contacto.etapa === "marketing" && contacto.estado === "activo")
                            ? "bg-green-500 dark:bg-green-600 shadow-sm shadow-green-500/50"
                            : "bg-gray-300 dark:bg-gray-700"
                            }`}
                          title={(contacto.etapa === "marketing" && contacto.estado === "activo") ? "Campaña: Activo (Marketing)" : "Campaña: Desactivado / Pausado"}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${(contacto.etapa === "marketing" && contacto.estado === "activo")
                              ? "translate-x-5"
                              : "translate-x-1"
                              }`}
                          />
                        </button>
                        {contacto.etapa !== "prospeccion" && (contacto.indice_secuencia === -1 || (contacto.indice_secuencia !== null && contacto.indice_secuencia !== undefined && contacto.indice_secuencia > 0)) ? (
                          <span 
                            className="text-amber-500 dark:text-amber-400 shrink-0 cursor-help" 
                            title="Atención: Este contacto ya pasó por la campaña de Prospección anteriormente. Si lo desactivas, se volverá a iniciar la secuencia fría por segunda vez."
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Etapa */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {contacto.etapa === "prospeccion" ? (
                        (() => {
                          const paso = parseInt((contacto as any).etapa_envio) || 1;
                          const esFinalizada = paso > totalEtapasProspeccion;
                          return esFinalizada ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider"
                              title={`La campaña de Prospección ha finalizado (Se enviaron las ${totalEtapasProspeccion} etapas)`}
                            >
                              ✓ Prosp. Fin
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-wider"
                              title={`En secuencia de Prospección (Paso ${paso} de ${totalEtapasProspeccion})`}
                            >
                              🔍 Prosp. ({paso}/{totalEtapasProspeccion})
                            </span>
                          );
                        })()
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider">
                          📬 Mktg.
                        </span>
                      )}
                    </td>

                    {/* Segmento */}
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] uppercase font-bold tracking-tight text-gray-600 dark:text-gray-400">
                      <select
                        value={contacto.cuentas?.segmento || ""}
                        onChange={(e) => actualizarSegmentoCuenta(contacto.cuenta_id, e.target.value)}
                        className="bg-transparent border-none p-0 w-full text-gray-600 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none uppercase font-bold tracking-tight cursor-pointer"
                      >
                        <option value="">-</option>
                        {availableSegments.map((seg) => (
                          <option key={seg} value={seg}>{seg}</option>
                        ))}
                      </select>
                    </td>

                    {/* Sector */}
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] uppercase font-bold tracking-tight text-gray-600 dark:text-gray-400">
                      <select
                        value={contacto.cuentas?.sector || ""}
                        onChange={(e) => actualizarSectorCuenta(contacto.cuenta_id, e.target.value)}
                        className="bg-transparent border-none p-0 w-full text-gray-600 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none uppercase font-bold tracking-tight cursor-pointer"
                      >
                        <option value="">-</option>
                        {availableSectors.map((sec) => (
                          <option key={sec} value={sec}>{sec}</option>
                        ))}
                      </select>
                    </td>

                    {/* Acciones */}
                    <td className="sticky right-0 px-4 py-3 whitespace-nowrap text-right text-sm bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700/50 z-10 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-[#1a2235] shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {contacto.etapa === "prospeccion" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                            title="Graduar a Marketing"
                            onClick={() => iniciarGraduacion(contacto)}
                          >
                            <GraduationCap className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          onClick={() => eliminarContacto(contacto.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {!cargando && totalPaginas > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 px-6 py-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Página <span className="text-gray-900 dark:text-white">{paginaActual}</span> de <span className="text-gray-900 dark:text-white">{totalPaginas}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
              disabled={paginaActual === 1}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold disabled:opacity-50 transition-all text-sm"
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
              disabled={paginaActual === totalPaginas}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold disabled:opacity-50 transition-all text-sm"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Info de resultados */}
      {!cargando && gruposFiltrados.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex justify-between font-mono">
          <span>Mostrando {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} en esta página</span>
          <span>Total: {totalRecords} contacto{totalRecords !== 1 ? 's' : ''} encontrados</span>
        </div>
      )}
      <ConfiguracionProspeccion
        open={modalProspeccion}
        onOpenChange={setModalProspeccion}
      />

      {/* Modal de Graduación */}
      {contactoAGraduar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-violet-50 dark:bg-violet-900/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Graduar a Marketing</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {contactoAGraduar.cuentas?.cliente || "Empresa"} · {contactoAGraduar.correo}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ingresa el nombre del contacto para aprobarlo y moverlo al pipeline de Marketing.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nombre del Contacto</label>
                <input
                  type="text"
                  autoFocus
                  value={nombreGraduacion}
                  onChange={(e) => setNombreGraduacion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && graduarContacto()}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none text-sm font-medium transition-all"
                />
              </div>
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 text-[11px] text-violet-600 dark:text-violet-400">
                ⚡ Al confirmar: <strong>estado → activo</strong> · <strong>etapa → marketing</strong>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setContactoAGraduar(null)}
                className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </Button>
              <Button
                disabled={!nombreGraduacion.trim() || graduando}
                onClick={graduarContacto}
                className="bg-violet-700 hover:bg-violet-800 text-white disabled:opacity-50"
              >
                {graduando ? (
                  <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Graduando...</>
                ) : (
                  <><GraduationCap className="h-4 w-4 mr-2" />Confirmar Graduación</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
