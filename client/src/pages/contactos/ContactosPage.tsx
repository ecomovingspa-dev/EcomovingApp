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
  ChevronLeft,
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

export default function ContactosPage() {
  const [contactos, setContactos] = useState<ContactoConCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  const navigate = useNavigate();

  useEffect(() => {
    cargarContactos();
  }, []);

  const cargarContactos = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from("contactos")
        .select(
          `
          *,
          cuentas:cuentas!contactos_cuenta_id_fkey(cliente, segmento, sector)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContactos(data || []);
    } catch (error: any) {
      console.error("Error al cargar contactos:", error);
      setMensaje("❌ Error al cargar contactos");
      setContactos([]);
    } finally {
      setCargando(false);
    }
  };

  const eliminarContacto = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este contacto?")) return;

    try {
      const { error } = await supabase.from("contactos").delete().eq("id", id);
      if (error) throw error;

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

  // Filtrar contactos
  const contactosFiltrados = useMemo(() => {
    const termino = busqueda.toLowerCase().trim();

    return contactos.filter((contacto) => {
      // Filtro de búsqueda
      const cumpleBusqueda =
        !termino ||
        contacto.nombre.toLowerCase().includes(termino) ||
        (contacto.cuentas?.cliente || "").toLowerCase().includes(termino) ||
        (contacto.correo || "").toLowerCase().includes(termino);

      // Filtro de segmento
      const cumpleSegmento =
        !filtroSegmento || contacto.cuentas?.segmento === filtroSegmento;

      // Filtro de sector
      const cumpleSector =
        !filtroSector || contacto.cuentas?.sector === filtroSector;

      return cumpleBusqueda && cumpleSegmento && cumpleSector;
    });
  }, [contactos, busqueda, filtroSegmento, filtroSector]);

  // Paginar contactos
  const totalPaginas = Math.ceil(contactosFiltrados.length / itemsPorPagina);
  const contactosPaginados = contactosFiltrados.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina,
  );

  // Resetear página al buscar o filtrar
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroSegmento, filtroSector]);

  // Obtener opciones únicas de segmentos y sectores
  const segmentosUnicos = useMemo(() => {
    const segmentos = contactos
      .map((c) => c.cuentas?.segmento)
      .filter((s): s is string => !!s);
    return Array.from(new Set(segmentos)).sort();
  }, [contactos]);

  const sectoresUnicos = useMemo(() => {
    const sectores = contactos
      .map((c) => c.cuentas?.sector)
      .filter((s): s is string => !!s);
    return Array.from(new Set(sectores)).sort();
  }, [contactos]);

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
            Personas asociadas a cuentas
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
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        {/* Buscador */}
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Buscar por nombre, cuenta o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 pl-2"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          {/* Filtro Segmento */}
          <select
            value={filtroSegmento}
            onChange={(e) => setFiltroSegmento(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los segmentos</option>
            {segmentosUnicos.map((segmento) => (
              <option key={segmento} value={segmento}>
                {segmento}
              </option>
            ))}
          </select>

          {/* Filtro Sector */}
          <select
            value={filtroSector}
            onChange={(e) => setFiltroSector(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los sectores</option>
            {sectoresUnicos.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          {/* Botón Limpiar Filtros */}
          {(filtroSegmento || filtroSector || busqueda) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBusqueda("");
                setFiltroSegmento("");
                setFiltroSector("");
              }}
              className="dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
        {cargando ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p>Cargando contactos...</p>
          </div>
        ) : contactos.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
              No hay contactos registrados
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mb-4">
              Comienza agregando tu primer contacto
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/contactos/nuevo")}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Crear primer contacto
            </Button>
          </div>
        ) : contactosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
              No se encontraron resultados
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm">
              No hay contactos que coincidan con "{busqueda}"
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[15%]">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[20%]">
                      Cuenta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[18%]">
                      Correo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      Celular
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      Departamento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[8%]">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-[9%]">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {contactosPaginados.map((contacto) => (
                    <tr
                      key={contacto.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate" title={contacto.nombre}>
                          {contacto.nombre}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={contacto.cuentas?.cliente}>
                          {contacto.cuentas?.cliente || "Sin cuenta"}
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

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                <div className="flex-1 flex justify-between sm:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPaginaActual((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-700">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPaginaActual((prev) =>
                        Math.min(prev + 1, totalPaginas),
                      )
                    }
                    disabled={paginaActual === totalPaginas}
                  >
                    Siguiente
                  </Button>
                </div>

                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-400">
                      Mostrando{" "}
                      <span className="font-medium">
                        {(paginaActual - 1) * itemsPorPagina + 1}
                      </span>{" "}
                      a{" "}
                      <span className="font-medium">
                        {Math.min(
                          paginaActual * itemsPorPagina,
                          contactosFiltrados.length,
                        )}
                      </span>{" "}
                      de{" "}
                      <span className="font-medium">
                        {contactosFiltrados.length}
                      </span>{" "}
                      resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPaginaActual((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={paginaActual === 1}
                        className="rounded-l-md"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {Array.from({ length: totalPaginas }).map((_, i) => (
                        <Button
                          key={i}
                          variant={
                            paginaActual === i + 1 ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setPaginaActual(i + 1)}
                          className={
                            paginaActual === i + 1
                              ? "bg-blue-600 text-white"
                              : ""
                          }
                        >
                          {i + 1}
                        </Button>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPaginaActual((prev) =>
                            Math.min(prev + 1, totalPaginas),
                          )
                        }
                        disabled={paginaActual === totalPaginas}
                        className="rounded-r-md"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
