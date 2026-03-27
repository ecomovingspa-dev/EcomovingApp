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
  contactos: ContactoConCuenta[];
}

export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoConCuenta[]>([]);
  const [gruposClientes, setGruposClientes] = useState<GrupoCliente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [soloSinNombre, setSoloSinNombre] = useState(false);

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
  }, [paginaActual, busqueda, filtroEstado, filtroSegmento, filtroSector, hayFiltroActivo]);

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
          cuentas:cuentas!contactos_cuenta_id_fkey(cliente, segmento, sector)
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

      if (filtroSegmento) {
        query = query.filter("cuentas!contactos_cuenta_id_fkey.segmento", "eq", filtroSegmento);
      }

      if (filtroSector) {
        query = query.filter("cuentas!contactos_cuenta_id_fkey.sector", "eq", filtroSector);
      }

      if (soloSinNombre) {
        query = query.ilike("nombre", "Contacto Principal - %");
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

  const cambiarEstado = async (id: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";

    try {
      const { error } = await supabase
        .from("contactos")
        .update({ estado: nuevoEstado })
        .eq("id", id);

      if (error) throw error;

      // Actualización optimista para evitar el parpadeo (pestañazo)
      setContactos(prev =>
        prev.map(c => (c.id === id ? { ...c, estado: nuevoEstado } : c))
      );
      setGruposClientes(prev =>
        prev.map(grupo => ({
          ...grupo,
          contactos: grupo.contactos.map(c =>
            c.id === id ? { ...c, estado: nuevoEstado } : c
          ),
        }))
      );

      setMensaje(
        `✅ Contacto ${nuevoEstado === "activo" ? "activado" : "desactivado"}`,
      );
      
      // Carga silenciosa en segundo plano para sincronizar sin mover el scroll
      cargarContactos(true);
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error al cambiar estado:", error);
      setMensaje("❌ Error al cambiar el estado");
    }
  };

  // Los grupos ya están filtrados por el servidor ahora
  const gruposFiltrados = contactos;

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
              setFiltroSegmento("");
              setFiltroSector("");
              setSoloSinNombre(false);
              setPaginaActual(1);
            }}
            className="w-full border-none rounded-xl px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-mono text-[10px] uppercase tracking-widest"
          >
            Resetear
          </Button>

          {/* Filtro Provisorio: Sin Nombre */}
          <Button
            variant={soloSinNombre ? "destructive" : "outline"}
            onClick={() => { setSoloSinNombre(!soloSinNombre); setPaginaActual(1); }}
            className={`w-full border-none rounded-xl px-4 py-3 font-bold transition-all font-mono text-[10px] uppercase tracking-widest ${
              !soloSinNombre ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-400" : ""
            }`}
          >
            {soloSinNombre ? "MOSTRANDO SIN NOMBRE" : "FILTRAR SIN NOMBRE"}
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
                  <th className="px-4 py-4 text-left w-[20%]">Empresa</th>
                  <th className="px-4 py-4 text-left w-[18%]">Nombre</th>
                  <th className="px-4 py-4 text-left w-[22%]">Correo</th>
                  <th className="px-4 py-4 text-left w-[10%]">Celular</th>
                  <th className="px-4 py-4 text-left w-[10%]">Teléfono</th>
                  <th className="px-4 py-4 text-left w-[14%]">Depto</th>
                  <th className="px-4 py-4 text-left w-[8%]">Estado</th>
                  <th className="px-4 py-4 text-right w-[8%]">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50">
                {contactos.map((contacto) => (
                  <tr
                    key={contacto.id}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group"
                  >
                    {/* Empresa */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-500 opacity-50" />
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-[11px] truncate uppercase tracking-tighter" title={contacto.cuentas?.cliente}>
                          {contacto.cuentas?.cliente || "Sin empresa asignada"}
                        </span>
                      </div>
                    </td>

                    {/* Nombre */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-700 dark:text-gray-300 text-[11px] truncate uppercase tracking-tight" title={contacto.nombre}>
                        {contacto.nombre}
                      </div>
                    </td>

                    {/* Correo */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                      <div className="truncate" title={contacto.correo}>{contacto.correo || "-"}</div>
                    </td>

                    {/* Celular */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                      <div className="truncate" title={contacto.celular}>{contacto.celular || "-"}</div>
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                      <div className="truncate" title={contacto.telefono}>{contacto.telefono || "-"}</div>
                    </td>

                    {/* Departamento */}
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 uppercase font-mono italic">
                      <div className="truncate" title={contacto.departamento}>{contacto.departamento || "-"}</div>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() =>
                          cambiarEstado(
                            contacto.id,
                            contacto.estado || "inactivo",
                          )
                        }
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

                    {/* Acciones */}
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                          onClick={() =>
                            navigate(`/contactos/${contacto.id}`)
                          }
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
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
          <span>Mostrando {gruposFiltrados.length} empresa{gruposFiltrados.length !== 1 ? 's' : ''} en esta página</span>
          <span>Total: {totalRecords} contacto{totalRecords !== 1 ? 's' : ''} encontrados</span>
        </div>
      )}
    </div>
  );
}
