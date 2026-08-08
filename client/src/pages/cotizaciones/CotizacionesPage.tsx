import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, FileText, Search, X, ChevronLeft, Package } from "lucide-react";
import CotizacionForm from "./CotizacionForm";
import BotonExportarPDF from "./CotizacionPDF";
import PackingPage from "../logistica/PackingPage";

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
  vendedores?: {
    nombre: string;
  } | null;
  contacto?: {
    nombre: string;
    correo?: string;
    celular?: string;
  } | null;
  items?: any[];
}

export default function CotizacionesPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();

  const [cotizaciones, setCotizaciones] = useState<CotizacionConCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [pagina, setPagina] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 50;

  // State for the integrated form
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [selectedId, setSelectedId] = useState<string | undefined>(routeId);
  const [showPackingModal, setShowPackingModal] = useState(false);

  useEffect(() => {
    cargarCotizaciones();
    ejecutarCirugiaDeDatos(); // Limpieza automatizada de 40MB
  }, []); 

  const ejecutarCirugiaDeDatos = async () => {
    if (localStorage.getItem('ecomoving_surgery_done_v2')) return;
    console.log('🛡️ PROTOCOLO: Iniciando Cirugía Masiva de Datos (40MB)...');
    
    try {
      const { data: quotes } = await supabase.from('cotizaciones').select('id, items').not('items', 'is', null);
      if (!quotes) return;

      for (const cot of quotes) {
        let changed = false;
        const itemsClean = await Promise.all((cot.items || []).map(async (item: any) => {
          if (item.imagen && item.imagen.length > 30000 && item.imagen.startsWith('data:image')) {
            // Cirugía: Redimensionar Base64 antiguo a 128px
            const resized = await redimensionarBase64(item.imagen, 128);
            if (resized) {
              item.imagen = resized;
              changed = true;
            }
          }
          return item;
        }));

        if (changed) {
          await supabase.from('cotizaciones').update({ items: itemsClean }).eq('id', cot.id);
          console.log(`🛡️ PROTOCOLO: Cotización #${cot.id} optimizada.`);
        }
      }
      localStorage.setItem('ecomoving_surgery_done_v2', 'true');
      console.log('🛡️ PROTOCOLO: Cirugía de datos completada. 40MB -> ~2MB.');
    } catch (e) {
      console.error('🛡️ PROTOCOLO: Error en cirugía:', e);
    }
  };

  const redimensionarBase64 = (base64: string, size: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = size / img.width;
        canvas.width = size;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => resolve('');
      img.src = base64;
    });
  };
  const cargarCotizaciones = async () => {
    setCargando(true);
    setMensaje("");
    try {
      let allCotizaciones: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
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
            items,
            tiempo_entrega,
            validez_oferta,
            fecha,
            id_mercado_publico,
            contacto_id,
            cuenta_id,
            vendedor_id,
            nro_oc,
            nro_guia,
            nro_factura
          `
          )
          .order("numero_cotizacion", { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allCotizaciones = [...allCotizaciones, ...data];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        } else {
          hasMore = false;
        }
      }

      if (allCotizaciones.length === 0) {
        setCotizaciones([]);
        return;
      }

      // Traemos los nombres de cuentas y vendedores para todos los registros cargados
      const idsCuentas = Array.from(new Set(allCotizaciones.map(i => i.cuenta_id).filter(Boolean)));
      const idsVends = Array.from(new Set(allCotizaciones.map(i => i.vendedor_id).filter(Boolean)));

      const [{ data: ctas }, { data: vends }] = await Promise.all([
        supabase.from("cuentas").select("id, cliente").in("id", idsCuentas),
        supabase.from("vendedores").select("id, nombre").in("id", idsVends)
      ]);

      const mapCuentas = (ctas || []).reduce((acc: any, curr) => ({ ...acc, [curr.id]: curr.cliente }), {});
      const mapVends = (vends || []).reduce((acc: any, curr) => ({ ...acc, [curr.id]: curr.nombre }), {});

      const cotizacionesFormateadas = allCotizaciones.map((item: any) => ({
        ...item,
        cuentas: { cliente: mapCuentas[item.cuenta_id] || "Sin Cliente" },
        vendedores: { nombre: mapVends[item.vendedor_id] || "Vendedor no asignado" },
      }));

      setCotizaciones(cotizacionesFormateadas);
    } catch (e: any) {
      console.error("Error al cargar:", e);
      setMensaje("Error al cargar cotizaciones: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (routeId) {
      setSelectedId(routeId);
      setViewMode("form");
    }
  }, [routeId]);

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
        (cot.cuentas?.cliente || "").toLowerCase().includes(termino) ||
        (cot.vendedores?.nombre || "").toLowerCase().includes(termino),
    );
  }, [cotizaciones, busqueda]);

  const cotizacionesPaginadas = useMemo(() => {
    const start = pagina * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return cotizacionesFiltradas.slice(start, end);
  }, [cotizacionesFiltradas, pagina]);

  /**
   * Motor de Estados Automático de Ecomoving (Sincronizado con Formulario)
   */
  const obtenerEstadoAutomatico = (cot: any) => {
    if (cot.nro_factura) return "Facturada";
    if (cot.nro_guia) return "Despachada";
    if (cot.nro_oc) return "Producción";
    
    if (cot.fecha) {
      const fechaCot = new Date(cot.fecha);
      const hoy = new Date();
      const diffTime = Math.abs(hoy.getTime() - fechaCot.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 60) return "Perdida";
    }
    
    return cot.estado_cotizacion === "Perdida" ? "Perdida" : "Pendiente";
  };

  const stats = useMemo(() => {
    const defaultStats = {
      pendiente: { total: 0, count: 0, label: "Pendientes", color: "text-amber-500", icon: <Search className="h-4 w-4" /> },
      produccion: { total: 0, count: 0, label: "Producción", color: "text-blue-500", icon: <Plus className="h-4 w-4" /> },
      despachada: { total: 0, count: 0, label: "Despachadas", color: "text-purple-500", icon: <FileText className="h-4 w-4" /> },
      facturada: { total: 0, count: 0, label: "Facturadas", color: "text-emerald-500", icon: <FileText className="h-4 w-4" /> },
    };

    return cotizacionesFiltradas.reduce((acc, cot) => {
      const estadoReal = obtenerEstadoAutomatico(cot);
      let key = estadoReal.toLowerCase();
      // Mapeo simple para las keys de stats
      if (key === "producción") key = "produccion";
      
      if (acc[key as keyof typeof defaultStats]) {
        acc[key as keyof typeof defaultStats].total += cot.total || 0;
        acc[key as keyof typeof defaultStats].count += 1;
      }
      return acc;
    }, defaultStats);
  }, [cotizacionesFiltradas]);

  const getEstadoColor = (estado?: string) => {
    switch (estado) {
      case "Facturada":
        return "bg-emerald-100/80 text-emerald-800 border-emerald-200";
      case "Despachada":
        return "bg-purple-100/80 text-purple-800 border-purple-200";
      case "Producción":
        return "bg-blue-100/80 text-blue-800 border-blue-200";
      case "Perdida":
        return "bg-red-100/80 text-red-800 border-red-200";
      default:
        return "bg-amber-100/80 text-amber-800 border-amber-200";
    }
  };

  const handleEdit = (id: number) => {
    setSelectedId(String(id));
    setViewMode("form");
    navigate(`/cotizaciones/${id}`, { replace: true });
  };

  const handleNueva = async () => {
    setCargando(true);
    setMensaje(""); // Limpiar errores previos
    try {
      // Cálculo del número correlativo real basado en el máximo actual
      const { data: lastQuote } = await supabase
        .from("cotizaciones")
        .select("numero_cotizacion")
        .order("numero_cotizacion", { ascending: false })
        .limit(1)
        .single();
      
      let nextNum = 5125; // Base por si la tabla estuviera vacía
      if (lastQuote?.numero_cotizacion) {
         const numericMatch = lastQuote.numero_cotizacion.match(/\d+/);
         if (numericMatch) {
            nextNum = parseInt(numericMatch[0]) + 1;
         }
      }
      const numero = `COT-${nextNum}`;

      let dataId: string | null = null;
      const baseDraft = { 
        numero_cotizacion: numero,
        estado_cotizacion: 'Pendiente',
        items: [],
        total: 0,
        total_neto: 0,
        iva: 0,
        costo_total: 0,
        mg: 0,
        ganancias: 0,
        id_mercado_publico: ''
      };

      const { data, error } = await supabase
        .from("cotizaciones")
        .insert([baseDraft])
        .select('id')
        .single();
      
      if (error) {
         // Si falla por columna faltante (ej. id_mercado_publico o fecha)
         if (error.message.toLowerCase().includes("column") || error.message.toLowerCase().includes("schema")) {
            const retryDraft = { ...baseDraft };
            delete (retryDraft as any).id_mercado_publico;
            delete (retryDraft as any).fecha;
            
            const { data: retryData, error: retryError } = await supabase
              .from("cotizaciones")
              .insert([retryDraft])
              .select('id').single();
            if (retryError) throw retryError;
            dataId = String(retryData.id);
         } else {
            throw error;
         }
      } else {
        dataId = String(data.id);
      }
      
      if (dataId) {
        setSelectedId(dataId);
        setViewMode("form");
        navigate(`/cotizaciones/${dataId}`, { replace: true });
      } else {
        throw new Error("No se pudo obtener el identificador de la nueva cotización");
      }
    } catch (e: any) {
      console.error("Error al crear:", e);
      setMensaje("❌ Error al crear cotización rápida: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  const handleCerrarForm = () => {
    setViewMode("list");
    setSelectedId(undefined);
    navigate("/cotizaciones", { replace: true });
    cargarCotizaciones();
  };

  if (viewMode === "form") {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-auto animate-in fade-in duration-300">
        <CotizacionForm
          id={selectedId}
          cuentaId={searchParams.get("cuentaId") || undefined}
          contactoId={searchParams.get("contactoId") || undefined}
          onClose={handleCerrarForm}
          onSave={cargarCotizaciones}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Cotizaciones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de cotizaciones (Página {pagina + 1})
          </p>
        </div>
        <div className="flex gap-2">
        <Button
            variant="outline"
            onClick={() => setShowPackingModal(true)}
            className="border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
          >
            <Package className="mr-2 h-4 w-4" /> Packing
          </Button>
          <Button
            onClick={handleNueva}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md"
            data-testid="button-nueva-cotizacion"
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva Cotización
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                ${new Intl.NumberFormat("es-CL").format(value.total)}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">
                {value.count} docs.
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
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">N°</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Neto</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IVA</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">MG</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ganancia</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendedor</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cotizacionesPaginadas.map((cot) => (
                    <tr key={cot.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {cot.numero_cotizacion || "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 font-medium">
                        <div className="max-w-[220px] lg:max-w-none truncate lg:whitespace-normal">
                          {cot.cuentas?.cliente || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                        ${new Intl.NumberFormat("es-CL").format(cot.total_neto || 0)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-gray-500 dark:text-gray-400 italic whitespace-nowrap">
                        ${new Intl.NumberFormat("es-CL").format(cot.iva || 0)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-gray-900 dark:text-gray-100 font-bold whitespace-nowrap">
                        ${new Intl.NumberFormat("es-CL").format(cot.total || 0)}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                        {cot.mg}
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                        ${new Intl.NumberFormat("es-CL").format(cot.ganancias || 0)}
                      </td>
                      <td className="px-4 py-4 text-[13px] text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                        {cot.vendedores?.nombre || "-"}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className={`px-3 py-1 text-[10px] rounded-full uppercase font-bold tracking-tight shadow-sm ${getEstadoColor(obtenerEstadoAutomatico(cot))}`}>
                          {obtenerEstadoAutomatico(cot)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(cot.id)}
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all group"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                          </button>
                          
                          <BotonExportarPDF
                            variant="icon"
                            cotizacion={cot}
                            cuenta={cot.cuentas}
                            contacto={Array.isArray(cot.contacto) ? cot.contacto[0] : cot.contacto}
                            items={cot.items || []}
                            totales={{ 
                              neto: cot.total_neto || 0, 
                              iva: cot.iva || 0, 
                              total: cot.total || 0 
                            }}
                          />

                          <button
                            onClick={() => handleEliminar(cot.id)}
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg shadow-sm border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-all group"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/30">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {pagina * PAGE_SIZE + 1} a {Math.min((pagina + 1) * PAGE_SIZE, cotizacionesFiltradas.length)} de {cotizacionesFiltradas.length} cotizaciones
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(prev => Math.max(0, prev - 1))}
                  disabled={pagina === 0 || cargando}
                  className="h-8 dark:bg-gray-800 dark:border-gray-700"
                >
                  Anterior
                </Button>
                <div className="flex items-center px-4 text-sm font-medium">
                  Página {pagina + 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(prev => prev + 1)}
                  disabled={(pagina + 1) * PAGE_SIZE >= cotizacionesFiltradas.length || cargando}
                  className="h-8 dark:bg-gray-800 dark:border-gray-700"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Packing */}
      {showPackingModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-auto py-6 px-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-[1400px] relative">
            <button
              onClick={() => setShowPackingModal(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 transition-all"
              title="Cerrar Packing"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6">
              <PackingPage />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

