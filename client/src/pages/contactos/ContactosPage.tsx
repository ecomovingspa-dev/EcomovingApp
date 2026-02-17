import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Trash2,
  UserPlus,
  Users,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface ContactoConCuenta {
  id: string;
  nombre: string;
  correo?: string;
  celular?: string;
  telefono?: string;
  departamento?: string;
  estado?: string;
  cuenta_id: string;
  cuentas?: {
    cliente: string;
    segmento?: string;
    sector?: string;
  };
}

interface GrupoCliente {
  cuentaId: string;
  nombreCliente: string;
  segmento?: string;
  sector?: string;
  contactos: ContactoConCuenta[];
  expanded: boolean;
}

export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoConCuenta[]>([]);
  const [gruposClientes, setGruposClientes] = useState<GrupoCliente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCuentaId, setFiltroCuentaId] = useState("");

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;
  const [totalRecords, setTotalRecords] = useState(0);

  // Estados para opciones de filtros
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [availableCuentas, setAvailableCuentas] = useState<{ id: string, cliente: string }[]>([]);

  // Determinar si hay algún filtro activo
  const hayFiltroActivo = busqueda.trim().length >= 2 || filtroEstado !== "" || filtroCuentaId !== "" || filtroSegmento !== "" || filtroSector !== "";

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

      const { data: qCuentas } = await supabase.from("cuentas").select("id, cliente").order("cliente");
      if (qCuentas) {
        setAvailableCuentas(qCuentas);
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
      setGruposClientes([]);
      setTotalRecords(0);
      setCargando(false);
    }
  }, [paginaActual, busqueda, filtroEstado, filtroCuentaId, filtroSegmento, filtroSector, hayFiltroActivo]);

  const cargarContactos = async () => {
    try {
      setCargando(true);
      let query = supabase
        .from("contactos")
        .select(
          `
          *,
          cuentas:cuentas!contactos_cuenta_id_fkey(cliente, segmento, sector)
        `,
          { count: "exact" }
        );

      if (busqueda) {
        query = query.or(`nombre.ilike.%${busqueda}%,correo.ilike.%${busqueda}%`);
      }

      if (filtroEstado) {
        query = query.eq("estado", filtroEstado);
      }

      if (filtroCuentaId) {
        query = query.eq("cuenta_id", filtroCuentaId);
      }

      if (filtroSegmento) {
        query = query.filter("cuentas.segmento", "eq", filtroSegmento);
      }

      if (filtroSector) {
        query = query.filter("cuentas.sector", "eq", filtroSector);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina - 1);

      if (error) throw error;

      const contactosData = data || [];
      setContactos(contactosData);
      if (count !== null) setTotalRecords(count);

      // Agrupar por cliente para mantener la vista organizada
      const grupos = agruparPorCliente(contactosData);
      setGruposClientes(grupos);
    } catch (error: any) {
      console.error("Error al cargar contactos:", error);
      setMensaje("❌ Error al cargar contactos");
      setContactos([]);
      setGruposClientes([]);
    } finally {
      setCargando(false);
    }
  };

  const agruparPorCliente = (contactos: ContactoConCuenta[]): GrupoCliente[] => {
    const grupos = new Map<string, GrupoCliente>();

    contactos.forEach(contacto => {
      const cuentaId = contacto.cuenta_id || "sin-cuenta";
      const nombreCliente = contacto.cuentas?.cliente || "Sin empresa asignada";

      if (!grupos.has(cuentaId)) {
        grupos.set(cuentaId, {
          cuentaId,
          nombreCliente,
          segmento: contacto.cuentas?.segmento,
          sector: contacto.cuentas?.sector,
          contactos: [],
          expanded: true
        });
      }

      grupos.get(cuentaId)!.contactos.push(contacto);
    });

    // Ordenar por nombre de cliente
    return Array.from(grupos.values()).sort((a, b) =>
      a.nombreCliente.localeCompare(b.nombreCliente)
    );
  };

  const toggleGrupo = (cuentaId: string) => {
    setGruposClientes(prev =>
      prev.map(grupo =>
        grupo.cuentaId === cuentaId
          ? { ...grupo, expanded: !grupo.expanded }
          : grupo
      )
    );
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
      cargarContactos();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error al eliminar:", error);
      setMensaje("❌ Error al eliminar el contacto");
    }
  };

  const cambiarEstado = async (id: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";

    try {
      const { error } = await supabase
        .from("contactos")
        .update({ estado: nuevoEstado })
        .eq("id", id);

      if (error) throw error;

      setMensaje(
        `✅ Contacto ${nuevoEstado === "activo" ? "activado" : "desactivado"}`,
      );
      cargarContactos();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error al cambiar estado:", error);
      setMensaje("❌ Error al cambiar el estado");
    }
  };

  // Los grupos ya están filtrados por el servidor ahora
  const gruposFiltrados = gruposClientes;

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
            {gruposClientes.length} empresas • {contactos.length} contactos
          </p>
        </div>
        <Button
          onClick={() => navigate("/contactos/nuevo")}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Nuevo Contacto
        </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

          {/* Filtro Cuenta */}
          <select
            value={filtroCuentaId}
            onChange={(e) => { setFiltroCuentaId(e.target.value); setPaginaActual(1); }}
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            <option value="">Empresa: Todas</option>
            {availableCuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.cliente}
              </option>
            ))}
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
              setFiltroCuentaId("");
              setFiltroSegmento("");
              setFiltroSector("");
              setPaginaActual(1);
            }}
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            Resetear
          </Button>
        </div>
      </div>

      {/* Grupos por Cliente */}
      <div className="space-y-4">
        {cargando ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando contactos...</p>
          </div>
        ) : !hayFiltroActivo ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-20 text-center border border-gray-100 dark:border-gray-700">
            <Search className="h-16 w-16 text-gray-200 dark:text-gray-700 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inicia una búsqueda</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Escribe al menos 2 caracteres o selecciona un filtro para visualizar los contactos.
            </p>
          </div>
        ) : gruposFiltrados.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-20 text-center border border-gray-100 dark:border-gray-700">
            <Search className="h-16 w-16 text-gray-200 dark:text-gray-700 mx-auto mb-6" />
            <p className="text-gray-600 dark:text-gray-400 font-bold mb-2">
              No se encontraron resultados
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm">
              No hay contactos que coincidan con los filtros aplicados
            </p>
          </div>
        ) : (
          gruposFiltrados.map((grupo) => (
            <div
              key={grupo.cuentaId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              {/* Header del Grupo (Cliente) */}
              <button
                onClick={() => toggleGrupo(grupo.cuentaId)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {grupo.nombreCliente}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {grupo.contactos.length} contacto{grupo.contactos.length !== 1 ? 's' : ''}
                      </span>
                      {grupo.segmento && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                          {grupo.segmento}
                        </span>
                      )}
                      {grupo.sector && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs">
                          {grupo.sector}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {grupo.expanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Tabla de Contactos del Grupo */}
              {grupo.expanded && (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[18%]">
                          Nombre
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[22%]">
                          Correo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[12%]">
                          Celular
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[12%]">
                          Teléfono
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[14%]">
                          Departamento
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[12%]">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {grupo.contactos.map((contacto) => (
                        <tr
                          key={contacto.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate" title={contacto.nombre}>
                                {contacto.nombre}
                              </div>
                              {contacto.departamento?.toLowerCase().includes("gerencia") && (
                                <span className="text-[10px] w-fit font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded uppercase">
                                  👑 Nivel Ejecutivo
                                </span>
                              )}
                              {contacto.departamento?.toLowerCase().includes("directivo") && (
                                <span className="text-[10px] w-fit font-bold px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded uppercase">
                                  🏛️ Nivel Directivo
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            <div className="truncate" title={contacto.correo}>{contacto.correo || "-"}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            <div className="truncate" title={contacto.celular}>{contacto.celular || "-"}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            <div className="truncate" title={contacto.telefono}>{contacto.telefono || "-"}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            <div className="truncate" title={contacto.departamento}>{contacto.departamento || "-"}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() =>
                                cambiarEstado(
                                  contacto.id,
                                  contacto.estado || "inactivo",
                                )
                              }
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${contacto.estado === "activo"
                                ? "bg-green-500 dark:bg-green-600"
                                : "bg-gray-300 dark:bg-gray-600"
                                }`}
                              title={
                                contacto.estado === "activo"
                                  ? "Desactivar contacto"
                                  : "Activar contacto"
                              }
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${contacto.estado === "activo"
                                  ? "translate-x-6"
                                  : "translate-x-1"
                                  }`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                                onClick={() =>
                                  navigate(`/contactos/${contacto.id}`)
                                }
                                title="Editar contacto"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                onClick={() => eliminarContacto(contacto.id)}
                                title="Eliminar contacto"
                              >
                                <Trash2 className="h-4 w-4" />
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
          ))
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
          <span>Mostrando {gruposFiltrados.length} empresa{gruposFiltrados.length !== 1 ? 's' : ''} en esta página</span>
          <span>Total: {totalRecords} contacto{totalRecords !== 1 ? 's' : ''} encontrados</span>
        </div>
      )}
    </div>
  );
}
