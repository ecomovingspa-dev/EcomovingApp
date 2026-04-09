import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfiguracionProspeccion } from "../../components/contactos/ConfiguracionProspeccion";

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
  cuentas?: {
    cliente: string;
    segmento?: string;
    sector?: string;
  };
}



export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoConCuenta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [modalProspeccion, setModalProspeccion] = useState(false);
  // Graduación
  const [contactoAGraduar, setContactoAGraduar] = useState<ContactoConCuenta | null>(null);
  const [nombreGraduacion, setNombreGraduacion] = useState("");
  const [graduando, setGraduando] = useState(false);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;
  const [totalRecords, setTotalRecords] = useState(0);

  // Estados para opciones de filtros
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);

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
        setAvailableSectors(Array.from(new Set(qSectors.map((c: any) => c.sector).filter(Boolean))));
        setAvailableSegments(Array.from(new Set(qSectors.map((c: any) => c.segmento).filter(Boolean))));
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
        nuevaEtapa = "nutricion";
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

  // Los grupos ya están filtrados por el servidor ahora
  const gruposFiltrados = contactos;

  const abrirGraduacion = (contacto: ContactoConCuenta) => {
    setContactoAGraduar(contacto);
    setNombreGraduacion("");
  };

  const graduarContacto = async () => {
    if (!contactoAGraduar || !nombreGraduacion.trim()) return;
    setGraduando(true);
    try {
      const { error } = await supabase
        .from("contactos")
        .update({
          nombre: nombreGraduacion.trim(),
          etapa: "marketing",
          estado: "activo",
        })
        .eq("id", contactoAGraduar.id);
      if (error) throw error;
      setMensaje(`✅ ${nombreGraduacion.trim()} graduado a Marketing correctamente`);
      setContactoAGraduar(null);
      setNombreGraduacion("");
      cargarContactos(true);
      setTimeout(() => setMensaje(""), 4000);
    } catch (err: any) {
      setMensaje("❌ Error al graduar: " + err.message);
    } finally {
      setGraduando(false);
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
        <div className="flex gap-2">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro Etapa */}
          <select
            value={filtroEtapa}
            onChange={(e) => { setFiltroEtapa(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 transition-all font-medium"
          >
            <option value="">Etapa: Todas</option>
            <option value="prospeccion">🔍 Prospección</option>
            <option value="nutricion">🌱 Nutrición</option>
            <option value="marketing">📬 Marketing</option>
          </select>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            <option value="">Estado: Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>

          {/* Filtro Segmento */}
          <select
            value={filtroSegmento}
            onChange={(e) => { setFiltroSegmento(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
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
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
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
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-mono text-[10px] uppercase tracking-widest"
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
                  <th className="px-4 py-4 text-left w-[28%]">Nombre / Empresa</th>
                  <th className="px-4 py-4 text-left w-[15%]">Correo</th>
                  <th className="px-4 py-4 text-left w-[10%]">Celular</th>
                  <th className="px-4 py-4 text-left w-[10%]">Teléfono</th>
                  <th className="px-4 py-4 text-left w-[14%]">Depto</th>
                  <th className="px-4 py-4 text-left w-[7%]">Estado</th>
                  <th className="px-4 py-4 text-left w-[8%]">Etapa</th>
                  <th className="sticky right-0 px-4 py-4 text-right w-[8%] bg-gray-900 border-l border-gray-800 z-10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.5)]">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50">
                {contactos.map((contacto) => (
                  <tr
                    key={contacto.id}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group"
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
                        <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                          <Building2 className="h-2.5 w-2.5 text-blue-500" />
                          <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-tighter truncate" title={contacto.cuentas?.cliente}>
                            {contacto.cuentas?.cliente || "Sin empresa asignada"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Correo */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px]">
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
                      />
                    </td>

                    {/* Celular */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                      <input
                        type="text"
                        defaultValue={contacto.celular || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (contacto.celular || "")) {
                            actualizarCampo(contacto.id, "celular", e.target.value);
                          }
                        }}
                        className="bg-transparent border-none p-0 w-full text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none"
                        title={contacto.celular}
                      />
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                      <input
                        type="text"
                        defaultValue={contacto.telefono || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (contacto.telefono || "")) {
                            actualizarCampo(contacto.id, "telefono", e.target.value);
                          }
                        }}
                        className="bg-transparent border-none p-0 w-full text-gray-500 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 rounded outline-none"
                        title={contacto.telefono}
                      />
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

                    {/* Estado */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => {
                          const nuevoEstado = contacto.estado === "activo" ? "inactivo" : "activo";
                          actualizarCampo(contacto.id, "estado", nuevoEstado);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${contacto.estado === "activo"
                          ? "bg-green-500 dark:bg-green-600 shadow-sm shadow-green-500/50"
                          : "bg-gray-300 dark:bg-gray-700"
                          }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${contacto.estado === "activo"
                            ? "translate-x-5"
                            : "translate-x-1"
                            }`}
                        />
                      </button>
                    </td>

                    {/* Etapa */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {contacto.etapa === "prospeccion" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-wider">
                          🔍 Prosp.
                        </span>
                      ) : contacto.etapa === "nutricion" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                          🌱 Nutr.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider">
                          📬 Mktg.
                        </span>
                      )}
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
                            onClick={() => abrirGraduacion(contacto)}
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
