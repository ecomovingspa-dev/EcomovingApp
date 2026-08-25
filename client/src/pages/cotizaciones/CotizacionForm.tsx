import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cotizacion, Item, SubCosto, Cuenta, Contacto } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Save, X, Image as ImageIcon, Box, FileText, ChevronDown, ChevronUp, Layers, MousePointer2, ArrowLeft, Copy, Check, ChevronsUpDown, FolderOpen, Package, Lock, Unlock } from "lucide-react";
import BotonExportarPDF from "./CotizacionPDF";
import PackingPage from "../logistica/PackingPage";

interface CotizacionFormProps {
  id?: string;
  cuentaId?: string;
  contactoId?: string;
  onClose?: () => void;
  onSave?: () => void;
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
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId || paramId;
  
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);

  const [cotizacion, setCotizacion] = useState<Partial<Cotizacion>>({
    estado_cotizacion: "Pendiente",
    cuenta_id: cuentaId,
    contacto_id: contactoId,
    items: [],
    costo_total: 0,
    total_neto: 0,
    iva: 0,
    total: 0,
    ganancias: 0,
    condicion_pago: "Ninguno",
    tasa_financiamiento: 0,
    fecha: new Date().toISOString().split("T")[0],
  });

  const [openCuenta, setOpenCuenta] = useState(false);
  const [openContacto, setOpenContacto] = useState(false);
  const [cuentaSearch, setCuentaSearch] = useState("");
  const [contactoSearch, setContactoSearch] = useState("");

  /**
   * Motor de Estados Automático de Ecomoving
   * Prioridad: Factura > Guía > OC > Tiempo (60 días) > Pendiente
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

  const buscarCuentas = async (search: string, explicitId?: string) => {
    try {
      let query = supabase.from("cuentas").select("id, cliente").order("cliente").limit(100);
      if (search) {
        query = query.ilike("cliente", `%${search}%`);
      }
      const { data } = await query;
      let finalData = data || [];

      // Si tenemos un ID explícito (ej: de la cotización cargada) y no está en los 100 primeros, lo traemos
      if (explicitId && !finalData.some(c => c.id === explicitId)) {
        const { data: specific } = await supabase.from("cuentas").select("id, cliente").eq("id", explicitId).single();
        if (specific) finalData = [specific, ...finalData];
      }

      setCuentas(finalData);
    } catch (err) {
      console.error(err);
    }
  };

  const buscarContactos = async (search: string) => {
    try {
      const cid = cotizacion.cuenta_id;
      if (!cid && !search) return;
      let query = supabase.from("contactos").select("id, nombre, cuenta_id").order("nombre").limit(100);
      
      if (cid) {
        query = query.eq("cuenta_id", cid);
      }
      
      if (search) {
        query = query.ilike("nombre", `%${search}%`);
      }
      
      const { data } = await query;
      setContactos(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      buscarCuentas(cuentaSearch, cotizacion.cuenta_id);
    }, 300);
    return () => clearTimeout(timer);
  }, [cuentaSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      buscarContactos(contactoSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactoSearch, cotizacion.cuenta_id]);

  useEffect(() => {
    cargarDatosIniciales();
    if (id) cargarCotizacion();
  }, [id]);

  const cargarDatosIniciales = async () => {
    try {
      const [{ data: ctas }, { data: vends }] = await Promise.all([
        supabase.from("cuentas").select("id, cliente").order("cliente").limit(10000),
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
    // Validar que el ID sea un UUID válido o al menos no sea una palabra reservada o undefined
    if (!id || id === 'nueva' || id === 'undefined' || id.length < 5) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(`
          *,
          vendedores:vendedores!cotizaciones_vendedor_id_fkey (nombre, correo, celular)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      
      // Forzar candado (precio_fijo: true) en todos los ítems de cotizaciones existentes
      if (data && data.items) {
        data.items = data.items.map((it: any) => ({
          ...it,
          precio_fijo: true
        }));
      }

      // Asegurar defaults para campos de financiamiento si la DB los retorna nulos
      // (cotizaciones creadas antes de la migración ADD_FINANCIAMIENTO_COLUMNS.sql)
      if (!data.condicion_pago) data.condicion_pago = "Ninguno";
      if (data.tasa_financiamiento === null || data.tasa_financiamiento === undefined) {
        data.tasa_financiamiento = 0;
      }
      
      setCotizacion(data);
      
      // Aseguramos que el cliente de la cotización esté cargado en la lista
      if (data.cuenta_id) {
        buscarCuentas("", data.cuenta_id);
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
    setCotizacion(prev => ({
      ...prev,
      items: (prev.items || []).filter(it => it.id !== iid)
    }));
  };

  const duplicateItem = (item: any) => {
    const newItem = {
      ...item,
      id: Date.now() + Math.random(),
      subcostos: (item.subcostos || []).map((sc: any) => ({ ...sc, id: Math.random() }))
    };
    setCotizacion(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const updateItem = (iid: number, updates: Partial<Item>) => {
    setCotizacion(prev => ({
      ...prev,
      items: (prev.items || []).map(it => it.id === iid ? { ...it, ...updates } : it)
    }));
  };

  const addSubCosto = (iid: number) => {
    setCotizacion(prev => {
      const items = (prev.items || []).map(it => {
        if (it.id !== iid) return it;
        
        const oldCosto = it.subcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
        const netoBruto = oldCosto > 0 ? oldCosto / (1 - (it.margen || 0) / 100) : 0;
        
        const newSubcostos = [...it.subcostos, { id: Date.now(), proveedor: "", codigo: "", cantidad: 1, precio_unitario: 0, descuento: 0 }];
        const newCosto = newSubcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
        
        let newMargen = it.margen;
        if (it.precio_fijo && netoBruto > 0) {
           newMargen = 100 * (1 - newCosto / netoBruto);
        }
        
        return {
          ...it,
          subcostos: newSubcostos,
          margen: it.precio_fijo ? parseFloat(newMargen.toFixed(2)) : it.margen
        };
      });
      return { ...prev, items };
    });
  };

  const updateSubCosto = (iid: number, sid: number, updates: Partial<SubCosto>) => {
    setCotizacion(prev => {
      const items = (prev.items || []).map(it => {
        if (it.id !== iid) return it;
        
        const oldCosto = it.subcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
        const netoBruto = oldCosto > 0 ? oldCosto / (1 - (it.margen || 0) / 100) : 0;
        
        const newSubcostos = it.subcostos.map(sc => sc.id === sid ? { ...sc, ...updates } : sc);
        const newCosto = newSubcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
        
        let newMargen = it.margen;
        if (it.precio_fijo && netoBruto > 0) {
           newMargen = 100 * (1 - newCosto / netoBruto);
        }
        
        return {
          ...it,
          subcostos: newSubcostos,
          margen: it.precio_fijo ? parseFloat(newMargen.toFixed(2)) : it.margen
        };
      });
      return { ...prev, items };
    });
  };

  const removeSubCosto = (iid: number, sid: number) => {
    setCotizacion(prev => {
      const items = (prev.items || []).map(it => {
        if (it.id !== iid) return it;
        
        const oldCosto = it.subcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
        const netoBruto = oldCosto > 0 ? oldCosto / (1 - (it.margen || 0) / 100) : 0;
        
        const newSubcostos = it.subcostos.filter(sc => sc.id !== sid);
        const newCosto = newSubcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
        
        let newMargen = it.margen;
        if (it.precio_fijo && netoBruto > 0) {
           newMargen = 100 * (1 - newCosto / netoBruto);
        }
        
        return {
          ...it,
          subcostos: newSubcostos,
          margen: it.precio_fijo ? parseFloat(newMargen.toFixed(2)) : it.margen
        };
      });
      return { ...prev, items };
    });
  };

  // Cálculos Automáticos
  useEffect(() => {
    // GUARDRAIL RELAJADO @protocolo: El candado de "precio_fijo" a nivel de ítem ahora
    // se encarga de proteger el precio de venta. Permitimos recalcular aquí para que
    // la conciliación refleje los nuevos costos, ganancias y márgenes en el dashboard.

    const items = cotizacion.items || [];
    const condicionPago = cotizacion.condicion_pago || "Ninguno";
    const tasaFinanciamiento = Number(cotizacion.tasa_financiamiento || 0);

    let costoTotal = 0;
    let totalNeto = 0;
    let totalNetoOriginal = 0;

    items.forEach(it => {
      const costoItem = it.subcostos.reduce((acc, sc) => acc + (sc.cantidad * sc.precio_unitario * (1 - sc.descuento / 100)), 0);
      costoTotal += costoItem;
      
      let netoItemBruto = costoItem / (1 - (it.margen || 0) / 100);
      let netoOriginalItem = (it.cantidad > 0 ? Math.round(netoItemBruto / it.cantidad) : 0) * it.cantidad;
      totalNetoOriginal += netoOriginalItem;

      // Aplicar recargos o descuentos financieros de forma global a todos los ítems (coherente con PDF)
      if (condicionPago === "Factoring") {
        // Traspasar el costo del factoring al precio final neto (considerando IVA 1.19)
        const efectoNetoFactoring = (tasaFinanciamiento / 100) * 1.19;
        netoItemBruto = costoItem / (1 - ((it.margen || 0) / 100 + efectoNetoFactoring));
      } else if (condicionPago === "Contado") {
        // Aplicar descuento por pago al contado
        netoItemBruto = netoItemBruto * (1 - (tasaFinanciamiento / 100));
      }
      
      const unitarioItem = it.cantidad > 0 ? Math.round(netoItemBruto / it.cantidad) : 0;
      const netoItem = unitarioItem * it.cantidad;
      
      totalNeto += netoItem;
    });

    let costoFactoringNeto = 0;
    let descuentoContadoNeto = 0;

    if (condicionPago === "Factoring") {
      // El factoring se descuenta del total bruto facturado:
      // costoFactoringBruto = (totalNeto * 1.19) * (tasaFinanciamiento / 100)
      // costoFactoringNeto (impacto en utilidad neta) = costoFactoringBruto / 1.19
      costoFactoringNeto = totalNeto * (tasaFinanciamiento / 100);
    } else if (condicionPago === "Contado") {
      // El descuento contado es la diferencia entre el neto original y el neto final
      descuentoContadoNeto = totalNetoOriginal - totalNeto;
    }

    const iva = totalNeto * 0.19;
    const total = totalNeto + iva;
    
    // Utilidad Real Neto = ingreso neto final - costos de compra - costos financieros
    const ganancias = totalNeto - costoTotal - costoFactoringNeto;

    setCotizacion(prev => ({
      ...prev,
      costo_total: Math.round(costoTotal),
      total_neto: Math.round(totalNeto),
      iva: Math.round(iva),
      total: Math.round(total),
      ganancias: Math.round(ganancias),
      costo_factoring: Math.round(costoFactoringNeto),
      descuento_contado: Math.round(descuentoContadoNeto),
      mg: totalNeto > 0 ? (ganancias / totalNeto * 100).toFixed(1) + "%" : "0%"
    }));
  }, [JSON.stringify(cotizacion.items), cotizacion.condicion_pago, cotizacion.tasa_financiamiento]);

  // Autoguardado silencioso para fondo
  const autoSaveToSupabase = async () => {
    if (!id) return;
    try {
      const payload = { ...cotizacion } as any;
      delete payload.cuentas;
      delete payload.contactos;
      delete payload.vendedores; // Limpiar para evitar error de relación
      delete payload.fecha; // ELMINAR FECHA hasta que se agregue a la DB
      // condicion_pago y tasa_financiamiento SÍ se persisten (columnas en DB)
      delete payload.costo_factoring;   // campo calculado, no en DB
      delete payload.descuento_contado; // campo calculado, no en DB

      await supabase.from("cotizaciones").update(payload).eq("id", id);
      console.log("Autoguardado completado...");
    } catch (e) {
      console.error("Error silencioso en autoguardado:", e);
    }
  };

  // Efecto de Autoguardado y Backup Local
  useEffect(() => {
    if (!id || (cotizacion.items?.length || 0) === 0) return;
    
    // GUARDRAIL @protocolo: No autoguardar si está en un estado final
    if (["Facturada", "Despachada", "Producción"].includes(cotizacion.estado_cotizacion || "")) return;
    
    const timer = setTimeout(() => {
       autoSaveToSupabase();
       // Respaldo secundario en el navegador
       localStorage.setItem(`quote-${id}`, JSON.stringify(cotizacion));
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [JSON.stringify(cotizacion)]);
  
  // Trigger de Estado Automático (v2.1)

  const handleSave = async (silent = false) => {
    if (!cotizacion.cuenta_id && !silent) {
      setMensaje("⚠️ Por favor selecciona un Cliente (Cuenta).");
      return;
    }

    if (!silent) {
       setLoading(true);
       setMensaje("");
    }

    try {
      const estadoCalculado = obtenerEstadoAutomatico(cotizacion);
      const payload = { 
        ...cotizacion, 
        estado_cotizacion: estadoCalculado 
      } as any;
      // Limpieza de objetos de relación que Supabase rechazaría en UPDATE directo
      delete payload.cuentas;
      delete payload.contactos;
      delete payload.vendedores;
      delete payload.fecha; // REMOVER FECHA: El esquema no la soporta aún
      // condicion_pago y tasa_financiamiento SÍ se persisten (columnas en DB)
      delete payload.costo_factoring;   // campo calculado, no en DB
      delete payload.descuento_contado; // campo calculado, no en DB

      let error;
      if (id) {
        const { error: err } = await supabase.from("cotizaciones").update(payload).eq("id", id);
        error = err;
      } else {
        // En teoría handleNueva ya creó el registro, pero por si acaso:
        const { count } = await supabase.from("cotizaciones").select("id", { count: 'exact', head: true });
        const num = (count || 0) + 5126;
        if (!payload.numero_cotizacion) {
           payload.numero_cotizacion = `COT-2026-${num}`;
        }
        const { error: err } = await supabase.from("cotizaciones").insert([payload]);
        error = err;
      }

      if (error) {
        // Si el error es de columna faltante (ej. mg, ganancias, etc), intentamos salvar solo items y totales
        if (error.message.includes("column") || error.message.includes("schema")) {
           console.warn("Error de esquema detectado. Reintentando guardado simplificado...");
           const basePayload = { 
              items: payload.items, 
              total: payload.total,
              total_neto: payload.total_neto,
              numero_cotizacion: payload.numero_cotizacion,
              cuenta_id: payload.cuenta_id
           };
           await supabase.from("cotizaciones").update(basePayload).eq("id", id);
        } else {
           throw error;
        }
      }

      if (!silent) {
        setMensaje("✅ Cotización guardada exitosamente");
        // Limpiamos backup local al guardar manual con éxito
        localStorage.removeItem(`quote-${id}`);
        setTimeout(() => {
          onSave();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      if (!silent) setMensaje("❌ Error al guardar: " + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const processImageFile = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 320; // Protocolo v2.1: Optimizado para alta resolución (Retina/PDF) y rendimiento de DB
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Exportar a JPEG de alta fidelidad optimizado
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        callback(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (iid: number, index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processImageFile(file, (dataUrl) => {
      if (index === -1) {
        updateItem(iid, { imagen: dataUrl });
      } else {
        const item = cotizacion.items?.find(it => it.id === iid);
        if (item) {
          const imgs = [...(item.imagenes_secundarias || ["", "", ""])];
          imgs[index] = dataUrl;
          updateItem(iid, { imagenes_secundarias: imgs });
        }
      }
    });
  };

  const handlePaste = (iid: number, index: number, e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file, (dataUrl) => {
            if (index === -1) {
              updateItem(iid, { imagen: dataUrl });
            } else {
              const item = cotizacion.items?.find(it => it.id === iid);
              if (item) {
                const imgs = [...(item.imagenes_secundarias || ["", "", ""])];
                imgs[index] = dataUrl;
                updateItem(iid, { imagenes_secundarias: imgs });
              }
            }
          });
        }
        break;
      }
    }
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

      // Limpiar relaciones que Supabase rechazaría en insert
      delete (payload as any).vendedores;
      delete (payload as any).cuentas;
      delete (payload as any).contactos;

      const { count } = await supabase.from("cotizaciones").select("*", { count: 'exact', head: true });
      const num = ((count as any) || 0) + 5126;

      const duplicado = {
        ...payload,
        numero_cotizacion: `COT-${num}`,
        estado_cotizacion: "Pendiente",
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight uppercase">
                 {id ? `COTIZACIÓN ${cotizacion.numero_cotizacion || ""}` : "NUEVO REQUERIMIENTO COMERCIAL"}
              </h1>
              {id && (
                <span 
                  className={cn(
                    "ml-2 px-3 py-1 text-[10px] rounded-full uppercase font-black tracking-widest border-2 transition-all",
                    (() => {
                      const est = obtenerEstadoAutomatico(cotizacion);
                      return est === "Facturada" ? "bg-emerald-600 border-emerald-600 text-white" :
                             est === "Despachada" ? "bg-purple-600 border-purple-600 text-white" :
                             est === "Producción" ? "bg-blue-600 border-blue-600 text-white" :
                             est === "Perdida" ? "bg-red-600 border-red-600 text-white" :
                             "bg-amber-100 border-amber-400 text-amber-700";
                    })()
                  )}
                >
                  {obtenerEstadoAutomatico(cotizacion)}
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Configure los detalles técnicos y financieros de la propuesta.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
           <Button onClick={() => handleSave()} disabled={loading} className="flex-1 md:flex-none h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/10 text-xs">
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
               
               <Button 
                 variant="outline" 
                 onClick={() => setShowPackingModal(true)}
                 className="flex-1 md:flex-none h-10 px-6 border-gray-200 dark:border-gray-800 font-black text-gray-600 dark:text-gray-400 text-xs flex items-center gap-2"
               >
                 <Package className="h-4 w-4" /> PACKING
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-center relative z-10">
            {/* RESUMEN COSTOS (IZQUIERDA) */}
            <div className="space-y-2 border-r border-white/5 pr-4">
              <div className="flex justify-between items-center text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">
                <span>COSTO OPERATIVO</span>
                <span className="text-gray-500">NETO / IVA</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-4xl font-black tracking-tighter text-gray-100 italic">
                  ${new Intl.NumberFormat("es-CL").format(Math.round((cotizacion.costo_total || 0) * 1.19))}
                </h3>
                <div className="flex flex-col text-sm font-black text-gray-400 leading-tight space-y-1 text-right">
                   <div>${Math.round(cotizacion.costo_total || 0).toLocaleString("es-CL")}</div>
                   <div>${Math.round((cotizacion.costo_total || 0) * 0.19).toLocaleString("es-CL")}</div>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Total Inversión (Bruto)</p>
            </div>

            {/* UTILIDAD CENTRAL */}
            <div className="lg:pl-6 text-center lg:text-left flex flex-col justify-center h-full">
              <span className="text-gray-500 font-black text-[11px] tracking-widest uppercase block mb-1">Utilidad Estimada</span>
              <span className="text-3xl font-black tracking-tight text-emerald-400">+ ${new Intl.NumberFormat("es-CL").format(cotizacion.ganancias || 0)}</span>
              <div className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter mt-1">
                <span>Resultado Neto de Operación</span>
                {cotizacion.condicion_pago === "Factoring" && (
                  <span className="text-red-400 block font-black mt-0.5">
                    (Gasto Factoring: -${Math.round(cotizacion.costo_factoring || 0).toLocaleString("es-CL")} Neto)
                  </span>
                )}
              </div>
            </div>
            
            {/* MARGEN COMERCIAL CENTRAL */}
            <div className="h-full border-l border-white/5 lg:pl-8 hidden lg:flex flex-col justify-center items-center lg:items-start">
              <span className="text-gray-500 font-black text-[11px] tracking-widest uppercase block mb-1">Margen Comercial</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-blue-500">{cotizacion.mg}</span>
                <span className="text-[10px] font-bold text-gray-600">RENTABILIDAD</span>
              </div>
            </div>

            {/* RESUMEN VENTAS (DERECHA) */}
            <div className="lg:pl-8 space-y-2 border-l border-white/5">
              <div className="flex justify-between items-center text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                <span>OFERTA COMERCIAL</span>
                <span className="text-gray-500">NETO / IVA</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-4xl font-black tracking-tighter text-gray-100 italic">
                  ${new Intl.NumberFormat("es-CL").format(cotizacion.total || 0)}
                </h3>
                <div className="flex flex-col text-sm font-black text-gray-400 leading-tight space-y-1 text-right">
                   <div>${Math.round(cotizacion.total_neto || 0).toLocaleString("es-CL")}</div>
                   <div>${Math.round(cotizacion.iva || 0).toLocaleString("es-CL")}</div>
                </div>
              </div>
              <div className="flex flex-col text-[10px] font-bold text-gray-600 uppercase tracking-widest text-right leading-snug">
                <span>Total Propuesta (Bruto)</span>
                {cotizacion.condicion_pago === "Factoring" && (
                  <span className="text-blue-400 font-black">
                    Líquido Día 1: ${new Intl.NumberFormat("es-CL").format(Math.round((cotizacion.total || 0) * (1 - (cotizacion.tasa_financiamiento || 0) / 100)))}
                  </span>
                )}
                {cotizacion.condicion_pago === "Contado" && Number(cotizacion.tasa_financiamiento || 0) > 0 && (
                  <span className="text-amber-400 font-black">
                    Descuento Aplicado: -${new Intl.NumberFormat("es-CL").format(Math.round((cotizacion.descuento_contado || 0) * 1.19))}
                  </span>
                )}
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
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-2 bg-blue-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">CLIENTE Y EJECUCIÓN</h2>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">FECHA:</label>
                  <input 
                    type="date"
                    value={cotizacion.fecha || ""}
                    onChange={(e) => setCotizacion(prev => ({ ...prev, fecha: e.target.value }))}
                    className="bg-transparent border-none text-[11px] font-black text-blue-600 focus:ring-0 p-0 w-28 uppercase"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">ID MERCADO:</label>
                  <input 
                    type="text"
                    value={cotizacion.id_mercado_publico || ""}
                    onChange={(e) => setCotizacion(prev => ({ ...prev, id_mercado_publico: e.target.value }))}
                    placeholder="ID Licitación"
                    className="bg-transparent border-none text-[11px] font-black text-blue-600 focus:ring-0 p-0 w-32 placeholder:text-gray-300 uppercase"
                  />
                </div>
              </div>
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
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar cliente..." 
                        value={cuentaSearch}
                        onValueChange={setCuentaSearch}
                      />
                      <CommandList className="max-h-[400px] overflow-y-auto">
                        <CommandEmpty>No se encontró el cliente.</CommandEmpty>
                        <CommandGroup heading="Resultados">
                          {cuentas.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                handleAccountChange(c.id);
                                setOpenCuenta(false);
                                setCuentaSearch("");
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
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar contacto..." 
                        value={contactoSearch}
                        onValueChange={setContactoSearch}
                      />
                      <CommandList className="max-h-[400px] overflow-y-auto">
                        <CommandEmpty>No se encontró el contacto.</CommandEmpty>
                        <CommandGroup heading="Resultados">
                          {contactos.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                setCotizacion(prev => ({ ...prev, contacto_id: c.id }));
                                setOpenContacto(false);
                                setContactoSearch("");
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

            {/* Fila 3: Configuración Financiera (Factoring & Descuentos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Condición de Pago / Financiamiento</label>
                <select 
                  value={cotizacion.condicion_pago || "Ninguno"} 
                  onChange={(e) => setCotizacion(prev => ({ ...prev, condicion_pago: e.target.value, tasa_financiamiento: 0 }))}
                  className="w-full h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all text-sm cursor-pointer"
                >
                  <option value="Ninguno">Ninguno (Estándar)</option>
                  <option value="Factoring">Factoring (Crédito a Clientes)</option>
                  <option value="Contado">Pago al Contado (Pronto Pago)</option>
                </select>
              </div>

              {(cotizacion.condicion_pago === "Factoring" || cotizacion.condicion_pago === "Contado") && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    {cotizacion.condicion_pago === "Factoring" ? "Tasa Factoring Estimada (%)" : "Porcentaje Descuento Contado (%)"}
                  </label>
                  <div className="relative">
                    <Input 
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={cotizacion.tasa_financiamiento || ""} 
                      onChange={(e) => setCotizacion(prev => ({ ...prev, tasa_financiamiento: parseFloat(e.target.value) || 0 }))}
                      className="h-11 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 font-bold text-sm pr-8"
                      placeholder="Ej: 3.5"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs text-gray-400">%</span>
                  </div>
                </div>
              )}
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
                <div 
                  key={item.id} 
                  onPaste={(e) => handlePaste(item.id, -1, e)}
                  className="bg-white dark:bg-gray-900 rounded-[2.5rem] md:rounded-[20px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-500" 
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  
                  {/* Item Header (Venta y General) Compacto */}
                    <div className="p-5 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 relative">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pr-12">
                        {/* Columna Izquierda 1: Thumbnail de Imagen */}
                        <div className="lg:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Imagen Principal</label>
                          <div 
                            className="aspect-square bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400/50 dark:hover:border-blue-700/50 transition-all shadow-inner outline-none"
                          >
                            {item.imagen ? (
                              <img src={item.imagen} className="w-full h-full object-contain p-1" />
                            ) : (
                              <div className="text-center p-2">
                                <ImageIcon className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter italic">Ctrl+V para Pegar</p>
                              </div>
                            )}
                            
                            {/* Botón Flotante para Explorador (Solo si realmente quieren ir a buscar al PC) */}
                            <label className="absolute bottom-2 right-2 p-2 bg-gray-900/60 hover:bg-gray-900/80 rounded-xl cursor-pointer opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 z-20">
                              <FolderOpen className="h-4 w-4 text-white" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleImageUpload(item.id, -1, e)}
                                className="hidden"
                              />
                            </label>

                            <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              <p className="text-[10px] font-black text-white uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">Ctrl + V</p>
                            </div>
                          </div>
                        </div>

                        {/* Columna Izquierda 2: Descripción Comercial */}
                        <div className="lg:col-span-10 lg:col-start-3 xl:col-span-5 xl:col-start-3 space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción Comercial</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-gray-300 uppercase">Propuesta:</span>
                              <select 
                                value={item.categoria_producto}
                                onChange={(e) => updateItem(item.id, { categoria_producto: e.target.value })}
                                className="bg-transparent text-indigo-500 font-black text-[10px] uppercase border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors"
                              >
                                {CATEGORIAS.map(cat => (
                                  <option key={cat.id} value={cat.id} className="text-gray-900 bg-white">
                                    {cat.icon} {cat.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <textarea 
                            value={item.descripcion}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = el.scrollHeight + 'px';
                              }
                            }}
                            onChange={(e) => updateItem(item.id, { descripcion: e.target.value })}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            className="w-full min-h-[100px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 font-bold placeholder:text-gray-300 rounded-2xl px-5 py-3 resize-none overflow-hidden text-sm leading-relaxed shadow-inner"
                            placeholder="Describe aquí el producto o servicio..."
                          />
                        </div>

                        {/* Columna Derecha: Bloque de Valores Financieros y Acciones */}
                        <div className="lg:col-span-5 space-y-4 pt-1">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center block">Cant.</label>
                               <Input 
                                 type="number"
                                 value={item.cantidad}
                                 onChange={(e) => updateItem(item.id, { cantidad: Number(e.target.value) })}
                                 className="h-12 bg-white dark:bg-gray-900 border-none font-black text-center text-blue-600 px-1 text-sm shadow-sm"
                               />
                            </div>

                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right block italic">Unit. Venta</label>
                               <div 
                                 onClick={() => updateItem(item.id, { precio_fijo: !item.precio_fijo })}
                                 className="h-12 flex items-center justify-between px-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl text-[11px] font-black text-emerald-600 shadow-sm border border-gray-100/50 dark:border-gray-700/50 leading-none cursor-pointer group transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                 title={item.precio_fijo ? "Precio bloqueado: El margen absorberá cambios en los costos" : "Precio libre: Cambios en el costo modificarán el precio de venta"}
                               >
                                 {item.precio_fijo ? <Lock className="h-3.5 w-3.5 text-red-400" /> : <Unlock className="h-3.5 w-3.5 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity" />}
                                 <span>
                                 {(() => {
                                     const costo = (item.subcostos || []).reduce((acc: number, sc: any) => acc + (sc.cantidad * sc.precio_unitario * (1 - (sc.descuento || 0)/100)), 0);
                                     let netoBruto = costo / (1 - (item.margen || 0)/100);
                                     const tasaFinanciamiento = Number(cotizacion.tasa_financiamiento || 0);
                                     if (cotizacion.condicion_pago === "Factoring") {
                                       const efectoNetoFactoring = (tasaFinanciamiento / 100) * 1.19;
                                       netoBruto = costo / (1 - ((item.margen || 0) / 100 + efectoNetoFactoring));
                                     } else if (cotizacion.condicion_pago === "Contado") {
                                       netoBruto = netoBruto * (1 - (tasaFinanciamiento / 100));
                                     }
                                     const unit = (item.cantidad || 0) > 0 ? Math.round(netoBruto / item.cantidad) : 0;
                                     return `$${unit.toLocaleString("es-CL")}`;
                                  })()}
                                 </span>
                               </div>
                            </div>

                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right block italic">Subtotal Neto</label>
                               <div className="h-12 flex items-center justify-end px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] font-black text-emerald-500 shadow-sm leading-none">
                                 {(() => {
                                    const costo = (item.subcostos || []).reduce((acc: number, sc: any) => acc + (sc.cantidad * sc.precio_unitario * (1 - (sc.descuento || 0)/100)), 0);
                                    let netoBruto = costo / (1 - (item.margen || 0)/100);
                                    const tasaFinanciamiento = Number(cotizacion.tasa_financiamiento || 0);
                                    if (cotizacion.condicion_pago === "Factoring") {
                                      const efectoNetoFactoring = (tasaFinanciamiento / 100) * 1.19;
                                      netoBruto = costo / (1 - ((item.margen || 0) / 100 + efectoNetoFactoring));
                                    } else if (cotizacion.condicion_pago === "Contado") {
                                      netoBruto = netoBruto * (1 - (tasaFinanciamiento / 100));
                                    }
                                    const unit = (item.cantidad || 0) > 0 ? Math.round(netoBruto / item.cantidad) : 0;
                                    const subtotalItem = unit * (item.cantidad || 0);
                                    return `$${subtotalItem.toLocaleString("es-CL")}`;
                                 })()}
                               </div>
                            </div>

                            <div className="space-y-1">
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center block">MG %</label>
                               <Input 
                                 type="number"
                                 value={item.margen}
                                 onChange={(e) => updateItem(item.id, { margen: Number(e.target.value) })}
                                 className="h-12 bg-white dark:bg-gray-900 border-none font-bold text-blue-500 text-center px-1 text-sm shadow-sm"
                               />
                            </div>
                          </div>

                          <div className="flex justify-end items-center gap-3">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => duplicateItem(item)}
                              className="h-8 px-3 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2"
                            >
                               <Copy className="h-3 w-3" /> DUPLICAR ÍTEM
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItem(item.id)} 
                              className="h-8 px-3 text-[10px] font-bold text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2"
                            >
                               <Trash2 className="h-3.5 w-3.5" /> ELIMINAR
                            </Button>
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
                            <div className="overflow-x-auto pb-2">
                              <div className="min-w-[700px]">
                                <div className="grid grid-cols-12 gap-3 px-4 mb-1">
                                   <div className="col-span-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Proveedor / Detalle</div>
                                   <div className="col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Código SKU</div>
                                   <div className="col-span-1 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Cant.</div>
                                   <div className="col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Unit. ($)</div>
                                   <div className="col-span-1 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Desc %</div>
                                   <div className="col-span-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Subtotal</div>
                                   <div className="col-span-1"></div>
                                </div>

                                <div className="space-y-1">
                                   {(item.subcostos || []).map(sc => (
                                     <div key={sc.id} className="grid grid-cols-12 gap-3 items-center bg-gray-50/30 dark:bg-gray-800/10 p-2 px-4 rounded-xl border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 hover:bg-blue-50/30 transition-all group">
                                        <div className="col-span-3">
                                          <Input 
                                            value={sc.proveedor}
                                            onChange={(e) => updateSubCosto(item.id, sc.id, { proveedor: e.target.value })}
                                            className="h-9 bg-white dark:bg-gray-900 border-none font-medium text-xs shadow-none px-2 focus:ring-1 focus:ring-blue-500"
                                            placeholder="Nombre..."
                                          />
                                        </div>
                                        <div className="col-span-2">
                                          <Input 
                                            value={sc.codigo}
                                            onChange={(e) => updateSubCosto(item.id, sc.id, { codigo: e.target.value })}
                                            className="h-9 bg-white dark:bg-gray-900 border-none font-black text-[10px] text-blue-400 px-2 uppercase shadow-none"
                                            placeholder="SKU"
                                          />
                                        </div>
                                        <div className="col-span-1">
                                          <Input 
                                            type="number"
                                            value={sc.cantidad}
                                            onChange={(e) => updateSubCosto(item.id, sc.id, { cantidad: Number(e.target.value) })}
                                            className="h-9 bg-white dark:bg-gray-900 border-none font-bold text-xs text-center shadow-none"
                                          />
                                        </div>
                                        <div className="col-span-2">
                                          <Input 
                                            type="number"
                                            value={sc.precio_unitario}
                                            onChange={(e) => updateSubCosto(item.id, sc.id, { precio_unitario: Number(e.target.value) })}
                                            className="h-9 bg-white dark:bg-gray-900 border-none font-black text-xs text-right text-emerald-600 px-2 shadow-none"
                                          />
                                        </div>
                                        <div className="col-span-1">
                                          <Input 
                                            type="number"
                                            value={sc.descuento}
                                            onChange={(e) => updateSubCosto(item.id, sc.id, { descuento: Number(e.target.value) })}
                                            className="h-9 bg-white dark:bg-gray-900 border-none font-bold text-xs text-center text-red-400 px-1 shadow-none"
                                          />
                                        </div>
                                        <div className="col-span-2">
                                          <div className="h-9 flex items-center justify-end px-2 text-xs font-black text-gray-500">
                                            ${Math.round((sc.cantidad || 0) * (sc.precio_unitario || 0) * (1 - (sc.descuento || 0)/100)).toLocaleString("es-CL")}
                                          </div>
                                        </div>
                                        <div className="col-span-1 flex justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                          <Button variant="ghost" onClick={() => removeSubCosto(item.id, sc.id)} className="h-8 w-8 text-gray-300 hover:text-red-500 p-0">
                                             <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                              </div>
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
                                 <div 
                                    key={iIdx} 
                                    onPaste={(e) => {
                                      e.stopPropagation(); // Evitar que suba al item global
                                      handlePaste(item.id, iIdx, e);
                                    }}
                                    className="aspect-video bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-2 relative overflow-hidden group outline-none"
                                 >
                                    {img ? (
                                      <img src={img} className="w-full h-full object-contain p-1 rounded-xl" />
                                    ) : (
                                      <div className="text-center">
                                        <ImageIcon className="h-4 w-4 text-gray-300 mx-auto" />
                                        <p className="text-[7px] font-bold text-gray-400 mt-1 uppercase italic">Pegar aquí</p>
                                      </div>
                                    )}
                                    
                                    <label className="absolute bottom-1 right-1 p-1.5 bg-gray-900/60 hover:bg-gray-900/80 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-20">
                                      <FolderOpen className="h-3 w-3 text-white" />
                                      <input 
                                        type="file" accept="image/*" 
                                        onChange={(e) => handleImageUpload(item.id, iIdx, e)}
                                        className="hidden" 
                                      />
                                    </label>
                                    
                                    {img && <div className="absolute top-1 left-1 bg-gray-800/80 text-white text-[7px] px-1.5 py-0.5 rounded-full font-bold">Slot {iIdx+2}</div>}
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

      {/* Modal Packing */}
      {showPackingModal && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-auto py-6 px-4 animate-in fade-in duration-200">
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
