import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Package, 
  Search, 
  RotateCcw, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  Box,
  Scale,
  Maximize2,
  Trash2
} from "lucide-react";

interface PackingItem {
  id: string;
  codigo: string;
  proveedor: string;
  n_cajas: number;
  cantidad_por_caja: number;
  ancho: number;
  alto: number;
  largo: number;
  kg_por_caja: number;
  peso_volumen: number;
  peso_kg: number;
  created_at: string;
}

export default function PackingPage() {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  useEffect(() => {
    cargarItems();
  }, [busqueda]);

  const cargarItems = async () => {
    try {
      setCargando(true);
      let query = supabase.from("packing_productos").select("*");

      if (busqueda) {
        query = query.or(`codigo.ilike.%${busqueda}%,proveedor.ilike.%${busqueda}%`);
      }

      const { data, error } = await query.order("codigo", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error("Error cargando packing:", err);
      setError("Error al cargar los datos de packing");
    } finally {
      setCargando(false);
    }
  };

  const actualizarInline = async (id: string, campo: keyof PackingItem, valor: any) => {
    const itemOriginal = items.find(i => i.id === id);
    if (itemOriginal && itemOriginal[campo] === valor) return;

    setGuardandoId(`${id}-${campo}`);
    try {
      const { error } = await supabase
        .from("packing_productos")
        .update({ [campo]: valor })
        .eq("id", id);

      if (error) throw error;

      // Actualizar estado local
      setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i));
    } catch (err) {
      console.error("Error al actualizar:", err);
      setError("Error al guardar cambios");
      setTimeout(() => setError(""), 3000);
    } finally {
      setGuardandoId(null);
    }
  };

  const eliminarItem = async (id: string) => {
    if (!confirm("¿Eliminar este registro de packing?")) return;
    try {
      const { error } = await supabase.from("packing_productos").delete().eq("id", id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("Error al eliminar el registro");
    }
  };

  // Cálculos dinámicos para la UI (reflejando la lógica de la Vista)
  const calcularPesoVolumen = (i: PackingItem) => {
    return Number(((i.n_cajas * (i.ancho * i.alto * i.largo)) / 4000).toFixed(2));
  };

  const calcularPesoKg = (i: PackingItem) => {
    return Number((i.n_cajas * i.kg_por_caja).toFixed(2));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Package size={160} className="text-blue-600" />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
               <Package className="h-8 w-8 text-white" />
            </div>
            Gestión de Packing
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium max-w-2xl">
            Control de dimensiones y pesos logísticos. Los cálculos de <span className="text-blue-600 font-bold">Peso Volumen</span> y <span className="text-blue-600 font-bold">Peso Kg</span> se actualizan automáticamente al editar las medidas o cajas.
          </p>
        </div>

        <div className="flex gap-3 relative z-10">
           <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
              <Truck className="text-blue-600 h-6 w-6" />
              <div>
                 <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Items</div>
                 <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{items.length}</div>
              </div>
           </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código de producto o proveedor..."
              className="w-full border-none rounded-xl px-12 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all font-semibold shadow-inner"
            />
          </div>
          <button
            onClick={() => setBusqueda("")}
            className="px-6 py-4 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-all flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl flex items-center gap-3 animate-bounce">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}

      {/* Tabla Principal */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
            <thead className="bg-gray-50/50 dark:bg-gray-900/30">
              <tr>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700">Producto</th>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700">Proveedor</th>
                <th className="px-4 py-5 text-center text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700">Cajas</th>
                <th className="px-4 py-5 text-center text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700 bg-indigo-50/30 dark:bg-indigo-900/10">Cant./Caja</th>
                <th className="px-4 py-5 text-center text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700">P. Volumen</th>
                <th className="px-4 py-5 text-center text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700">Peso Total</th>
                <th className="px-6 py-5 text-center text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700 bg-yellow-50/30 dark:bg-yellow-900/10">Dimensiones (An x Al x La)</th>
                <th className="px-6 py-5 text-left text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b dark:border-gray-700">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {cargando && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-32 text-center">
                    <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-bold text-xl">Sincronizando con Supabase...</p>
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.id} className="group hover:bg-blue-50/20 dark:hover:bg-blue-900/5 transition-colors">
                  {/* Código */}
                  <td className="px-6 py-4">
                    <input
                      defaultValue={item.codigo}
                      onBlur={(e) => actualizarInline(item.id, "codigo", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-1 text-sm font-black text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all uppercase"
                    />
                  </td>

                  {/* Proveedor */}
                  <td className="px-6 py-4">
                    <input
                      defaultValue={item.proveedor || ""}
                      onBlur={(e) => actualizarInline(item.id, "proveedor", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all"
                    />
                  </td>

                  {/* Cajas */}
                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                        <input
                          type="number"
                          defaultValue={item.n_cajas}
                          onBlur={(e) => actualizarInline(item.id, "n_cajas", parseInt(e.target.value) || 0)}
                          className="w-16 bg-transparent border-none rounded-lg px-2 py-1 text-center text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">N° Cajas</span>
                    </div>
                  </td>

                  {/* Cantidad por Caja */}
                  <td className="px-4 py-4 text-center bg-indigo-50/10 dark:bg-indigo-900/5">
                    <div className="flex flex-col items-center">
                      <div className="inline-flex flex-col items-center px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <input
                          type="number"
                          defaultValue={item.cantidad_por_caja}
                          onBlur={(e) => actualizarInline(item.id, "cantidad_por_caja", parseInt(e.target.value) || 0)}
                          className="w-14 bg-transparent border-none text-center text-sm font-black text-indigo-700 dark:text-indigo-400 focus:ring-0 p-0"
                          title="Cantidad por caja"
                        />
                        <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">Und/Caja</span>
                      </div>
                    </div>
                  </td>

                  {/* Peso Volumen (Calculado) */}
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex flex-col items-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                           {calcularPesoVolumen(item).toLocaleString('es-CL')}
                        </span>
                        <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Volumen</span>
                    </div>
                  </td>

                  {/* Peso Kg (Calculado) */}
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex flex-col items-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                           {calcularPesoKg(item).toLocaleString('es-CL')} kg
                        </span>
                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Total</span>
                    </div>
                  </td>

                  {/* Dimensiones y Peso Caja */}
                  <td className="px-6 py-4 bg-yellow-50/10 dark:bg-yellow-900/5">
                    <div className="flex items-center gap-2 justify-center">
                       <input 
                          type="number"
                          defaultValue={item.ancho}
                          onBlur={(e) => actualizarInline(item.id, "ancho", parseFloat(e.target.value) || 0)}
                          className="w-12 text-center text-xs font-bold bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-0"
                          title="Ancho"
                       />
                       <span className="text-gray-300 text-xs font-bold">×</span>
                       <input 
                          type="number"
                          defaultValue={item.alto}
                          onBlur={(e) => actualizarInline(item.id, "alto", parseFloat(e.target.value) || 0)}
                          className="w-12 text-center text-xs font-bold bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-0"
                          title="Alto"
                       />
                       <span className="text-gray-300 text-xs font-bold">×</span>
                       <input 
                          type="number"
                          defaultValue={item.largo}
                          onBlur={(e) => actualizarInline(item.id, "largo", parseFloat(e.target.value) || 0)}
                          className="w-12 text-center text-xs font-bold bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-0"
                          title="Largo"
                       />
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1">
                       <span className="text-[9px] font-black text-gray-400 uppercase">Kg/Caja:</span>
                       <input 
                          type="number"
                          defaultValue={item.kg_por_caja}
                          onBlur={(e) => actualizarInline(item.id, "kg_por_caja", parseFloat(e.target.value) || 0)}
                          className="w-14 text-center text-[11px] font-black text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md px-1"
                       />
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                       {guardandoId?.startsWith(item.id) ? (
                         <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                       ) : (
                         <CheckCircle2 className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100" />
                       )}
                       <button
                         onClick={() => eliminarItem(item.id)}
                         className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                         title="Eliminar Registro"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer / Disclaimer */}
      <div className="flex items-center justify-between text-gray-400 dark:text-gray-500 px-4 py-2">
         <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <Scale className="h-4 w-4" />
            Metodología Ecomoving Logística v2.0
         </div>
         <div className="text-xs font-medium">
            Divisor Volumétrico: <span className="text-blue-500 font-bold">4.000</span>
         </div>
      </div>
    </div>
  );
}
