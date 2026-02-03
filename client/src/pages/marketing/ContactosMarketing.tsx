import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Search, Mail, Calendar, ToggleRight, Building2, ChevronDown, ChevronRight, Users } from "lucide-react";

interface Contacto {
  id: string;
  nombre: string;
  correo: string;
  cuenta_id: string;
  etapa_envio: string | null;
  ultimo_envio: string | null;
  proximo_envio: string | null;
}

interface Cuenta {
  id: string;
  cliente: string;
}

interface GrupoCliente {
  cuenta: Cuenta;
  contactos: Contacto[];
  expanded: boolean;
}

export default function Marketing() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [gruposClientes, setGruposClientes] = useState<GrupoCliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Cargar contactos activos con información de cuenta
      const { data: contactosData, error: contactosError } = await supabase
        .from("contactos")
        .select(`
          id,
          nombre,
          correo,
          cuenta_id,
          etapa_envio,
          ultimo_envio,
          proximo_envio
        `)
        .ilike("estado", "activo");

      if (contactosError) throw contactosError;

      // Cargar cuentas
      const { data: cuentasData, error: cuentasError } = await supabase
        .from("cuentas")
        .select("id, cliente")
        .order("cliente", { ascending: true });

      if (cuentasError) throw cuentasError;

      setContactos(contactosData || []);
      setCuentas(cuentasData || []);

      // Agrupar contactos por cliente
      const grupos = agruparPorCliente(contactosData || [], cuentasData || []);
      setGruposClientes(grupos);

    } catch (error) {
      console.error("Error al cargar:", error);
    } finally {
      setCargando(false);
    }
  };

  const agruparPorCliente = (contactos: Contacto[], cuentas: Cuenta[]): GrupoCliente[] => {
    const cuentasMap = new Map<string, Cuenta>();
    cuentas.forEach(c => cuentasMap.set(c.id, c));

    const grupos = new Map<string, GrupoCliente>();

    // Agrupar contactos que tienen cuenta
    contactos.forEach(contacto => {
      const cuentaId = contacto.cuenta_id || "sin-cuenta";

      if (!grupos.has(cuentaId)) {
        const cuenta = cuentasMap.get(cuentaId) || { id: cuentaId, cliente: "Sin empresa asignada" };
        grupos.set(cuentaId, {
          cuenta,
          contactos: [],
          expanded: true // Expandido por defecto
        });
      }

      grupos.get(cuentaId)!.contactos.push(contacto);
    });

    // Ordenar por nombre de cliente
    return Array.from(grupos.values()).sort((a, b) =>
      a.cuenta.cliente.localeCompare(b.cuenta.cliente)
    );
  };

  const toggleGrupo = (cuentaId: string) => {
    setGruposClientes(prev =>
      prev.map(grupo =>
        grupo.cuenta.id === cuentaId
          ? { ...grupo, expanded: !grupo.expanded }
          : grupo
      )
    );
  };

  // Filtrar grupos por búsqueda
  const gruposFiltrados = gruposClientes
    .map(grupo => ({
      ...grupo,
      contactos: grupo.contactos.filter(
        contacto =>
          contacto.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
          contacto.correo?.toLowerCase().includes(busqueda.toLowerCase()) ||
          grupo.cuenta.cliente?.toLowerCase().includes(busqueda.toLowerCase())
      )
    }))
    .filter(grupo => grupo.contactos.length > 0);

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleDateString("es-CL");
  };

  const totalContactos = contactos.length;
  const enProgreso = contactos.filter(c => {
    const etapa = parseInt(c.etapa_envio || "0");
    return etapa > 0 && etapa < 100;
  }).length;
  const completados = contactos.filter(c => parseInt(c.etapa_envio || "0") >= 100).length;

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tight">Clientes</p>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {gruposClientes.length}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tight">Contactos Activos</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {totalContactos}
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
                {enProgreso}
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
                {completados}
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
            placeholder="Buscar por nombre, email o empresa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Grupos por Cliente */}
      <div className="space-y-4">
        {cargando ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">Cargando...</p>
          </div>
        ) : gruposFiltrados.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {busqueda ? "No se encontraron resultados" : "No hay contactos activos"}
            </p>
          </div>
        ) : (
          gruposFiltrados.map((grupo) => (
            <div
              key={grupo.cuenta.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Header del Grupo (Cliente) */}
              <button
                onClick={() => toggleGrupo(grupo.cuenta.id)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {grupo.cuenta.cliente}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {grupo.contactos.length} contacto{grupo.contactos.length !== 1 ? 's' : ''}
                    </p>
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
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Contacto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Etapa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Último Envío
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Próximo Envío
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {grupo.contactos.map((contacto) => (
                      <tr key={contacto.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {contacto.nombre}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {contacto.correo}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-sm">
                            {contacto.etapa_envio || 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="h-4 w-4 opacity-50" />
                            {formatearFecha(contacto.ultimo_envio)}
                          </div>
                        </td>
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
          ))
        )}
      </div>

      {/* Debug info */}
      {!cargando && (
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest flex justify-between">
          <span>Clientes: {gruposClientes.length}</span>
          <span>Contactos: {totalContactos}</span>
          <span>Filtrados: {gruposFiltrados.reduce((acc, g) => acc + g.contactos.length, 0)}</span>
        </div>
      )}
    </div>
  );
}
