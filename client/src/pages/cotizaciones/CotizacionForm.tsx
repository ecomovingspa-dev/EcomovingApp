import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cotizacion, Item, SubCosto, Cuenta, Contacto } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, X, Image as ImageIcon, Box, FileText, ChevronDown, ChevronUp, Layers, MousePointer2 } from "lucide-react";
import BotonExportarPDF from "./CotizacionPDF";

interface CotizacionFormProps {
  id?: string;
  cuentaId?: string;
  contactoId?: string;
  onClose: () => void;
  onSave: () => void;
}

const CATEGORIAS = [
  { id: "botellas", label: "Botellas / Hydration", icon: "💧" },
  { id: "morrales", label: "Morrales / Backpacks", icon: "🎒" },
  { id: "mugs", label: "Mugs / Cups", icon: "☕" },
  { id: "totes", label: "Tote Bags / Bolsas", icon: "🛍️" },
  { id: "libretas", label: "Libretas / Notebooks", icon: "📓" },
  { id: "boligrafos", label: "Bolígrafos / Pens", icon: "🖋️" },
  { id: "tecnologia", label: "Tecnología / USB", icon: "🔋" },
];

export default function CotizacionForm({ id: propId, cuentaId, contactoId, onClose, onSave }: CotizacionFormProps) {
  const { id: paramId } = useParams();
  const id = propId || paramId;
  
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);

  const [cotizacion, setCotizacion] = useState<Partial<Cotizacion>>({
    estado_cotizacion: "Borrador",
    cuenta_id: cuentaId,
    contacto_id: contactoId,
    items: [],
    costo_total: 0,
    total_neto: 0,
    iva: 0,
    total: 0,
    ganancias: 0,
    fecha: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    cargarDatosIniciales();
    if (id) cargarCotizacion();
  }, [id]);

  const cargarDatosIniciales = async () => {
    try {
      const [{ data: ctas }, { data: vends }] = await Promise.all([
        supabase.from("cuentas").select("id, cliente").order("cliente"),
        supabase.from("vendedores").select("id, nombre").order("nombre"),
      ]);
      setCuentas(ctas || []);
      setVendedores(vends || []);

      if (cuentaId) {
        const { data: conts } = await supabase.from("contactos").select("*").eq("cuenta_id", cuentaId);
        setContactos(conts || []);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  };

  const cargarCotizacion = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("cotizaciones").select("*").eq("id", id).single();
      if (error) throw error;
      setCotizacion(data);
      if (data.cuenta_id) {
        const { data: conts } = await supabase.from("contactos").select("*").eq("cuenta_id", data.cuenta_id);
        setContactos(conts || []);
      }
    } catch (err: any) {
      setMensaje("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = async (cid: string) => {
    setCotizacion(prev => ({ ...prev, cuenta_id: cid, contacto_id: "" }));
    const { data: conts } = await supabase.from("contactos").select("*").eq("cuenta_id", cid);
    setContactos(conts || []);
  };

  const addItem = () => {
    const newItem: Item = {
      id: Date.now(),
      descripcion: "",
      cantidad: 1,
      margen: 25,
      subcostos: [{ id: Date.now() + 1, proveedor: "", cantidad: 1, precio_unitario: 0, descuento: 0, valor: 0 }],
      categoria_producto: "botellas",
      especificaciones_tecnicas: "",
      imagenes_secundarias: ["", "", ""]
    };
    setCotizacion(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const removeItem = (iid: number) => {
    setCotizacion(prev => ({ ...prev, items: (prev.items || []).filter(it => it.id !== iid) }));
  };

  const updateItem = (iid: number, updates: Partial<Item>) => {
    setCotizacion(prev => ({
      ...prev,
      items: (prev.items || []).map(it => it.id === iid ? { ...it, ...updates } : it)
    }));
  };

  const addSubCosto = (iid: number) => {
    setCotizacion(prev => ({
      ...prev,
      items: (prev.items || []).map(it => it.id === iid ? {
        ...it,
        subcostos: [...it.subcostos, { id: Date.now(), proveedor: "", cantidad: 1, precio_unitario: 0, descuento: 0, valor: 0 }]
      } : it)
    }));
  };

  const updateSubCosto = (iid: number, sid: number, updates: Partial<SubCosto>) => {
    setCotizacion(prev => ({
      ...prev,
      items: (prev.items || []).map(it => {
        if (it.id !== iid) return it;
        return {
          ...it,
          subcostos: it.subcostos.map(sc => sc.id === sid ? { ...sc, ...updates } : sc)
        };
      })
    }));
  };

  const removeSubCosto = (iid: number, sid: number) => {
    setCotizacion(prev => ({
      ...prev,
      items: (prev.items || []).map(it => it.id === iid ? {
        ...it,
        subcostos: it.subcostos.filter(sc => sc.id !== sid)
      } : it)
    }));
  };

  // Cálculos Automáticos
  useEffect(() => {
    const items = cotizacion.items || [];
    let costoTotal = 0;
    let totalNeto = 0;

    items.forEach(it => {
      const costoItem = it.subcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
      costoTotal += costoItem;
      // El total neto por ítem es costoItem / (1 - margen/100) si es margen sobre venta, o costoItem * (1 + margen/100)
      // Usaremos margen sobre costo para simplicidad o margen sobre venta según convención
      const netoItem = costoItem / (1 - (it.margen || 0) / 100);
      totalNeto += netoItem;
    });

    const iva = totalNeto * 0.19;
    const total = totalNeto + iva;
    const ganancias = totalNeto - costoTotal;

    setCotizacion(prev => ({
      ...prev,
      costo_total: Math.round(costoTotal),
      total_neto: Math.round(totalNeto),
      iva: Math.round(iva),
      total: Math.round(total),
      ganancias: Math.round(ganancias),
      mg: costoTotal > 0 ? (ganancias / totalNeto * 100).toFixed(1) + "%" : "0%"
    }));
  }, [JSON.stringify(cotizacion.items)]);

  const handleSave = async () => {
    if (!cotizacion.cuenta_id || !cotizacion.contacto_id || (cotizacion.items?.length || 0) === 0) {
      setMensaje("⚠️ Por favor completa los campos requeridos y añade al menos un ítem.");
      return;
    }

    setLoading(true);
    setMensaje("");

    try {
      const payload = { ...cotizacion };
      delete payload.cuentas;
      delete payload.contactos;
      delete payload.cuenta;
      delete payload.contacto;

      let error;
      if (id) {
        const { error: err } = await supabase.from("cotizaciones").update(payload).eq("id", id);
        error = err;
      } else {
        // Generar número correlativo COT-2026-XXXX
        const { count } = await supabase.from("cotizaciones").select("id", { count: 'exact', head: true });
        const num = (count || 0) + 5125; // Siguiendo el ejemplo del usuario
        payload.numero_cotizacion = `COT-${num}`;
        const { error: err } = await supabase.from("cotizaciones").insert([payload]);
        error = err;
      }

      if (error) throw error;
      setMensaje("✅ Cotización guardada exitosamente");
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err: any) {
      setMensaje("❌ Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Image Treatment (Resize/Compress)
  const handleImageUpload = (iid: number, index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Exportar a JPEG de baja calidad
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        
        // Actualizar item
        const item = cotizacion.items?.find(it => it.id === iid);
        if (item) {
          const imgs = [...(item.imagenes_secundarias || ["", "", ""])];
          imgs[index] = dataUrl;
          updateItem(iid, { imagenes_secundarias: imgs });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-gray-800 pb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="rounded-full h-12 w-12 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
               {id ? `EDITOR COTIZACIÓN ${cotizacion.numero_cotizacion || ""}` : "NUEVA REQUERIMIENTO COMERCIAL"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Configure los detalles técnicos y financieros de la propuesta.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
           {id && (
             <BotonExportarPDF
               cotizacion={cotizacion}
               cuenta={cuentas.find(c => c.id === cotizacion.cuenta_id)}
               contacto={contactos.find(c => c.id === cotizacion.contacto_id)}
               items={cotizacion.items || []}
               totales={{ 
                 neto: cotizacion.total_neto || 0, 
                 iva: cotizacion.iva || 0, 
                 total: cotizacion.total || 0 
               }}
             />
           )}
           <Button variant="outline" onClick={onClose} className="flex-1 md:flex-none h-12 px-8 font-bold text-gray-700 dark:text-gray-300">
             CANCELAR
           </Button>
           <Button onClick={handleSave} disabled={loading} className="flex-1 md:flex-none h-12 px-10 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/20">
             {loading ? "PROCESANDO..." : "GUARDAR Y VALIDAR"}
           </Button>
        </div>
      </div>

      {mensaje && (
        <div className={`p-6 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 duration-300 ${mensaje.includes("❌") ? 'bg-red-50 border border-red-100 text-red-800' : 'bg-green-50 border border-green-100 text-green-800 shadow-sm'}`}>
          <div className="text-2xl">{mensaje.includes("❓") ? "💬" : mensaje.includes("❌") ? "🚫" : "💳"}</div>
          <div className="text-sm font-bold uppercase tracking-wider">{mensaje}</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Lado Izquierdo: Configuración General e Ítems */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Tarjeta de Cliente */}
          <section className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-2 bg-blue-600 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">CLIENTE Y EJECUCIÓN</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Cuenta (Razón Social)</label>
                <select 
                  value={cotizacion.cuenta_id} 
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full h-14 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="">Seleccione Cliente...</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Contacto Directo</label>
                <select 
                  value={cotizacion.contacto_id} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, contacto_id: e.target.value }))}
                  className="w-full h-14 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="">Seleccione Contacto...</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.cargo})</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ÍTEMS DE COTIZACIÓN */}
          <div className="space-y-4">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  ÍTEMS COTIZADOS <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 px-3 py-1 rounded-full text-sm">{(cotizacion.items || []).length}</span>
                </h3>
                <Button onClick={addItem} className="h-12 px-6 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl font-black hover:scale-105 transition-transform">
                  <Plus className="mr-2 h-5 w-5" /> AÑADIR ÍTEM
                </Button>
             </div>

             {(cotizacion.items || []).map((item, idx) => (
                <div key={item.id} className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                  
                  {/* Item Header */}
                  <div className="p-8 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start gap-6">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción Comercial del Producto</label>
                        <Input 
                          value={item.descripcion}
                          onChange={(e) => updateItem(item.id, { descripcion: e.target.value })}
                          className="h-12 bg-white dark:bg-gray-900 border-none font-bold placeholder:text-gray-300"
                          placeholder="Ej: Mochila Corporativa Premium Tech"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría (Propuesta)</label>
                        <select 
                          value={item.categoria_producto}
                          onChange={(e) => updateItem(item.id, { categoria_producto: e.target.value })}
                          className="w-full h-12 bg-white dark:bg-gray-900 border-none rounded-xl px-3 font-bold"
                        >
                          {CATEGORIAS.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Márgen Sugerido (%)</label>
                        <Input 
                          type="number"
                          value={item.margen}
                          onChange={(e) => updateItem(item.id, { margen: Number(e.target.value) })}
                          className="h-12 bg-white dark:bg-gray-900 border-none font-bold text-blue-600 text-center"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => removeItem(item.id)} className="h-12 w-12 text-red-500 hover:bg-red-50 rounded-2xl">
                       <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Detalle Técnico / Propuesta */}
                  <div className="p-8 space-y-8">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       {/* Especificaciones Técnicas */}
                       <div className="space-y-3">
                         <div className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase">
                           <FileText className="h-3 w-3" /> PÁRRAFO DE ESPECIFICACIONES (PARA PROPUESTA)
                         </div>
                         <textarea 
                           value={item.especificaciones_tecnicas}
                           onChange={(e) => updateItem(item.id, { especificaciones_tecnicas: e.target.value })}
                           className="w-full min-h-[140px] p-5 bg-gray-50 dark:bg-gray-800 border-none rounded-3xl text-sm font-medium leading-relaxed"
                           placeholder="Este párrafo aparecerá en la página dedicada del ítem dentro del PDF Premium..."
                         />
                       </div>

                       {/* Gestión de Imágenes Propuesta (4 marcos) */}
                       <div className="space-y-4">
                         <div className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase">
                           <ImageIcon className="h-3 w-3" /> MARCOS DE IMAGEN (1 MINIATURA + 3 MANUALES)
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           {/* Miniatura Principal */}
                           <div className="aspect-square bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center p-2 relative overflow-hidden group">
                                {item.imagen ? (
                                  <img src={item.imagen} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <div className="text-center">
                                    <div className="text-blue-600 font-black text-xs uppercase mb-1">Thumbnail</div>
                                    <ImageIcon className="h-6 w-6 text-blue-300 mx-auto" />
                                  </div>
                                )}
                                <input 
                                  type="file" accept="image/*" 
                                  onChange={(e) => {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => updateItem(item.id, { imagen: ev.target?.result as string });
                                    if (e.target.files?.[0]) reader.readAsDataURL(e.target.files[0]);
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="text-[10px] font-black text-white">SUBIR PRINCIPAL</p>
                                </div>
                                {item.imagen && <div className="absolute top-1 right-1 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">MARCO 1</div>}
                           </div>

                           {/* 3 Marcos Manuales */}
                           {(item.imagenes_secundarias || ["", "", ""]).map((img, iIdx) => (
                             <div key={iIdx} className="aspect-video bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-2 relative overflow-hidden group">
                                {img ? (
                                  <img src={img} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-gray-300" />
                                )}
                                <input 
                                  type="file" accept="image/*" 
                                  onChange={(e) => handleImageUpload(item.id, iIdx, e)}
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-center p-2">
                                  <p className="text-[9px] font-black text-white">MARCO {iIdx + 2}<br/>(TRATAMIENTO AUTO)</p>
                                </div>
                             </div>
                           ))}
                         </div>
                         <p className="text-[10px] text-gray-400 font-medium italic">* Las imágenes se comprimen automáticamente a JPEG Web-Ready para PDF.</p>
                       </div>
                     </div>

                     {/* SubCostos (Proveedores) */}
                     <div className="space-y-4">
                       <div className="flex justify-between items-center">
                          <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Estructura de Costeo (Proveedores)</label>
                          <Button variant="ghost" onClick={() => addSubCosto(item.id)} className="h-8 text-[11px] font-black hover:text-blue-600">
                             + AÑADIR PROVEEDOR / ACCESORIO
                          </Button>
                       </div>
                       <div className="space-y-2">
                         {item.subcostos.map(sc => (
                            <div key={sc.id} className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-gray-50/50 dark:bg-gray-800/20 p-4 rounded-2xl">
                               <div className="flex-1 space-y-1">
                                 <label className="text-[9px] font-bold text-gray-400 uppercase">Proveedor / Detalle Insumo</label>
                                 <Input 
                                   value={sc.proveedor}
                                   onChange={(e) => updateSubCosto(item.id, sc.id, { proveedor: e.target.value })}
                                   className="h-10 bg-white dark:bg-gray-900 border-none font-medium text-xs shadow-sm"
                                   placeholder="Nombre del proveedor o servicio"
                                 />
                               </div>
                               <div className="w-20 space-y-1">
                                 <label className="text-[9px] font-bold text-gray-400 uppercase">Cant.</label>
                                 <Input 
                                   type="number"
                                   value={sc.cantidad}
                                   onChange={(e) => updateSubCosto(item.id, sc.id, { cantidad: Number(e.target.value) })}
                                   className="h-10 bg-white dark:bg-gray-900 border-none font-bold text-xs text-center"
                                 />
                               </div>
                               <div className="w-28 space-y-1">
                                 <label className="text-[9px] font-bold text-gray-400 uppercase">Unit. ($)</label>
                                 <Input 
                                   type="number"
                                   value={sc.precio_unitario}
                                   onChange={(e) => updateSubCosto(item.id, sc.id, { precio_unitario: Number(e.target.value) })}
                                   className="h-10 bg-white dark:bg-gray-900 border-none font-black text-xs text-right text-emerald-600"
                                 />
                               </div>
                               <div className="w-20 space-y-1">
                                 <label className="text-[9px] font-bold text-gray-400 uppercase">Desc. %</label>
                                 <Input 
                                   type="number"
                                   value={sc.descuento}
                                   onChange={(e) => updateSubCosto(item.id, sc.id, { descuento: Number(e.target.value) })}
                                   className="h-10 bg-white dark:bg-gray-900 border-none font-bold text-xs text-center text-red-400"
                                 />
                               </div>
                               <Button variant="ghost" onClick={() => removeSubCosto(item.id, sc.id)} className="h-10 w-10 text-gray-300 hover:text-red-500 pb-0">
                                  <X className="h-4 w-4" />
                               </Button>
                            </div>
                         ))}
                       </div>
                     </div>
                  </div>
                </div>
             ))}
          </div>
        </div>

        {/* Lado Derecho: Resumen Financiero Sticky */}
        <div className="xl:col-span-4 space-y-8">
           <div className="sticky top-8 space-y-6">
              <section className="bg-gray-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-500/10 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 h-40 w-40 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
                
                <h2 className="text-xs font-black tracking-[0.2em] text-blue-400 mb-8 uppercase flex items-center gap-2">
                   <Box className="h-3 w-3" /> Resumen de Oferta
                </h2>

                <div className="space-y-6">
                  <div className="flex justify-between items-end border-b border-white/5 pb-4">
                    <span className="text-gray-400 font-bold text-sm tracking-tight uppercase">Costo Base Industrial</span>
                    <span className="text-xl font-medium tracking-tight">${new Intl.NumberFormat("es-CL").format(cotizacion.costo_total || 0)}</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-b border-white/5 pb-4">
                    <span className="text-gray-400 font-bold text-sm tracking-tight uppercase">Utilidad Estimada</span>
                    <span className="text-xl font-medium tracking-tight text-emerald-400">+ ${new Intl.NumberFormat("es-CL").format(cotizacion.ganancias || 0)}</span>
                  </div>

                  <div className="pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">NETO PROPUESTA</span>
                      <span className="text-gray-400 text-xs font-bold uppercase">IVA (19%)</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-5xl font-black tracking-tighter">${new Intl.NumberFormat("es-CL").format(cotizacion.total_neto || 0)}</h3>
                      <span className="text-gray-500 font-bold italic pt-2">${new Intl.NumberFormat("es-CL").format(cotizacion.iva || 0)}</span>
                    </div>
                  </div>

                  <div className="pt-8 bg-white/5 -mx-10 px-10 py-8 border-t border-white/10">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 block">VALOR TOTAL CON IMPUESTOS</label>
                    <div className="text-4xl font-black text-gray-100 tracking-tighter">${new Intl.NumberFormat("es-CL").format(cotizacion.total || 0)}</div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-4">
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="text-[9px] font-black text-gray-500 uppercase mb-1">MARGEN GLOBAL</div>
                      <div className="text-xl font-black text-blue-400">{cotizacion.mg}</div>
                   </div>
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="text-[9px] font-black text-gray-500 uppercase mb-1">ÍTEMS</div>
                      <div className="text-xl font-black text-white">{(cotizacion.items || []).length}</div>
                   </div>
                </div>
              </section>

              {/* Botones de acción extra */}
              <div className="space-y-3">
                 <Button variant="outline" className="w-full h-14 rounded-2xl border-gray-100 dark:border-gray-800 font-black text-gray-400 text-xs uppercase tracking-widest hover:bg-gray-50 transition-all">
                    <Layers className="mr-2 h-4 w-4" /> VER HISTERIAL DE VERSIONES
                 </Button>
                 <Button variant="outline" className="w-full h-14 rounded-2xl border-gray-100 dark:border-gray-800 font-black text-gray-400 text-xs uppercase tracking-widest hover:bg-gray-50 transition-all">
                    <MousePointer2 className="mr-2 h-4 w-4" /> REPLICAR COTIZACIÓN ANTERIOR
                 </Button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
