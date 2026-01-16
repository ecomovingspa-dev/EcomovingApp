import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, FileText, Search } from "lucide-react";

interface CotizacionConCuenta {
  id: number;
  numero_cotizacion?: string;
  total_neto?: number;
  iva?: number;
  total?: number;
  mg?: number;
  ganancias?: number;
  estado_cotizacion?: string;
  cuentas?: {
    cliente: string;
  } | null;
}

export default function CotizacionesPage() {
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState<CotizacionConCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  const cargarCotizaciones = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(
          `
          id,
          numero_cotizacion,
          total_neto,
          iva,
          total,
          mg,
          ganancias,
          estado_cotizacion,
          cuentas:cuentas!cotizaciones_cuenta_id_fkey (
            cliente
          )
        `,
        )
        .order("numero_cotizacion", { ascending: false });

      if (error) throw error;
      const cotizacionesFormateadas = (data || []).map((item: any) => ({
        ...item,
        cuentas: Array.isArray(item.cuentas) ? item.cuentas[0] : item.cuentas,
      }));
      setCotizaciones(cotizacionesFormateadas);
    } catch (e: any) {
      console.error("Error al cargar:", e);
      setMensaje("Error al cargar cotizaciones: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("¿Eliminar esta cotización?")) return;

    try {
      const { error } = await supabase
        .from("cotizaciones")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setMensaje("Cotización eliminada");
      cargarCotizaciones();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e: any) {
      console.error("Error al eliminar:", e);
      setMensaje("Error: " + e.message);
    }
  };

  const cotizacionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return cotizaciones;
    const termino = busqueda.toLowerCase();
    return cotizaciones.filter(
      (cot) =>
        (cot.numero_cotizacion || "").toLowerCase().includes(termino) ||
        (cot.cuentas?.cliente || "").toLowerCase().includes(termino),
    );
  }, [cotizaciones, busqueda]);

  const formatearNumero = (valor?: number) => {
    if (valor == null) return "-";
    return new Intl.NumberFormat("es-CL").format(valor);
  };

  const formatearPorcentaje = (valor?: number) => {
    if (valor == null) return "-";
    return `${valor}%`;
  };

  const stats = useMemo(() => {
    const defaultStats = {
      borrador: { total: 0, count: 0, label: "Borradores", color: "text-gray-500", icon: <FileText className="h-4 w-4" /> },
      pendiente: { total: 0, count: 0, label: "Pendientes", color: "text-amber-500", icon: <Search className="h-4 w-4" /> },
      produccion: { total: 0, count: 0, label: "Producción", color: "text-blue-500", icon: <Plus className="h-4 w-4" /> },
      despachada: { total: 0, count: 0, label: "Despachadas", color: "text-purple-500", icon: <FileText className="h-4 w-4" /> },
      facturada: { total: 0, count: 0, label: "Facturadas", color: "text-emerald-500", icon: <FileText className="h-4 w-4" /> },
    };

    return cotizaciones.reduce((acc, cot) => {
      const estado = (cot.estado_cotizacion || "borrador").toLowerCase();
      if (acc[estado as keyof typeof defaultStats]) {
        acc[estado as keyof typeof defaultStats].total += cot.total || 0;
        acc[estado as keyof typeof defaultStats].count += 1;
      }
      return acc;
    }, defaultStats);
  }, [cotizaciones]);

  const getEstadoColor = (estado?: string) => {
    switch (estado?.toLowerCase()) {
      case "facturada":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "pendiente":
      case "borrador":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "produccion":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200";
      case "despachada":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "rechazada":
      case "cancelada":
      case "perdida":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Cotizaciones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de cotizaciones
          </p>
        </div>
        <Button
          onClick={() => navigate("/cotizaciones/nueva")}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md"
          data-testid="button-nueva-cotizacion"
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva Cotización
        </Button>
      </div>

      {/* Panel de Resumen Ejectuivo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group">
            <div className={`flex items-center gap-2 mb-2 ${value.color} font-bold text-[10px] uppercase tracking-wider`}>
              <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                {value.icon}
              </div>
              {value.label}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">
                ${formatearNumero(value.total)}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">
                {value.count} documentos
              </span>
            </div>
          </div>
        ))}
      </div>

      {mensaje && (
        <div
          className={`p-4 rounded-lg font-medium border flex items-center gap-2 ${mensaje.includes("Error")
            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
            : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
            }`}
        >
          {mensaje}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        <Input
          type="text"
          placeholder="Buscar por número de cotización o cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-10 w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          data-testid="input-busqueda-cotizacion"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden border border-gray-200 dark:border-gray-700">
        {cargando ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Cargando...
          </div>
        ) : cotizacionesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {busqueda
              ? "No se encontraron cotizaciones"
              : "No hay cotizaciones"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    N° Cotización
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Total Neto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    IVA
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    MG
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Ganancias
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {cotizacionesFiltradas.map((cot) => (
                  <tr
                    key={cot.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {cot.numero_cotizacion || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {cot.cuentas?.cliente || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      ${formatearNumero(cot.total_neto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      ${formatearNumero(cot.iva)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      ${formatearNumero(cot.total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      {formatearPorcentaje(cot.mg)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      ${formatearNumero(cot.ganancias)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs rounded-full uppercase font-medium ${getEstadoColor(cot.estado_cotizacion)}`}
                      >
                        {cot.estado_cotizacion || "Sin estado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/cotizaciones/${cot.id}`)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          data-testid={`button-edit-cotizacion-${cot.id}`}
                        >
                          <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleEliminar(cot.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          data-testid={`button-delete-cotizacion-${cot.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
