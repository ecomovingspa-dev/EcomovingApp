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
        <h1 className="text-3xl font-bold text-gray-900">
          👥 Contactos de Marketing
        </h1>
        <p className="text-gray-600 mt-2">
          Monitorea el progreso de la campaña de email automatizada
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Contactos Activos</p>
              <p className="text-3xl font-bold text-green-600">
                {contactos.length}
              </p>
            </div>
            <ToggleRight className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En Progreso</p>
              <p className="text-3xl font-bold text-blue-600">
                {
                  contactos.filter((c) => {
                    const etapa = parseInt(c.etapa_envio || "0");
                    return etapa > 0 && etapa < 100;
                  }).length
                }
              </p>
            </div>
            <Mail className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completados</p>
              <p className="text-3xl font-bold text-purple-600">
                {
                  contactos.filter((c) => parseInt(c.etapa_envio || "0") >= 100)
                    .length
                }
              </p>
            </div>
            <Mail className="h-12 w-12 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Cargando...</p>
          </div>
        ) : contactosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">
              {busqueda
                ? "No se encontraron contactos"
                : "No hay contactos activos"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Total en base de datos: {contactos.length}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Progreso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Último Envío
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Próximo Envío
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contactosFiltrados.map((contacto) => (
                <tr key={contacto.id} className="hover:bg-gray-50">
                  {/* Contacto */}
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {contacto.nombre}
                      </p>
                      <p className="text-sm text-gray-600">{contacto.correo}</p>
                    </div>
                  </td>

                  {/* Progreso */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${calcularProgreso(contacto.etapa_envio)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 min-w-[60px]">
                        {contacto.etapa_envio || "0"}/100
                      </span>
                    </div>
                  </td>

                  {/* Último Envío */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatearFecha(contacto.ultimo_envio)}
                    </div>
                  </td>

                  {/* Próximo Envío */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
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
        <div className="mt-4 p-4 bg-gray-100 rounded text-xs text-gray-600">
          <p>Debug: {contactos.length} contactos cargados</p>
          <p>Filtrados: {contactosFiltrados.length}</p>
        </div>
      )}
    </div>
  );
}
