import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { Search, Mail, Calendar, ToggleRight } from "lucide-react";

export default function Marketing() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

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
          .eq("estado", "activo")
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

  // Filtrar por búsqueda
  const contactosFiltrados = contactos.filter(
    (contacto) =>
      contacto.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      contacto.correo?.toLowerCase().includes(busqueda.toLowerCase()),
  );

  // Formatear fecha
  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleDateString("es-CL");
  };

  // Calcular progreso
  const calcularProgreso = (etapa: string | null) => {
    if (!etapa) return 0;
    return Math.min((parseInt(etapa) / 100) * 100, 100);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          👥 Monitor de Contactos
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitorea el progreso de la campaña de email automatizada
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Contactos Activos</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                {contactos.length}
              </p>
            </div>
            <ToggleRight className="h-12 w-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">En Progreso</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-500">
                {
                  contactos.filter((c) => {
                    const etapa = parseInt(c.etapa_envio || "0");
                    return etapa > 0 && etapa < 100;
                  }).length
                }
              </p>
            </div>
            <Mail className="h-12 w-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completados</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-500">
                {
                  contactos.filter((c) => parseInt(c.etapa_envio || "0") >= 100)
                    .length
                }
              </p>
            </div>
            <Mail className="h-12 w-12 text-purple-500 opacity-20" />
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
                  Progreso
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
                <tr key={contacto.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  {/* Contacto */}
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {contacto.nombre}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{contacto.correo}</p>
                    </div>
                  </td>

                  {/* Progreso */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${calcularProgreso(contacto.etapa_envio)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 min-w-[50px]">
                        {contacto.etapa_envio || "0"}/100
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
