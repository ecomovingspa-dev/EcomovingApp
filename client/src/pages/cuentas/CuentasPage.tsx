import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentasFiltradas, setCuentasFiltradas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Estados para filtros y búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;

  // Obtener listas únicas de sectores y segmentos
  const sectores = Array.from(
    new Set(cuentas.map((c) => c.sector).filter(Boolean)),
  );
  const segmentos = Array.from(
    new Set(cuentas.map((c) => c.segmento).filter(Boolean)),
  );

  // Cálculos de paginación
  const totalPaginas = Math.ceil(cuentasFiltradas.length / filasPorPagina);
  const indiceInicio = (paginaActual - 1) * filasPorPagina;
  const indiceFin = indiceInicio + filasPorPagina;
  const cuentasPaginadas = cuentasFiltradas.slice(indiceInicio, indiceFin);

  useEffect(() => {
    cargarCuentas();
  }, []);

  useEffect(() => {
    aplicarFiltros();
    // Resetear a la primera página cuando cambian los filtros
    setPaginaActual(1);
  }, [busqueda, filtroSector, filtroSegmento, filtroEstado, cuentas]);

  const cargarCuentas = async () => {
    try {
      setCargando(true);

      let todasLasCuentas: Cuenta[] = [];
      let desde = 0;
      const cantidad = 1000;
      let hayMasRegistros = true;

      // Cargar en lotes de 1000 hasta obtener todos los registros
      while (hayMasRegistros) {
        const { data, error } = await supabase
          .from("cuentas")
          .select("*")
          .order("created_at", { ascending: false })
          .range(desde, desde + cantidad - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          todasLasCuentas = [...todasLasCuentas, ...data];
          desde += cantidad;

          // Si recibimos menos registros que el límite, ya no hay más
          if (data.length < cantidad) {
            hayMasRegistros = false;
          }
        } else {
          hayMasRegistros = false;
        }
      }

      setCuentas(todasLasCuentas);
      setCuentasFiltradas(todasLasCuentas);
    } catch (error: any) {
      console.error("Error:", error);
      setError("Error al cargar las cuentas");
    } finally {
      setCargando(false);
    }
  };

  const aplicarFiltros = () => {
    let resultado = [...cuentas];

    // Filtro de búsqueda (busca en nombre, RUT, ciudad)
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase();
      resultado = resultado.filter(
        (cuenta) =>
          cuenta.cliente?.toLowerCase().includes(busquedaLower) ||
          cuenta.rut?.toLowerCase().includes(busquedaLower) ||
          cuenta.ciudad?.toLowerCase().includes(busquedaLower) ||
          cuenta.correo?.toLowerCase().includes(busquedaLower),
      );
    }

    // Filtro de sector
    if (filtroSector) {
      resultado = resultado.filter((cuenta) => cuenta.sector === filtroSector);
    }

    // Filtro de segmento
    if (filtroSegmento) {
      resultado = resultado.filter(
        (cuenta) => cuenta.segmento === filtroSegmento,
      );
    }

    // Filtro de estado
    if (filtroEstado) {
      resultado = resultado.filter((cuenta) => cuenta.estado === filtroEstado);
    }

    setCuentasFiltradas(resultado);
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroSector("");
    setFiltroSegmento("");
    setFiltroEstado("");
  };

  const eliminarCuenta = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta cuenta?")) return;

    try {
      const { error } = await supabase.from("cuentas").delete().eq("id", id);

      if (error) throw error;

      // Actualizar lista local
      setCuentas(cuentas.filter((c) => c.id !== id));
    } catch (error: any) {
      console.error("Error:", error);
      alert("Error al eliminar la cuenta");
    }
  };

  const getEstadoBadge = (estado: string) => {
    const estilos = {
      activo: "bg-green-100 text-green-800",
      inactivo: "bg-gray-100 text-gray-800",
      prospecto: "bg-blue-100 text-blue-800",
    };
    return estilos[estado as keyof typeof estilos] || estilos.activo;
  };

  // Funciones de navegación de paginación
  const irAPrimeraPagina = () => setPaginaActual(1);
  const irAUltimaPagina = () => setPaginaActual(totalPaginas);
  const irAPaginaAnterior = () =>
    setPaginaActual((prev) => Math.max(prev - 1, 1));
  const irAPaginaSiguiente = () =>
    setPaginaActual((prev) => Math.min(prev + 1, totalPaginas));

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          ⏳ Cargando cuentas...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📋 Cuentas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de empresas y clientes
          </p>
        </div>
        <Link
          to="/cuentas/nueva"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          ➕ Nueva Cuenta
        </Link>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        {/* Buscador */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🔍 Buscar
          </label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RUT, ciudad o correo..."
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="prospecto">Prospecto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sector
            </label>
            <select
              value={filtroSector}
              onChange={(e) => setFiltroSector(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {sectores.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Segmento
            </label>
            <select
              value={filtroSegmento}
              onChange={(e) => setFiltroSegmento(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {segmentos.map((segmento) => (
                <option key={segmento} value={segmento}>
                  {segmento}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={limpiarFiltros}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              🔄 Limpiar Filtros
            </button>
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          Mostrando{" "}
          <span className="font-semibold">{cuentasFiltradas.length}</span> de{" "}
          <span className="font-semibold">{cuentas.length}</span> cuentas
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Controles de Paginación Superior */}
      {cuentasFiltradas.length > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Página <span className="font-semibold">{paginaActual}</span> de{" "}
            <span className="font-semibold">{totalPaginas}</span> (mostrando{" "}
            {indiceInicio + 1}-{Math.min(indiceFin, cuentasFiltradas.length)} de{" "}
            {cuentasFiltradas.length} cuentas)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={irAPrimeraPagina}
              disabled={paginaActual === 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Primera página"
            >
              ⏮️
            </button>
            <button
              onClick={irAPaginaAnterior}
              disabled={paginaActual === 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={irAPaginaSiguiente}
              disabled={paginaActual === totalPaginas}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
            <button
              onClick={irAUltimaPagina}
              disabled={paginaActual === totalPaginas}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Última página"
            >
              ⏭️
            </button>
          </div>
        </div>
      )}

      {/* Tabla de Cuentas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  RUT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sector
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Segmento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ciudad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {cuentasPaginadas.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {busqueda || filtroSector || filtroSegmento || filtroEstado
                      ? "No se encontraron cuentas con los filtros aplicados"
                      : "No hay cuentas registradas. Crea tu primera cuenta."}
                  </td>
                </tr>
              ) : (
                cuentasPaginadas.map((cuenta) => (
                  <tr
                    key={cuenta.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cuenta.cliente}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {cuenta.rut || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoBadge(cuenta.estado || "activo")}`}
                      >
                        {cuenta.estado || "activo"}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {cuenta.sector || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {cuenta.segmento || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {cuenta.ciudad || "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col text-sm">
                        {cuenta.correo && (
                          <a
                            href={`mailto:${cuenta.correo}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate max-w-xs"
                          >
                            📧 {cuenta.correo}
                          </a>
                        )}
                        {cuenta.telefono && (
                          <a
                            href={`tel:${cuenta.telefono}`}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                          >
                            📞 {cuenta.telefono}
                          </a>
                        )}
                        {!cuenta.correo && !cuenta.telefono && (
                          <span className="text-gray-400 dark:text-gray-500">
                            -
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/cuentas/editar/${cuenta.id}`}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Editar"
                        >
                          ✏️
                        </Link>
                        <button
                          onClick={() => eliminarCuenta(cuenta.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controles de Paginación Inferior */}
      {cuentasFiltradas.length > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Página <span className="font-semibold">{paginaActual}</span> de{" "}
            <span className="font-semibold">{totalPaginas}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={irAPrimeraPagina}
              disabled={paginaActual === 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Primera página"
            >
              ⏮️
            </button>
            <button
              onClick={irAPaginaAnterior}
              disabled={paginaActual === 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={irAPaginaSiguiente}
              disabled={paginaActual === totalPaginas}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
            <button
              onClick={irAUltimaPagina}
              disabled={paginaActual === totalPaginas}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Última página"
            >
              ⏭️
            </button>
          </div>
        </div>
      )}

      {/* Resumen estadístico */}
      {cuentas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Cuentas
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {cuentas.length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Activas
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {cuentas.filter((c) => c.estado === "activo").length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Prospectos
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {cuentas.filter((c) => c.estado === "prospecto").length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Inactivas
            </div>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {cuentas.filter((c) => c.estado === "inactivo").length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
