import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Search, Mail, Calendar, ToggleRight } from "lucide-react";

export default function Marketing() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState<string>("todos");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      let todosLosContactos: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hayMas = true;

      // Cargar en lotes de 1000 hasta obtener todos
      while (hayMas) {
        const { data, error } = await supabase
          .from("contactos")
          .select("*")
          .ilike("estado", "activo")
          .range(from, from + batchSize - 1);

        if (error) {
          console.error("Error:", error);
          throw error;
        }

        if (data && data.length > 0) {
          todosLosContactos = [...todosLosContactos, ...data];
          from += batchSize;

          // Si trajo menos de 1000, ya no hay más
          if (data.length < batchSize) {
            hayMas = false;
          }
        } else {
          hayMas = false;
        }
      }

      console.log("Contactos activos encontrados:", todosLosContactos);
      setContactos(todosLosContactos || []);
    } catch (error) {
      console.error("Error al cargar:", error);
    } finally {
      setCargando(false);
    }
  };

  // Auxiliar para obtener el número de etapa
  const obtenerEtapa = (contacto: any): number => {
    return parseInt(contacto.etapa_envio || "1");
  };

  // Filtrar por búsqueda y pestaña activa
  const contactosFiltrados = contactos.filter((contacto) => {
    const coincideBusqueda =
      contacto.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      contacto.correo?.toLowerCase().includes(busqueda.toLowerCase());

    if (!coincideBusqueda) return false;

    if (tabActiva === "todos") return true;
    if (tabActiva === "completados") {
      return obtenerEtapa(contacto) >= 100;
    }
    return String(obtenerEtapa(contacto)) === tabActiva;
  });

  // Formatear fecha
  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return "-";
    // Si la fecha viene como YYYY-MM-DD sin hora, forzamos medio día para evitar que por huso horario (UTC-3/4) se corra un día atrás
    const fechaAjustada = fecha.length === 10 ? `${fecha}T12:00:00` : fecha;
    return new Date(fechaAjustada).toLocaleDateString("es-CL");
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          👥 Monitor de Contactos
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 font-medium">
          Monitorea el progreso de la campaña de email automatizada
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tight">Contactos Activos</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {contactos.length}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
              <ToggleRight className="h-6 w-6 text-green-600 dark:text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tight">En Progreso</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {
                  contactos.filter((c) => {
                    const etapa = parseInt(c.etapa_envio || "0");
                    return etapa > 0 && etapa < 100;
                  }).length
                }
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tight">Completados</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {
                  contactos.filter((c) => parseInt(c.etapa_envio || "0") >= 100)
                    .length
                }
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <Mail className="h-6 w-6 text-purple-600 dark:text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Pestañas de Etapas */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
        {[
          { id: "todos", label: "Todos", count: contactos.length },
          { id: "1", label: "Etapa 1", count: contactos.filter(c => obtenerEtapa(c) === 1).length },
          { id: "2", label: "Etapa 2", count: contactos.filter(c => obtenerEtapa(c) === 2).length },
          { id: "3", label: "Etapa 3", count: contactos.filter(c => obtenerEtapa(c) === 3).length },
          { id: "4", label: "Etapa 4", count: contactos.filter(c => obtenerEtapa(c) === 4).length },
          { id: "5", label: "Etapa 5", count: contactos.filter(c => obtenerEtapa(c) === 5).length },
          { id: "6", label: "Etapa 6", count: contactos.filter(c => obtenerEtapa(c) === 6).length },
          { id: "7", label: "Etapa 7", count: contactos.filter(c => obtenerEtapa(c) === 7).length },
          { id: "completados", label: "Completados", count: contactos.filter(c => obtenerEtapa(c) >= 100).length }
        ].map((tab) => {
          const estaActiva = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 whitespace-nowrap border cursor-pointer ${
                estaActiva
                  ? "bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  estaActiva
                    ? "bg-indigo-500 dark:bg-indigo-400 text-white"
                    : "bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">Cargando...</p>
          </div>
        ) : contactosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {busqueda
                ? "No se encontraron contactos"
                : "No hay contactos activos"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Total en base de datos: {contactos.length}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Etapa de Envío
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Último Envío
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Próximo Envío
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {contactosFiltrados.map((contacto) => (
                <tr key={contacto.id} className="hover:bg-indigo-50/5 dark:hover:bg-indigo-900/10 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
                  {/* Contacto */}
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {contacto.nombre}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{contacto.correo}</p>
                    </div>
                  </td>

                  {/* Etapa de Envío */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-sm">
                        {contacto.etapa_envio || 1}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        de secuencia
                      </span>
                    </div>
                  </td>

                  {/* Último Envío */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4 opacity-50" />
                      {formatearFecha(contacto.ultimo_envio)}
                    </div>
                  </td>

                  {/* Próximo Envío */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4 opacity-50" />
                      {formatearFecha(contacto.proximo_envio)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Debug info */}
      {!cargando && (
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest flex justify-between">
          <span>Debug: {contactos.length} contactos cargados</span>
          <span>Filtrados: {contactosFiltrados.length}</span>
        </div>
      )}
    </div>
  );
}
