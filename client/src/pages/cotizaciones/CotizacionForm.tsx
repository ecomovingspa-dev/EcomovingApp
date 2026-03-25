import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cotizacion, Item, SubCosto, Cuenta, Contacto } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Save, X, Image as ImageIcon, Box, FileText, ChevronDown, ChevronUp, Layers, MousePointer2, ArrowLeft, Copy, Check, ChevronsUpDown } from "lucide-react";
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

  const [openCuenta, setOpenCuenta] = useState(false);
  const [openContacto, setOpenContacto] = useState(false);

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
      subcostos: [{ id: Date.now() + 1, proveedor: "", codigo: "", cantidad: 1, precio_unitario: 0, descuento: 0 }],
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
        subcostos: [...it.subcostos, { id: Date.now(), proveedor: "", codigo: "", cantidad: 1, precio_unitario: 0, descuento: 0 }]
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

  const handleDuplicar = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setMensaje("⏳ Generando duplicado...");
      const { id: _, numero_cotizacion: __, created_at: ___, ...payload } = cotizacion;
      
      // Limpiar IDs de ítems para forzar nuevos
      const newItems = (cotizacion.items || []).map(it => {
        const { id, ...rest } = it;
        return { ...rest };
      });

      const { count } = await supabase.from("cotizaciones").select("*", { count: 'exact', head: true });
      const num = ((count as any) || 0) + 5126;

      const duplicado = {
        ...payload,
        numero_cotizacion: `COT-${num}`,
        estado_cotizacion: "Borrador",
        items: newItems,
        fecha: new Date().toISOString().split("T")[0]
      };

      const { error } = await supabase.from("cotizaciones").insert([duplicado]);
      if (error) throw error;
      
      setMensaje("✅ Cotización duplicada exitosamente");
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err: any) {
      setMensaje("❌ Error al duplicar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-gray-800 pb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="rounded-full h-10 w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight uppercase">
               {id ? `COTIZACIÓN ${cotizacion.numero_cotizacion || ""}` : "NUEVO REQUERIMIENTO COMERCIAL"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Configure los detalles técnicos y financieros de la propuesta.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
           <Button onClick={handleSave} disabled={loading} className="flex-1 md:flex-none h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/10 text-xs">
             {loading ? "PROCESANDO..." : "GUARDAR"}
           </Button>

           {id && (
             <>
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
               
               <Button 
                 variant="outline" 
                 onClick={handleDuplicar} 
                 disabled={loading}
                 className="flex-1 md:flex-none h-10 px-6 border-gray-200 dark:border-gray-800 font-black text-gray-600 dark:text-gray-400 text-xs flex items-center gap-2"
               >
                 <Copy className="h-3.5 w-3.5" /> DUPLICAR COTIZACIÓN
               </Button>
             </>
           )}
        </div>
      </div>

      {mensaje && (
        <div className={`p-6 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 duration-300 ${mensaje.includes("❌") ? 'bg-red-50 border border-red-100 text-red-800' : 'bg-green-50 border border-green-100 text-green-800 shadow-sm'}`}>
          <div className="text-2xl">{mensaje.includes("❓") ? "💬" : mensaje.includes("❌") ? "🚫" : "💳"}</div>
          <div className="text-sm font-bold uppercase tracking-wider">{mensaje}</div>
        </div>
      )}

      <div className="space-y-8 pb-20">
        {/* Lado Superior: Resumen Financiero Compacto */}
        <section className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-500/10 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="absolute -top-10 -right-10 h-40 w-40 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 items-center relative z-10">
            <div className="space-y-1">
              <h2 className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase flex items-center gap-2 mb-2">
                 <Box className="h-3 w-3" /> Resumen Global
              </h2>
              <div className="text-3xl font-black text-gray-100 tracking-tighter">${new Intl.NumberFormat("es-CL").format(cotizacion.total || 0)}</div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Valor Total (Inc. IVA)</p>
            </div>

            <div className="h-full border-l border-white/5 pl-6 hidden lg:block">
              <span className="text-gray-400 font-bold text-[10px] tracking-tight uppercase block mb-1">Costo Industrial</span>
              <span className="text-lg font-medium tracking-tight text-gray-200">${new Intl.NumberFormat("es-CL").format(cotizacion.costo_total || 0)}</span>
            </div>
            
            <div className="h-full border-l border-white/5 pl-6 hidden lg:block">
              <span className="text-gray-400 font-bold text-[10px] tracking-tight uppercase block mb-1">Utilidad (Neto)</span>
              <span className="text-lg font-medium tracking-tight text-emerald-400">+ ${new Intl.NumberFormat("es-CL").format(cotizacion.ganancias || 0)}</span>
            </div>

            <div className="h-full border-l border-white/5 pl-6 hidden lg:block">
              <span className="text-gray-400 font-bold text-[10px] tracking-tight uppercase block mb-1">Margen / Ítems</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-blue-400">{cotizacion.mg}</span>
                <span className="text-gray-600">/</span>
                <span className="text-lg font-bold text-gray-300">{(cotizacion.items || []).length} ítems</span>
              </div>
            </div>

            <div className="lg:pl-6 space-y-1">
              <div className="flex justify-between items-center text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                <span>NETO PROPUESTA</span>
                <span className="text-gray-500">IVA 19%</span>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <h3 className="text-3xl font-black tracking-tighter">${new Intl.NumberFormat("es-CL").format(cotizacion.total_neto || 0)}</h3>
                <span className="text-gray-500 font-bold text-xs italic">${new Intl.NumberFormat("es-CL").format(cotizacion.iva || 0)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Lado Inferior: Configuración e Ítems Full-Width */}
        <div className="space-y-8">
          <style dangerouslySetInnerHTML={{ __html: `
            input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
              -webkit-appearance: none; 
              margin: 0; 
            }
            input[type=number] {
              -moz-appearance: textfield;
            }
          `}} />
          
          <script dangerouslySetInnerHTML={{ __html: `
            function autoResize(el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          `}} />
          
          {/* Tarjeta de Cliente */}
          <section className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-2 bg-blue-600 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">CLIENTE Y EJECUCIÓN</h2>
            </div>
            
            {/* Fila 1: Principales (3 Columnas) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Cuenta (Razón Social)</label>
                <Popover open={openCuenta} onOpenChange={setOpenCuenta}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCuenta}
                      className="w-full h-11 justify-between bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-sm"
                    >
                      {cotizacion.cuenta_id
                        ? cuentas.find((c) => c.id === cotizacion.cuenta_id)?.cliente
                        : "Seleccione Cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 z-[9999]">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>No se encontró el cliente.</CommandEmpty>
                        <CommandGroup>
                          {cuentas.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.cliente}
                              onSelect={() => {
                                handleAccountChange(c.id);
                                setOpenCuenta(false);
                              }}
                              className="text-xs font-bold"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  cotizacion.cuenta_id === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {c.cliente}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contacto Directo</label>
                <Popover open={openContacto} onOpenChange={setOpenContacto}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openContacto}
                      className="w-full h-11 justify-between bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-sm"
                    >
                      {cotizacion.contacto_id
                        ? contactos.find((c) => c.id === cotizacion.contacto_id)?.nombre
                        : "Seleccione Contacto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 z-[9999]">
                    <Command>
                      <CommandInput placeholder="Buscar contacto..." />
                      <CommandList>
                        <CommandEmpty>No se encontró el contacto.</CommandEmpty>
                        <CommandGroup>
                          {contactos.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.nombre}
                              onSelect={() => {
                                setCotizacion(prev => ({ ...prev, contacto_id: c.id }));
                                setOpenContacto(false);
                              }}
                              className="text-xs font-bold"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  cotizacion.contacto_id === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {c.nombre}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Vendedor Asignado</label>
                <select 
                  value={cotizacion.vendedor_id} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, vendedor_id: e.target.value }))}
                  className="w-full h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                >
                  <option value="">Seleccione Vendedor...</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Fila 2: Operativa (5 Columnas) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tiempo de Entrega</label>
                <Input 
                  value={cotizacion.tiempo_entrega} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, tiempo_entrega: e.target.value }))}
                  className="h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-sm"
                  placeholder="Ej: 5 a 10 días"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Validez de Oferta</label>
                <Input 
                  value={cotizacion.validez_oferta} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, validez_oferta: e.target.value }))}
                  className="h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-sm"
                  placeholder="Ej: 30 días"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">N° Orden de Compra</label>
                <Input 
                  value={cotizacion.nro_oc} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, nro_oc: e.target.value }))}
                  className="h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-sm"
                  placeholder="Número OC"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Guía de Despacho</label>
                <Input 
                  value={cotizacion.nro_guia} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, nro_guia: e.target.value }))}
                  className="h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-sm"
                  placeholder="Número de Guía"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">N° Factura</label>
                <Input 
                  value={cotizacion.nro_factura} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, nro_factura: e.target.value }))}
                  className="h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-sm"
                  placeholder="Número de Factura"
                />
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
                  
                  {/* Item Header (Venta y General) Compacto */}
                    <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 relative min-h-[160px]">
                      <Button 
                        variant="ghost" 
                        onClick={() => removeItem(item.id)} 
                        className="absolute top-4 right-4 h-9 w-9 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl z-20 group"
                      >
                         <Trash2 className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
                      </Button>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pr-12">
                        {/* Columna Izquierda 1: Thumbnail de Imagen */}
                        <div className="lg:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Imagen Principal</label>
                          <div className="aspect-square bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-blue-400/50 dark:hover:border-blue-700/50 transition-all shadow-inner">
                            {item.imagen ? (
                              <img src={item.imagen} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-2">
                                <ImageIcon className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Subir Foto</p>
                              </div>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleImageUpload(item.id, -1, e)}
                              className="absolute inset-0 opacity-0 cursor-pointer z-20"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <p className="text-[10px] font-black text-white uppercase tracking-widest">Cambiar</p>
                            </div>
                          </div>
                        </div>

                        {/* Columna Izquierda 2: Descripción Comercial */}
                        <div className="lg:col-span-5 space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción Comercial</label>
                          <textarea 
                            value={item.descripcion}
                            onChange={(e) => updateItem(item.id, { descripcion: e.target.value })}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            className="w-full min-h-[120px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 font-bold placeholder:text-gray-300 rounded-2xl px-5 py-4 resize-none overflow-hidden text-sm leading-relaxed shadow-inner"
                            placeholder="Describe aquí el producto o servicio..."
                            style={{ height: 'auto' }}
                          />
                        </div>

                        {/* Columna Derecha: Bloque de Valores Financieros */}
                        <div className="lg:col-span-5 grid grid-cols-4 gap-2">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center block">Cant.</label>
                             <Input 
                               type="number"
                               value={item.cantidad}
                               onChange={(e) => updateItem(item.id, { cantidad: Number(e.target.value) })}
                               className="h-14 bg-white dark:bg-gray-900 border-none font-black text-center text-blue-600 px-1 text-base shadow-sm"
                             />
                          </div>

                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right block italic">Unit. Venta</label>
                             <div className="h-14 flex items-center justify-end px-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl text-xs font-black text-emerald-600 shadow-sm border border-gray-100/50 dark:border-gray-700/50 leading-none">
                               {(() => {
                                  const costo = (item.subcostos || []).reduce((acc: number, sc: any) => acc + (sc.cantidad * sc.precio_unitario * (1 - (sc.descuento || 0)/100)), 0);
                                  const neto = costo / (1 - (item.margen || 0)/100);
                                  const unit = (item.cantidad || 0) > 0 ? neto / item.cantidad : 0;
                                  return `$${Math.round(unit).toLocaleString("es-CL")}`;
                               })()}
                             </div>
                          </div>

                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right block italic">Subtotal Neto</label>
                             <div className="h-14 flex items-center justify-end px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-black text-emerald-500 shadow-sm leading-none">
                               {(() => {
                                  const costo = (item.subcostos || []).reduce((acc: number, sc: any) => acc + (sc.cantidad * sc.precio_unitario * (1 - (sc.descuento || 0)/100)), 0);
                                  const neto = costo / (1 - (item.margen || 0)/100);
                                  return `$${Math.round(neto).toLocaleString("es-CL")}`;
                               })()}
                             </div>
                          </div>

                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center block">MG %</label>
                             <Input 
                               type="number"
                               value={item.margen}
                               onChange={(e) => updateItem(item.id, { margen: Number(e.target.value) })}
                               className="h-14 bg-white dark:bg-gray-900 border-none font-bold text-blue-500 text-center px-1 text-base shadow-sm"
                             />
                          </div>
                        </div>
                    </div>
                   </div>

                  {/* Pestañas de Item Compactas */}
                  <div className="px-6 pt-3 border-b border-gray-100 dark:border-gray-800 flex gap-6">
                    <button 
                      onClick={() => updateItem(item.id, { _activeTab: 'costos' })}
                      className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${(!item._activeTab || item._activeTab === 'costos') ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                      Costos y Estructura
                    </button>
                    <button 
                      onClick={() => updateItem(item.id, { _activeTab: 'marketing' })}
                      className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${item._activeTab === 'marketing' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                      Marketing y Propuesta
                    </button>
                  </div>

                  <div className="p-5">
                    {(!item._activeTab || item._activeTab === 'costos') ? (
                      <div className="space-y-6 animate-in fade-in duration-300">
                         {/* SECCIÓN COSTOS ESTILIZADA */}
                         <div className="space-y-2">
                            <div className="flex justify-between items-center mb-4">
                               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                 <Plus className="h-3 w-3" /> ESTRUCTURA DE COSTOS
                               </h4>
                               <Button variant="outline" size="sm" onClick={() => addSubCosto(item.id)} className="h-8 px-3 rounded-lg font-bold border-dashed text-[9px]">
                                 + AÑADIR COSTO
                               </Button>
                            </div>
                            
                            {/* Header de Columnas Subcostos */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 mb-1">
                               <div className="md:col-span-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Proveedor / Detalle</div>
                               <div className="md:col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Código SKU</div>
                               <div className="md:col-span-1 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Cant.</div>
                               <div className="md:col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Unit. ($)</div>
                               <div className="md:col-span-1 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Desc %</div>
                               <div className="md:col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Subtotal</div>
                               <div className="md:col-span-1"></div>
                            </div>

                            <div className="space-y-1">
                               {(item.subcostos || []).map(sc => (
                                 <div key={sc.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50/30 dark:bg-gray-800/10 p-2 px-4 rounded-xl border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 hover:bg-blue-50/30 transition-all group">
                                    <div className="md:col-span-3">
                                      <Input 
                                        value={sc.proveedor}
                                        onChange={(e) => updateSubCosto(item.id, sc.id, { proveedor: e.target.value })}
                                        className="h-9 bg-white dark:bg-gray-900 border-none font-medium text-xs shadow-none px-2 focus:ring-1 focus:ring-blue-500"
                                        placeholder="Nombre..."
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <Input 
                                        value={sc.codigo}
                                        onChange={(e) => updateSubCosto(item.id, sc.id, { codigo: e.target.value })}
                                        className="h-9 bg-white dark:bg-gray-900 border-none font-black text-[10px] text-blue-400 px-2 uppercase shadow-none"
                                        placeholder="SKU"
                                      />
                                    </div>
                                    <div className="md:col-span-1">
                                      <Input 
                                        type="number"
                                        value={sc.cantidad}
                                        onChange={(e) => updateSubCosto(item.id, sc.id, { cantidad: Number(e.target.value) })}
                                        className="h-9 bg-white dark:bg-gray-900 border-none font-bold text-xs text-center shadow-none"
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <Input 
                                        type="number"
                                        value={sc.precio_unitario}
                                        onChange={(e) => updateSubCosto(item.id, sc.id, { precio_unitario: Number(e.target.value) })}
                                        className="h-9 bg-white dark:bg-gray-900 border-none font-black text-xs text-right text-emerald-600 px-2 shadow-none"
                                      />
                                    </div>
                                    <div className="md:col-span-1">
                                      <Input 
                                        type="number"
                                        value={sc.descuento}
                                        onChange={(e) => updateSubCosto(item.id, sc.id, { descuento: Number(e.target.value) })}
                                        className="h-9 bg-white dark:bg-gray-900 border-none font-bold text-xs text-center text-red-400 px-1 shadow-none"
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <div className="h-9 flex items-center justify-end px-2 text-xs font-black text-gray-500">
                                        ${Math.round((sc.cantidad || 0) * (sc.precio_unitario || 0) * (1 - (sc.descuento || 0)/100)).toLocaleString("es-CL")}
                                      </div>
                                    </div>
                                    <div className="md:col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button variant="ghost" onClick={() => removeSubCosto(item.id, sc.id)} className="h-8 w-8 text-gray-300 hover:text-red-500 p-0">
                                         <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="animate-in slide-in-from-left-4 duration-500 space-y-8">
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                           {/* Especificaciones Técnicas */}
                           <div className="space-y-4">
                             <div className="flex justify-between items-center">
                               <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                 <FileText className="h-3 w-3" /> PÁRRAFO DE ESPECIFICACIONES
                               </div>
                               <div className="w-48">
                                 <select 
                                   value={item.categoria_producto}
                                   onChange={(e) => updateItem(item.id, { categoria_producto: e.target.value })}
                                   className="w-full h-8 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-none rounded-lg px-2 text-[9px] font-black uppercase"
                                 >
                                   {CATEGORIAS.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
                                 </select>
                               </div>
                             </div>
                             <textarea 
                               value={item.especificaciones_tecnicas}
                               onChange={(e) => updateItem(item.id, { especificaciones_tecnicas: e.target.value })}
                               className="w-full min-h-[160px] p-5 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-medium leading-relaxed"
                               placeholder="Detalles sobre materiales, impresión, etc..."
                             />
                           </div>

                           {/* Bilder Marketing */}
                           <div className="space-y-4">
                             <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                               <ImageIcon className="h-3 w-3" /> MARCOS DE IMAGEN (PROPUESTA)
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                               {/* 3 Marcos Manuales */}
                               {(item.imagenes_secundarias || ["", "", ""]).map((img, iIdx) => (
                                 <div key={iIdx} className="aspect-video bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-2 relative overflow-hidden group">
                                    {img ? (
                                      <img src={img} className="w-full h-full object-cover rounded-xl" />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-gray-300" />
                                    )}
                                    <input 
                                      type="file" accept="image/*" 
                                      onChange={(e) => handleImageUpload(item.id, iIdx, e)}
                                      className="absolute inset-0 opacity-0 cursor-pointer" 
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-center px-1">
                                      <p className="text-[8px] font-black text-white uppercase">M{iIdx + 2}</p>
                                    </div>
                                    {img && <div className="absolute top-1 right-1 bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">Slot {iIdx+2}</div>}
                                 </div>
                               ))}
                             </div>
                           </div>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
