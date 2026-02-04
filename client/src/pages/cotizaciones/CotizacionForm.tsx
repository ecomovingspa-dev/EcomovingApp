import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Cotizacion, Item, SubCosto, Cuenta, Contacto } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Plus,
  ArrowLeft,
  Save,
  FileText,
  DollarSign,
  Percent,
  ImageIcon,
  Upload,
  Wallet,
  Search,
  Check,
  Clock,
  Send,
  Copy,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BotonExportarPDF } from "./CotizacionPDF";
import BrochureView from "./BrochureView";

const AutoResizeTextarea = ({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className?: string;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`resize-none overflow-hidden min-h-[60px] ${className}`}
      rows={2}
    />
  );
};

const TimelineEstado = ({
  estado,
  createdAt,
}: {
  estado: string;
  createdAt?: string;
}) => {
  const estados = [
    { key: "pendiente", label: "Pendiente", color: "orange" },
    { key: "produccion", label: "Producción", color: "blue" },
    { key: "despachada", label: "Despachada", color: "purple" },
    { key: "facturada", label: "Facturada", color: "green" },
  ];
  const estadoIndex = estados.findIndex((e) => e.key === estado);
  const getColorClasses = (color: string, isActive: boolean) => {
    const colors = {
      orange: isActive
        ? "bg-orange-500 border-orange-500"
        : "bg-gray-200 border-gray-300",
      blue: isActive
        ? "bg-blue-500 border-blue-500"
        : "bg-gray-200 border-gray-300",
      purple: isActive
        ? "bg-purple-500 border-purple-500"
        : "bg-gray-200 border-gray-300",
      green: isActive
        ? "bg-green-500 border-green-500"
        : "bg-gray-200 border-gray-300",
    };
    return colors[color as keyof typeof colors];
  };
  const getDiasDesde = () => {
    if (!createdAt) return "";
    const dias = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (dias === 0) return "Hoy";
    if (dias === 1) return "Hace 1 día";
    return `Hace ${dias} días`;
  };
  return (
    <div className="flex items-start gap-2">
      {estados.map((e, index) => (
        <div key={e.key} className="flex items-center gap-2 flex-1">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${index <= estadoIndex
                ? getColorClasses(e.color, true)
                : getColorClasses(e.color, false)
                }`}
            >
              {index < estadoIndex && <Check className="h-4 w-4 text-white" />}
              {index === estadoIndex && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
            <div
              className={`text-[10px] font-medium mt-1 ${index === estadoIndex
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-400 dark:text-gray-500"
                }`}
            >
              {e.label}
            </div>
            {index === estadoIndex && createdAt && (
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">
                {getDiasDesde()}
              </div>
            )}
          </div>
          {index < estados.length - 1 && (
            <div
              className={`flex-1 h-0.5 ${index < estadoIndex
                ? "bg-gray-400 dark:bg-gray-500"
                : "bg-gray-200 dark:bg-gray-700"
                }`}
            ></div>
          )}
        </div>
      ))}
    </div>
  );
};

interface CotizacionFormProps {
  id?: string;
  cuentaId?: string;
  contactoId?: string;
  onClose?: () => void;
  onSave?: () => void;
}

export default function CotizacionForm({
  id: propId,
  cuentaId: propCuentaId,
  contactoId: propContactoId,
  onClose,
  onSave,
}: CotizacionFormProps) {
  const navigate = useNavigate();
  const params = useParams();

  const id = propId || params.id;
  const paramCuentaId = propCuentaId || params.cuentaId;
  const paramContactoId = propContactoId || params.contactoId;
  const esEdicion = !!id;
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [contactosFiltrados, setContactosFiltrados] = useState<Contacto[]>([]);
  const [nuevoContactoOpen, setNuevoContactoOpen] = useState(false);
  const [nuevoContacto, setNuevoContacto] = useState({
    nombre: "",
    correo: "",
    celular: "",
    telefono: "",
    estado: "activo",
    etapa_envio: null,
    ultimo_envio: null,
    proximo_envio: null,
    error_log: "",
  });
  const [creandoContacto, setCreandoContacto] = useState(false);
  const [nuevaCuentaOpen, setNuevaCuentaOpen] = useState(false);
  const [nuevaCuenta, setNuevaCuenta] = useState({
    cliente: "",
    rut: "",
    sector: "",
    segmento: "",
    estado: "activo",
    correo: "",
    telefono: "",
    ciudad: "",
    web: "",
  });
  const [creandoCuenta, setCreandoCuenta] = useState(false);
  const [nuevoVendedorOpen, setNuevoVendedorOpen] = useState(false);
  const [nuevoVendedor, setNuevoVendedor] = useState({
    nombre: "",
    email: "",
    telefono: "",
    activo: true,
  });
  const [creandoVendedor, setCreandoVendedor] = useState(false);
  const [cotizacion, setCotizacion] = useState<Partial<Cotizacion>>({
    numero_cotizacion: "",
    vendedor_id: "",
    estado_cotizacion: "borrador",
    tiempo_entrega: "",
    validez_oferta: "",
    cuenta_id: paramCuentaId || "",
    contacto_id: paramContactoId || "",
    nro_oc: "",
    nro_guia: "",
    nro_factura: "",
    id_mercado_publico: "",
    items: [],
  });
  const [showBrochure, setShowBrochure] = useState(false);
  const [brochureConfig, setBrochureConfig] = useState({
    rows: 2,
    cols: 2,
    layoutMode: "structural" as "structural" | "free",
    orientation: "portrait" as "portrait" | "landscape",
    pageSize: "carta" as "a4" | "carta"
  });

  const calcularEstado = useMemo(() => {
    if (!cotizacion.id) return "borrador";
    if (cotizacion.nro_factura?.trim()) return "facturada";
    if (cotizacion.nro_guia?.trim()) return "despachada";
    if (cotizacion.nro_oc?.trim()) return "produccion";
    if (
      cotizacion.created_at &&
      !cotizacion.nro_oc &&
      !cotizacion.nro_guia &&
      !cotizacion.nro_factura
    ) {
      const dias = Math.floor(
        (Date.now() - new Date(cotizacion.created_at).getTime()) /
        (1000 * 60 * 60 * 24),
      );
      if (dias > 30) return "perdida";
    }
    return "pendiente";
  }, [
    cotizacion.id,
    cotizacion.nro_oc,
    cotizacion.nro_guia,
    cotizacion.nro_factura,
    cotizacion.created_at,
  ]);

  useEffect(() => {
    if (calcularEstado !== cotizacion.estado_cotizacion) {
      setCotizacion((prev) => ({ ...prev, estado_cotizacion: calcularEstado }));
    }
  }, [calcularEstado]);

  useEffect(() => {
    if (cotizacion.estado_cotizacion !== "borrador" || !cotizacion.id) return;
    const timer = setTimeout(async () => {
      await guardarBorradorSilencioso();
    }, 30000);
    return () => clearTimeout(timer);
  }, [cotizacion]);

  const guardarBorradorSilencioso = async () => {
    if (!cotizacion.id) return;
    try {
      const { cuentas: _, contactos: __, ...cotizacionLimpia } = cotizacion;
      const dataCotizacion = {
        ...cotizacionLimpia,
        costo_total: totales.totalCostos,
        total_neto: Math.round(totales.totalVenta),
        iva: Math.round(totales.totalVenta * 0.19),
        total: Math.round(totales.totalVenta * 1.19),
        ganancias: Math.round(totales.ganancia),
        mg: totales.margenTotal.toFixed(2),
      };
      await supabase
        .from("cotizaciones")
        .update(dataCotizacion)
        .eq("id", cotizacion.id);
      setUltimoGuardado(new Date());
    } catch (error) {
      console.error("Error en autoguardado:", error);
    }
  };

  useEffect(() => {
    cargarCuentas();
    cargarVendedores();
    if (esEdicion) {
      cargarCotizacion();
    }
    if (paramCuentaId) {
      cargarContactosDeCuenta(paramCuentaId);
    }
  }, [id, paramCuentaId]);

  const cargarVendedores = async () => {
    try {
      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      if (data) {
        setVendedores(data);
        console.log("✅ Vendedores cargados:", data.length);
      }
    } catch (e) {
      console.error("Error cargando vendedores:", e);
    }
  };

  const generarNumeroCotizacion = async () => {
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("numero_cotizacion")
        .order("numero_cotizacion", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nuevoNumero = "COT-5000";

      if (data && data.length > 0 && data[0].numero_cotizacion) {
        const ultimoNumeroStr = data[0].numero_cotizacion;
        const partes = ultimoNumeroStr.split("-");
        if (partes.length === 2) {
          const ultimoCorrelativo = parseInt(partes[1], 10);
          if (!isNaN(ultimoCorrelativo)) {
            nuevoNumero = `COT-${ultimoCorrelativo + 1}`;
          }
        }
      }

      return nuevoNumero;
    } catch (e) {
      console.error("Error generando número de cotización:", e);
      return "COT-5000";
    }
  };

  useEffect(() => {
    if (cotizacion.cuenta_id) {
      cargarContactosDeCuenta(cotizacion.cuenta_id);
    } else {
      setContactosFiltrados([]);
    }
  }, [cotizacion.cuenta_id]);

  const cargarCuentas = async () => {
    try {
      let todasLasCuentas: Cuenta[] = [];
      let desde = 0;
      const cantidad = 1000;
      let hayMas = true;

      while (hayMas) {
        const { data, error } = await supabase
          .from("cuentas")
          .select("*")
          .order("cliente", { ascending: true })
          .range(desde, desde + cantidad - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          todasLasCuentas.push(...data);
          desde += cantidad;

          if (data.length < cantidad) {
            hayMas = false;
          }
        } else {
          hayMas = false;
        }
      }

      setCuentas(todasLasCuentas);
      console.log("✅ Cuentas cargadas (total):", todasLasCuentas.length);
    } catch (e) {
      console.error("❌ Error cargando cuentas:", e);
      setMensaje("❌ Error al cargar cuentas");
    }
  };

  const cargarContactosDeCuenta = async (cuentaId: string) => {
    try {
      const { data, error } = await supabase
        .from("contactos")
        .select("*")
        .eq("cuenta_id", cuentaId)
        .order("nombre");
      if (error) throw error;
      if (data) {
        setContactos(data);
        setContactosFiltrados(data);
      }
    } catch (e) {
      console.error("Error cargando contactos:", e);
    }
  };

  const cargarCotizacion = async () => {
    setCargando(true);
    try {
      const { data: cotizacionData, error: cotizacionError } = await supabase
        .from("cotizaciones")
        .select("*")
        .eq("id", id)
        .single();
      if (cotizacionError) throw cotizacionError;
      if (!cotizacionData) {
        throw new Error("No se encontró la cotización");
      }

      let cuentaData = null;
      if (cotizacionData.cuenta_id) {
        const { data: cuenta, error: cuentaError } = await supabase
          .from("cuentas")
          .select("cliente, rut")
          .eq("id", cotizacionData.cuenta_id)
          .single();
        if (!cuentaError && cuenta) {
          cuentaData = cuenta;
        }
      }

      let contactoData = null;
      if (cotizacionData.contacto_id) {
        const { data: contacto, error: contactoError } = await supabase
          .from("contactos")
          .select("nombre, correo, celular")
          .eq("id", cotizacionData.contacto_id)
          .single();
        if (!contactoError && contacto) {
          contactoData = contacto;
        }
      }

      setCotizacion({
        ...cotizacionData,
        cuentas: cuentaData,
        contactos: contactoData,
        items: cotizacionData.items || [],
      });

      if (cotizacionData.cuenta_id) {
        await cargarContactosDeCuenta(cotizacionData.cuenta_id);
      }
    } catch (error: any) {
      console.error("Error al cargar cotización:", error);
      setMensaje(
        "❌ Error al cargar cotización: " +
        (error.message || "Error desconocido"),
      );
    } finally {
      setCargando(false);
    }
  };

  // ✅ MODIFICADO: Cálculo de descuento como PORCENTAJE
  const calcularSubtotalCosto = (
    cantidad: number,
    precio: number,
    descuentoPorcentaje: number,
  ) => {
    const subtotal = cantidad * precio;
    const descuento = subtotal * (descuentoPorcentaje / 100);
    return subtotal - descuento;
  };

  const costoItem = (item: Item) =>
    item.subcostos.reduce((s, c) => s + (c.valor || 0), 0);

  const precioVentaItem = (item: Item) => {
    const costoTotal = costoItem(item);
    const costoUnitario = item.cantidad > 0 ? costoTotal / item.cantidad : 0;
    const precioSugerido = costoUnitario > 0 ? costoUnitario / (1 - item.margen / 100) : 0;
    return Math.round(precioSugerido); // ✅ Unificamos: siempre devolvemos el valor redondeado
  };

  const totales = useMemo(() => {
    const items = cotizacion.items || [];
    const totalCostos = items.reduce((sum, i) => sum + costoItem(i), 0);

    // ✅ Calculamos el total de venta sumando los subtotales exactos que ve el usuario (Redondeado * Cantidad)
    const totalVenta = items.reduce(
      (sum, i) => sum + (precioVentaItem(i) * i.cantidad),
      0,
    );

    const ganancia = totalVenta - totalCostos;
    const margenTotal = totalVenta > 0 ? (ganancia / totalVenta) * 100 : 0;
    return { totalCostos, totalVenta, ganancia, margenTotal };
  }, [cotizacion.items]);

  const datosParaPDF = useMemo(() => {
    const cuentaData = cuentas.find((c) => c.id === cotizacion.cuenta_id);
    const contactoData = contactos.find((c) => c.id === cotizacion.contacto_id);
    const vendedorData = vendedores.find(
      (v) => v.id === cotizacion.vendedor_id,
    );

    const itemsFormateados = (cotizacion.items || []).map((item) => {
      const pUnitario = precioVentaItem(item);
      return {
        ...item,
        precio_unitario: pUnitario,
        subtotal: pUnitario * item.cantidad, // ✅ Subtotal coherente con el precio visual
      };
    });

    return {
      cotizacion: {
        ...cotizacion,
        vendedor_nombre: vendedorData?.nombre,
        vendedor_correo: vendedorData?.correo,
        vendedor_celular: vendedorData?.celular,
      },
      cuenta: cuentaData,
      contacto: contactoData,
      items: itemsFormateados,
      totales: {
        neto: Math.round(totales.totalVenta),
        iva: Math.round(totales.totalVenta * 0.19),
        total: Math.round(totales.totalVenta * 1.19),
      },
    };
  }, [cotizacion, cuentas, contactos, vendedores, totales]);

  const agregarItem = () => {
    setCotizacion((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: Date.now(),
          descripcion: "",
          cantidad: 1,
          margen: 18,
          subcostos: [
            {
              id: Date.now() + 1,
              proveedor: "",
              codigo: "",
              cantidad: 1,
              precio_unitario: 0,
              descuento: 0,
              valor: 0,
            },
          ],
        },
      ],
    }));
  };

  const eliminarItem = (itemId: number) => {
    setCotizacion((prev) => ({
      ...prev,
      items: (prev.items || []).filter((i) => i.id !== itemId),
    }));
  };

  const actualizarItem = (itemId: number, campo: keyof Item, valor: any) => {
    setCotizacion((prev) => ({
      ...prev,
      items: (prev.items || []).map((i) =>
        i.id === itemId ? { ...i, [campo]: valor } : i,
      ),
    }));
  };

  const agregarSubcosto = (itemId: number) => {
    setCotizacion((prev) => ({
      ...prev,
      items: (prev.items || []).map((i) =>
        i.id === itemId
          ? {
            ...i,
            subcostos: [
              ...i.subcostos,
              {
                id: Date.now(),
                proveedor: "",
                codigo: "",
                cantidad: 1,
                precio_unitario: 0,
                descuento: 0,
                valor: 0,
              },
            ],
          }
          : i,
      ),
    }));
  };

  const eliminarSubcosto = (itemId: number, subcostoId: number) => {
    setCotizacion((prev) => ({
      ...prev,
      items: (prev.items || []).map((i) =>
        i.id === itemId
          ? { ...i, subcostos: i.subcostos.filter((s) => s.id !== subcostoId) }
          : i,
      ),
    }));
  };

  const actualizarSubcosto = (
    itemId: number,
    subcostoId: number,
    campo: keyof SubCosto,
    valor: any,
  ) => {
    setCotizacion((prev) => ({
      ...prev,
      items: (prev.items || []).map((i) =>
        i.id === itemId
          ? {
            ...i,
            subcostos: i.subcostos.map((s) => {
              if (s.id !== subcostoId) return s;
              const updatedSubcosto = { ...s, [campo]: valor };
              if (
                ["cantidad", "precio_unitario", "descuento"].includes(campo)
              ) {
                updatedSubcosto.valor = calcularSubtotalCosto(
                  updatedSubcosto.cantidad,
                  updatedSubcosto.precio_unitario,
                  updatedSubcosto.descuento,
                );
              }
              return updatedSubcosto;
            }),
          }
          : i,
      ),
    }));
  };

  const actualizarPrecioVenta = (itemId: number, nuevoPrecio: number) => {
    setCotizacion((prev) => ({
      ...prev,
      items: (prev.items || []).map((i) => {
        if (i.id !== itemId) return i;
        const costoTotal = costoItem(i);
        const costoUnitario = i.cantidad > 0 ? costoTotal / i.cantidad : 0;
        if (nuevoPrecio <= 0) return { ...i, margen: 0 };
        const nuevoMargen = 100 * (1 - costoUnitario / nuevoPrecio);
        return { ...i, margen: Number(nuevoMargen.toFixed(2)) };
      }),
    }));
  };

  const handleImagePaste = (e: React.ClipboardEvent, itemId: number) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              actualizarItem(itemId, "imagen", event.target.result);
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
  };

  const handleCrearCuenta = async () => {
    if (!nuevaCuenta.cliente) {
      setMensaje("⚠️ Debe ingresar el nombre de la cuenta (cliente)");
      return;
    }
    setCreandoCuenta(true);
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .insert([nuevaCuenta])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        await cargarCuentas();
        setCotizacion((prev) => ({
          ...prev,
          cuenta_id: data.id,
          contacto_id: "",
        }));
        setNuevaCuentaOpen(false);
        setNuevaCuenta({
          cliente: "",
          rut: "",
          sector: "",
          segmento: "",
          estado: "activo",
          correo: "",
          telefono: "",
          ciudad: "",
          web: "",
        });
        setMensaje("✅ Cuenta creada exitosamente");
        setTimeout(() => setMensaje(""), 3000);
      }
    } catch (e: any) {
      console.error("Error al crear cuenta:", e);
      setMensaje("❌ Error al crear cuenta: " + e.message);
    } finally {
      setCreandoCuenta(false);
    }
  };

  const handleCrearContacto = async () => {
    if (!cotizacion.cuenta_id || !nuevoContacto.nombre) {
      setMensaje("⚠️ Debe ingresar el nombre del contacto");
      return;
    }
    setCreandoContacto(true);
    try {
      const { data, error } = await supabase
        .from("contactos")
        .insert([
          {
            ...nuevoContacto,
            cuenta_id: cotizacion.cuenta_id,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        await cargarContactosDeCuenta(cotizacion.cuenta_id);
        setCotizacion((prev) => ({ ...prev, contacto_id: data.id }));
        setNuevoContactoOpen(false);
        setNuevoContacto({
          nombre: "",
          correo: "",
          celular: "",
          telefono: "",
          estado: "activo",
          etapa_envio: null,
          ultimo_envio: null,
          proximo_envio: null,
          error_log: "",
        });
        setMensaje("✅ Contacto creado exitosamente");
        setTimeout(() => setMensaje(""), 3000);
      }
    } catch (e: any) {
      console.error("Error al crear contacto:", e);
      setMensaje("❌ Error al crear contacto: " + e.message);
    } finally {
      setCreandoContacto(false);
    }
  };

  const handleCrearVendedor = async () => {
    if (!nuevoVendedor.nombre) {
      setMensaje("⚠️ Debe ingresar el nombre del vendedor");
      return;
    }
    setCreandoVendedor(true);
    try {
      const { data, error } = await supabase
        .from("vendedores")
        .insert([nuevoVendedor])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        await cargarVendedores();
        setCotizacion((prev) => ({ ...prev, vendedor_id: data.id }));
        setNuevoVendedorOpen(false);
        setNuevoVendedor({
          nombre: "",
          email: "",
          telefono: "",
          activo: true,
        });
        setMensaje("✅ Vendedor creado exitosamente");
        setTimeout(() => setMensaje(""), 3000);
      }
    } catch (e: any) {
      console.error("Error al crear vendedor:", e);
      setMensaje("❌ Error al crear vendedor: " + e.message);
    } finally {
      setCreandoVendedor(false);
    }
  };

  const handleDuplicate = async () => {
    if (!cotizacion.id) return;

    setGuardando(true);
    setMensaje("Duplicando cotización...");

    try {
      let numeroCotizacion = await generarNumeroCotizacion();

      let intentos = 0;
      const maxIntentos = 5;
      while (intentos < maxIntentos) {
        const { data: existing, error: checkError } = await supabase
          .from("cotizaciones")
          .select("id")
          .eq("numero_cotizacion", numeroCotizacion)
          .limit(1);

        if (checkError) throw checkError;

        if (!existing || existing.length === 0) {
          break;
        } else {
          const partes = numeroCotizacion.split("-");
          const actual = parseInt(partes[1], 10);
          if (isNaN(actual)) break;
          numeroCotizacion = `COT-${actual + 1}`;
          intentos++;
        }
      }

      if (intentos >= maxIntentos) {
        throw new Error("No se pudo generar un número único para la copia");
      }

      const { cuentas: _, contactos: __, id: ___, created_at: ____, ...cotizacionLimpia } = cotizacion;

      const dataCotizacion = {
        ...cotizacionLimpia,
        numero_cotizacion: numeroCotizacion,
        estado_cotizacion: "borrador",
        nro_oc: "",
        nro_guia: "",
        nro_factura: "",
        id_mercado_publico: "",
        costo_total: totales.totalCostos,
        total_neto: Math.round(totales.totalVenta),
        iva: Math.round(totales.totalVenta * 0.19),
        total: Math.round(totales.totalVenta * 1.19),
        ganancias: Math.round(totales.ganancia),
        mg: totales.margenTotal.toFixed(2),
      };

      const { data, error } = await supabase
        .from("cotizaciones")
        .insert([dataCotizacion])
        .select()
        .single();

      if (error) throw error;

      setMensaje("✅ Cotización duplicada");
      setTimeout(() => navigate(`/cotizaciones/${data.id}`), 1000);

    } catch (error: any) {
      console.error("Error al duplicar:", error);
      setMensaje("❌ Error al duplicar: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cotizacion.cuenta_id) {
      setMensaje("⚠️ Debe seleccionar una cuenta (cliente)");
      return;
    }
    if (!cotizacion.items || cotizacion.items.length === 0) {
      setMensaje("⚠️ Debe agregar al menos un producto");
      return;
    }
    setGuardando(true);
    setMensaje("💾 Guardando...");
    try {
      let numeroCotizacion = cotizacion.numero_cotizacion;
      if (cotizacion.estado_cotizacion === "borrador" && !esEdicion) {
        numeroCotizacion = await generarNumeroCotizacion();

        let intentos = 0;
        const maxIntentos = 5;
        while (intentos < maxIntentos) {
          const { data: existing, error: checkError } = await supabase
            .from("cotizaciones")
            .select("id")
            .eq("numero_cotizacion", numeroCotizacion)
            .limit(1);

          if (checkError) throw checkError;

          if (!existing || existing.length === 0) {
            break;
          } else {
            const partes = numeroCotizacion.split("-");
            const actual = parseInt(partes[1], 10);
            if (isNaN(actual)) break;
            numeroCotizacion = `COT-${actual + 1}`;
            intentos++;
          }
        }

        if (intentos >= maxIntentos) {
          throw new Error("No se pudo generar un número único de cotización");
        }
      }

      const { cuentas: _, contactos: __, ...cotizacionLimpia } = cotizacion;
      const dataCotizacion = {
        ...cotizacionLimpia,
        numero_cotizacion: numeroCotizacion,
        vendedor_id: cotizacion.vendedor_id,
        estado_cotizacion: cotizacion.estado_cotizacion,
        tiempo_entrega: cotizacion.tiempo_entrega,
        validez_oferta: cotizacion.validez_oferta,
        cuenta_id: cotizacion.cuenta_id,
        contacto_id: cotizacion.contacto_id,
        nro_oc: cotizacion.nro_oc,
        nro_guia: cotizacion.nro_guia,
        nro_factura: cotizacion.nro_factura,
        id_mercado_publico: cotizacion.id_mercado_publico,
        items: cotizacion.items,
        costo_total: totales.totalCostos,
        total_neto: Math.round(totales.totalVenta),
        iva: Math.round(totales.totalVenta * 0.19),
        total: Math.round(totales.totalVenta * 1.19),
        ganancias: Math.round(totales.ganancia),
        mg: totales.margenTotal.toFixed(2),
      };

      if (esEdicion) {
        const { error } = await supabase
          .from("cotizaciones")
          .update(dataCotizacion)
          .eq("id", id);
        if (error) throw error;
        setMensaje("✅ Cotización actualizada");
      } else {
        const { error } = await supabase
          .from("cotizaciones")
          .insert([dataCotizacion]);
        if (error) throw error;
        setMensaje("✅ Cotización creada");
      }

      if (onSave) onSave();

      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          navigate("/cotizaciones");
        }
      }, 1500);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("❌ Error: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  const getTextoBoton = () => {
    if (guardando) return "Guardando...";
    if (cotizacion.estado_cotizacion === "borrador") return "Guardar y Enviar";
    return "Guardar y Volver al Listado";
  };

  const getIconoBoton = () => {
    if (guardando) return <span className="animate-spin mr-2">⏳</span>;
    if (cotizacion.estado_cotizacion === "borrador")
      return <Send className="mr-2 h-4 w-4" />;
    return <Save className="mr-2 h-4 w-4" />;
  };

  const tiempoDesdeGuardado = () => {
    if (!ultimoGuardado) return "";
    const segundos = Math.floor((Date.now() - ultimoGuardado.getTime()) / 1000);
    if (segundos < 60) return `Guardado hace ${segundos}s`;
    const minutos = Math.floor(segundos / 60);
    return `Guardado hace ${minutos}m`;
  };

  const formatearFecha = (fecha?: string) => {
    if (!fecha) return new Date().toLocaleDateString("es-CL");
    return new Date(fecha).toLocaleDateString("es-CL");
  };

  const noSpinnerClass =
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none]";
  const elegantInputClass = `h-8 text-xs bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20 transition-all ${noSpinnerClass}`;
  const labelClass =
    "text-[10px] uppercase text-slate-500 dark:text-gray-400 font-bold tracking-wide";

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Cargando cotización...
          </p>
        </div>
      </div>
    );
  }

  if (showBrochure) {
    return (
      <BrochureView
        cotizacion={cotizacion}
        onBack={() => setShowBrochure(false)}
        rows={brochureConfig.rows}
        cols={brochureConfig.cols}
        layoutMode={brochureConfig.layoutMode}
        orientation={brochureConfig.orientation}
        pageSize={brochureConfig.pageSize}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900">
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-b border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSubmit()}
                className="hover:bg-slate-100 dark:hover:bg-gray-700 rounded-full"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-gray-300" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                  Cotización
                </h1>
                {cotizacion.estado_cotizacion === "borrador" &&
                  ultimoGuardado && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-gray-500">
                      <Clock className="h-3 w-3" />
                      {tiempoDesdeGuardado()}
                    </div>
                  )}
              </div>
            </div>
            <div className="flex flex-1 items-center justify-end gap-4 ml-6">
              <div className="hidden md:grid grid-cols-5 gap-3 flex-1 items-center bg-slate-50/50 dark:bg-gray-800/50 p-2 rounded-lg border border-slate-100 dark:border-gray-700">
                <div className="flex flex-col items-start pl-3 border-l-4 border-slate-300 dark:border-gray-600">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                    Costos
                  </span>
                  <span className="text-sm font-semibold text-slate-600 dark:text-gray-300">
                    ${Math.round(totales.totalCostos).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-start pl-3 border-l-4 border-blue-400">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                    Margen
                  </span>
                  <span
                    className={`text-sm font-bold ${totales.margenTotal < 15 ? "text-red-500" : "text-emerald-600"}`}
                  >
                    {totales.margenTotal.toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col items-start pl-3 border-l-4 border-emerald-400">
                  <span className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-wider">
                    Ganancia
                  </span>
                  <span className="text-sm font-bold text-emerald-600">
                    +${Math.round(totales.ganancia).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-start pl-3 border-l-4 border-slate-400 dark:border-gray-500">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                    Neto
                  </span>
                  <span className="text-sm font-bold tracking-tight text-slate-700 dark:text-gray-200">
                    ${Math.round(totales.totalVenta).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-start pl-3 border-l-4 border-slate-800 dark:border-blue-500 bg-slate-100 dark:bg-gray-700 rounded-r-md py-1">
                  <span className="text-[10px] text-slate-600 dark:text-gray-300 font-bold uppercase tracking-widest">
                    Total
                  </span>
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    ${Math.round(totales.totalVenta * 1.19).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <BotonExportarPDF {...datosParaPDF} />
                {esEdicion && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDuplicate}
                    disabled={guardando}
                    title="Duplicar Cotización"
                    className="text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBrochure(true)}
                  className="h-9 gap-2 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400"
                >
                  <FileText className="h-4 w-4" />
                  Presentación
                </Button>
                <div className="h-6 w-px bg-slate-200 dark:bg-gray-700 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSubmit()}
                  className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
                >
                  Regresar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={guardando}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-200"
                >
                  {getIconoBoton()}
                  {getTextoBoton()}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
        {mensaje && (
          <div
            className={`p-4 rounded-xl font-medium border flex items-center gap-3 shadow-sm ${mensaje.includes("❌") || mensaje.includes("⚠️")
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800"
              : mensaje.includes("💾")
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800"
              }`}
          >
            {mensaje}
          </div>
        )}
        {cotizacion.estado_cotizacion !== "borrador" &&
          cotizacion.estado_cotizacion !== "perdida" && (
            <Card className="shadow-sm border-slate-200/60 dark:border-gray-700">
              <CardContent className="p-6">
                <TimelineEstado
                  estado={cotizacion.estado_cotizacion || "pendiente"}
                  createdAt={cotizacion.created_at}
                />
              </CardContent>
            </Card>
          )}
        <Card className="shadow-sm border-slate-200/60 dark:border-gray-700 overflow-hidden">
          <CardHeader className="py-2.5 px-6 bg-slate-50/50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                Información General
              </CardTitle>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-gray-400">
                    Fecha:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-gray-300">
                    {formatearFecha(cotizacion.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-gray-400">
                    N° Cotización:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-gray-300">
                    {cotizacion.numero_cotizacion || "BORRADOR"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-gray-400">
                    ID Mercado:
                  </span>
                  <Input
                    value={cotizacion.id_mercado_publico || ""}
                    onChange={(e) =>
                      setCotizacion((prev) => ({
                        ...prev,
                        id_mercado_publico: e.target.value,
                      }))
                    }
                    className="h-6 w-32 text-xs border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 p-1 focus-visible:ring-1 text-slate-700"
                    placeholder="ID MP"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-white dark:bg-gray-900">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className={labelClass}>Cliente *</Label>
                  <div className="flex gap-2">
                    <Popover open={cuentaOpen} onOpenChange={setCuentaOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={cuentaOpen}
                          className="w-full justify-between font-normal bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 h-8 text-xs px-2"
                        >
                          <span className="truncate text-left flex-1 dark:text-gray-300">
                            {cotizacion.cuenta_id
                              ? cuentas.find(
                                (c) => c.id === cotizacion.cuenta_id,
                              )?.cliente
                              : "Seleccionar Cliente..."}
                          </span>
                          <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[400px] p-0 bg-white dark:bg-gray-800 max-h-[400px] overflow-hidden"
                        align="start"
                      >
                        <Command shouldFilter={true}>
                          <CommandInput
                            placeholder="Buscar cliente..."
                            className="h-8 text-xs"
                          />
                          <CommandList className="max-h-[300px] overflow-y-auto">
                            <CommandEmpty>No se encontró cliente.</CommandEmpty>
                            <CommandGroup>
                              {cuentas.map((cuenta) => (
                                <CommandItem
                                  key={cuenta.id}
                                  value={`${cuenta.cliente} ${cuenta.rut || ""}`}
                                  onSelect={() => {
                                    setCotizacion((prev) => ({
                                      ...prev,
                                      cuenta_id: cuenta.id,
                                      contacto_id: "",
                                    }));
                                    setCuentaOpen(false);
                                  }}
                                  className="text-xs"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-3.5 w-3.5",
                                      cotizacion.cuenta_id === cuenta.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  <div>
                                    <div className="dark:text-gray-200">
                                      {cuenta.cliente}
                                    </div>
                                    {cuenta.rut && (
                                      <div className="text-[10px] text-slate-400 dark:text-gray-500">
                                        RUT: {cuenta.rut}
                                      </div>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Dialog
                      open={nuevaCuentaOpen}
                      onOpenChange={setNuevaCuentaOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                          title="Crear nueva cuenta"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
                        <DialogHeader>
                          <DialogTitle className="dark:text-gray-100">
                            Nueva Cuenta (Cliente)
                          </DialogTitle>
                          <DialogDescription className="dark:text-gray-400">
                            Completa la información de la nueva cuenta
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-cliente"
                                className="dark:text-gray-300"
                              >
                                Nombre Cliente *
                              </Label>
                              <Input
                                id="cuenta-cliente"
                                value={nuevaCuenta.cliente}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    cliente: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-rut"
                                className="dark:text-gray-300"
                              >
                                RUT
                              </Label>
                              <Input
                                id="cuenta-rut"
                                value={nuevaCuenta.rut}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    rut: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-sector"
                                className="dark:text-gray-300"
                              >
                                Sector
                              </Label>
                              <Input
                                id="cuenta-sector"
                                value={nuevaCuenta.sector}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    sector: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-segmento"
                                className="dark:text-gray-300"
                              >
                                Segmento
                              </Label>
                              <Input
                                id="cuenta-segmento"
                                value={nuevaCuenta.segmento}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    segmento: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-correo"
                                className="dark:text-gray-300"
                              >
                                Correo
                              </Label>
                              <Input
                                id="cuenta-correo"
                                type="email"
                                value={nuevaCuenta.correo}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    correo: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-telefono"
                                className="dark:text-gray-300"
                              >
                                Teléfono
                              </Label>
                              <Input
                                id="cuenta-telefono"
                                value={nuevaCuenta.telefono}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    telefono: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-ciudad"
                                className="dark:text-gray-300"
                              >
                                Ciudad
                              </Label>
                              <Input
                                id="cuenta-ciudad"
                                value={nuevaCuenta.ciudad}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    ciudad: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label
                                htmlFor="cuenta-web"
                                className="dark:text-gray-300"
                              >
                                Web
                              </Label>
                              <Input
                                id="cuenta-web"
                                value={nuevaCuenta.web}
                                onChange={(e) =>
                                  setNuevaCuenta({
                                    ...nuevaCuenta,
                                    web: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label
                              htmlFor="cuenta-estado"
                              className="dark:text-gray-300"
                            >
                              Estado
                            </Label>
                            <Select
                              value={nuevaCuenta.estado}
                              onValueChange={(value) =>
                                setNuevaCuenta({
                                  ...nuevaCuenta,
                                  estado: value,
                                })
                              }
                            >
                              <SelectTrigger
                                id="cuenta-estado"
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-800">
                                <SelectItem value="activo">Activo</SelectItem>
                                <SelectItem value="inactivo">
                                  Inactivo
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="ghost"
                            onClick={() => setNuevaCuentaOpen(false)}
                            className="dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleCrearCuenta}
                            disabled={creandoCuenta || !nuevaCuenta.cliente}
                          >
                            {creandoCuenta ? "Guardando..." : "Guardar Cuenta"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>Contacto</Label>
                  <div className="flex gap-2">
                    <Select
                      value={cotizacion.contacto_id || ""}
                      onValueChange={(value) =>
                        setCotizacion((prev) => ({
                          ...prev,
                          contacto_id: value,
                        }))
                      }
                      disabled={!cotizacion.cuenta_id}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 h-8 text-xs flex-1 dark:text-gray-100">
                        <SelectValue>
                          {cotizacion.contacto_id &&
                            contactosFiltrados.length > 0
                            ? contactosFiltrados.find(
                              (c) => c.id === cotizacion.contacto_id,
                            )?.nombre || "Seleccionar..."
                            : cotizacion.cuenta_id
                              ? "Seleccionar..."
                              : "Primero seleccione cliente"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800">
                        {contactosFiltrados.length === 0 ? (
                          <div className="p-2 text-xs text-slate-500 dark:text-gray-400 text-center">
                            No hay contactos para esta cuenta
                          </div>
                        ) : (
                          contactosFiltrados.map((c) => (
                            <SelectItem
                              key={c.id}
                              value={c.id}
                              className="text-xs dark:text-gray-100"
                            >
                              {c.nombre}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Dialog
                      open={nuevoContactoOpen}
                      onOpenChange={setNuevoContactoOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                          disabled={!cotizacion.cuenta_id}
                          title="Crear nuevo contacto"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
                        <DialogHeader>
                          <DialogTitle className="dark:text-gray-100">
                            Nuevo Contacto
                          </DialogTitle>
                          <DialogDescription className="dark:text-gray-400">
                            Agrega un nuevo contacto para{" "}
                            {
                              cuentas.find((c) => c.id === cotizacion.cuenta_id)
                                ?.cliente
                            }
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label
                              htmlFor="c-nombre"
                              className="dark:text-gray-300"
                            >
                              Nombre *
                            </Label>
                            <Input
                              id="c-nombre"
                              value={nuevoContacto.nombre}
                              onChange={(e) =>
                                setNuevoContacto({
                                  ...nuevoContacto,
                                  nombre: e.target.value,
                                })
                              }
                              className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label
                                htmlFor="c-email"
                                className="dark:text-gray-300"
                              >
                                Correo
                              </Label>
                              <Input
                                id="c-email"
                                type="email"
                                value={nuevoContacto.correo}
                                onChange={(e) =>
                                  setNuevoContacto({
                                    ...nuevoContacto,
                                    correo: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label
                                htmlFor="c-celular"
                                className="dark:text-gray-300"
                              >
                                Celular
                              </Label>
                              <Input
                                id="c-celular"
                                value={nuevoContacto.celular}
                                onChange={(e) =>
                                  setNuevoContacto({
                                    ...nuevoContacto,
                                    celular: e.target.value,
                                  })
                                }
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label
                              htmlFor="c-telefono"
                              className="dark:text-gray-300"
                            >
                              Teléfono Fijo
                            </Label>
                            <Input
                              id="c-telefono"
                              value={nuevoContacto.telefono}
                              onChange={(e) =>
                                setNuevoContacto({
                                  ...nuevoContacto,
                                  telefono: e.target.value,
                                })
                              }
                              className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label
                              htmlFor="c-estado"
                              className="dark:text-gray-300"
                            >
                              Estado
                            </Label>
                            <Select
                              value={nuevoContacto.estado}
                              onValueChange={(value) =>
                                setNuevoContacto({
                                  ...nuevoContacto,
                                  estado: value,
                                })
                              }
                            >
                              <SelectTrigger
                                id="c-estado"
                                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-800">
                                <SelectItem value="activo">Activo</SelectItem>
                                <SelectItem value="inactivo">
                                  Inactivo
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="ghost"
                            onClick={() => setNuevoContactoOpen(false)}
                            className="dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleCrearContacto}
                            disabled={creandoContacto || !nuevoContacto.nombre}
                          >
                            {creandoContacto
                              ? "Guardando..."
                              : "Guardar Contacto"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>Vendedor/a</Label>
                  <div className="flex gap-2">
                    <Select
                      value={cotizacion.vendedor_id}
                      onValueChange={(value) =>
                        setCotizacion((prev) => ({
                          ...prev,
                          vendedor_id: value,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 h-8 text-xs flex-1 dark:text-gray-100">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800">
                        {vendedores.map((v) => (
                          <SelectItem
                            key={v.id}
                            value={v.id}
                            className="text-xs dark:text-gray-100"
                          >
                            {v.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog
                      open={nuevoVendedorOpen}
                      onOpenChange={setNuevoVendedorOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                          title="Crear nuevo vendedor"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800">
                        <DialogHeader>
                          <DialogTitle className="dark:text-gray-100">
                            Nuevo Vendedor
                          </DialogTitle>
                          <DialogDescription className="dark:text-gray-400">
                            Agrega un nuevo vendedor al sistema
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label
                              htmlFor="v-nombre"
                              className="dark:text-gray-300"
                            >
                              Nombre *
                            </Label>
                            <Input
                              id="v-nombre"
                              value={nuevoVendedor.nombre}
                              onChange={(e) =>
                                setNuevoVendedor({
                                  ...nuevoVendedor,
                                  nombre: e.target.value,
                                })
                              }
                              className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label
                              htmlFor="v-email"
                              className="dark:text-gray-300"
                            >
                              Email
                            </Label>
                            <Input
                              id="v-email"
                              type="email"
                              value={nuevoVendedor.email}
                              onChange={(e) =>
                                setNuevoVendedor({
                                  ...nuevoVendedor,
                                  email: e.target.value,
                                })
                              }
                              className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label
                              htmlFor="v-telefono"
                              className="dark:text-gray-300"
                            >
                              Teléfono
                            </Label>
                            <Input
                              id="v-telefono"
                              value={nuevoVendedor.telefono}
                              onChange={(e) =>
                                setNuevoVendedor({
                                  ...nuevoVendedor,
                                  telefono: e.target.value,
                                })
                              }
                              className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="ghost"
                            onClick={() => setNuevoVendedorOpen(false)}
                            className="dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleCrearVendedor}
                            disabled={creandoVendedor || !nuevoVendedor.nombre}
                          >
                            {creandoVendedor
                              ? "Guardando..."
                              : "Guardar Vendedor"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="tiempo" className={labelClass}>
                    Tiempo de Entrega
                  </Label>
                  <Input
                    id="tiempo"
                    value={cotizacion.tiempo_entrega || ""}
                    onChange={(e) =>
                      setCotizacion((prev) => ({
                        ...prev,
                        tiempo_entrega: e.target.value,
                      }))
                    }
                    className={`${elegantInputClass} dark:text-gray-100`}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="validez" className={labelClass}>
                    Validez de Oferta
                  </Label>
                  <Input
                    id="validez"
                    value={cotizacion.validez_oferta || ""}
                    onChange={(e) =>
                      setCotizacion((prev) => ({
                        ...prev,
                        validez_oferta: e.target.value,
                      }))
                    }
                    className={`${elegantInputClass} dark:text-gray-100`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className={labelClass}>N° Orden de Compra</Label>
                  <Input
                    value={cotizacion.nro_oc || ""}
                    onChange={(e) =>
                      setCotizacion((prev) => ({
                        ...prev,
                        nro_oc: e.target.value,
                      }))
                    }
                    className={`${elegantInputClass} dark:text-gray-100`}
                  />
                  <p className="text-[9px] text-slate-400 dark:text-gray-500 mt-0.5">
                    → Cambia a estado "Producción"
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>N° Guía de Despacho</Label>
                  <Input
                    value={cotizacion.nro_guia || ""}
                    onChange={(e) =>
                      setCotizacion((prev) => ({
                        ...prev,
                        nro_guia: e.target.value,
                      }))
                    }
                    className={`${elegantInputClass} dark:text-gray-100`}
                  />
                  <p className="text-[9px] text-slate-400 dark:text-gray-500 mt-0.5">
                    → Cambia a estado "Despachada"
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>N° Factura</Label>
                  <Input
                    value={cotizacion.nro_factura || ""}
                    onChange={(e) =>
                      setCotizacion((prev) => ({
                        ...prev,
                        nro_factura: e.target.value,
                      }))
                    }
                    className={`${elegantInputClass} dark:text-gray-100`}
                  />
                  <p className="text-[9px] text-slate-400 dark:text-gray-500 mt-0.5">
                    → Cambia a estado "Facturada"
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 flex items-center gap-2 uppercase tracking-wide">
              <Wallet className="h-4 w-4 text-slate-500 dark:text-gray-400" />
              Detalle de Productos
            </h2>
            {(cotizacion.items || []).length > 0 && (
              <Button
                onClick={agregarItem}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar Producto
              </Button>
            )}
          </div>
          <div className="space-y-4">
            {(cotizacion.items || []).map((item) => (
              <Card
                key={item.id}
                className="border border-slate-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
              >
                <CardContent className="p-0">
                  <div className="p-4 flex flex-col gap-6 bg-white dark:bg-gray-900">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div
                        className="w-full md:w-32 flex-shrink-0 flex flex-col gap-2 relative group/img"
                        onPaste={(e) => handleImagePaste(e, item.id)}
                        tabIndex={0}
                      >
                        <div className="aspect-square bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm flex items-center justify-center overflow-hidden relative cursor-pointer hover:border-blue-400 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none">
                          {item.imagen ? (
                            <img
                              src={item.imagen}
                              alt="Producto"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 dark:text-gray-600 p-2 text-center">
                              <ImageIcon className="h-8 w-8 mb-1" />
                              <span className="text-[9px] leading-tight font-medium">
                                Pegar imagen
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center transition-opacity backdrop-blur-[1px] gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white hover:text-white hover:bg-white/20 rounded-full"
                              onClick={() => {
                                const url = prompt("Ingrese URL de la imagen:");
                                if (url) actualizarItem(item.id, "imagen", url);
                              }}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            <span className="text-[9px] text-white font-medium px-2 text-center">
                              Click o Ctrl+V
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-grow space-y-4 w-full">
                        <div className="flex justify-between items-start gap-4">
                          <div className="w-full space-y-1">
                            <Label className={labelClass}>
                              Descripción del Producto *
                            </Label>
                            <AutoResizeTextarea
                              value={item.descripcion}
                              onChange={(e) =>
                                actualizarItem(
                                  item.id,
                                  "descripcion",
                                  e.target.value,
                                )
                              }
                              placeholder=""
                              className="w-full text-sm text-slate-900 dark:text-gray-100 border-slate-200 dark:border-gray-700 focus:border-blue-500 bg-slate-50/30 dark:bg-gray-800/30 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-300 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 mt-5 h-8 w-8 transition-colors"
                            onClick={() => eliminarItem(item.id)}
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-4 items-end">
                          <div className="space-y-1">
                            <Label className={labelClass}>Cantidad *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) =>
                                actualizarItem(
                                  item.id,
                                  "cantidad",
                                  Number(e.target.value),
                                )
                              }
                              className={`${elegantInputClass} font-semibold text-center dark:text-gray-100`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className={labelClass}>Margen %</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={item.margen}
                                onChange={(e) =>
                                  actualizarItem(
                                    item.id,
                                    "margen",
                                    Number(e.target.value),
                                  )
                                }
                                className={`${elegantInputClass} bg-blue-50/30 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-center pr-6`}
                              />
                              <Percent className="absolute right-2 top-2 h-3.5 w-3.5 text-blue-400 opacity-70" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className={`${labelClass} text-right block`}>
                              Precio Unit.
                            </Label>
                            <Input
                              type="number"
                              value={Math.round(precioVentaItem(item))}
                              onChange={(e) =>
                                actualizarPrecioVenta(
                                  item.id,
                                  Number(e.target.value),
                                )
                              }
                              className={`${elegantInputClass} text-right font-medium text-slate-700 dark:text-gray-200`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              className={`${labelClass} text-right block text-blue-600 dark:text-blue-400`}
                            >
                              Subtotal
                            </Label>
                            <div className="text-right font-bold text-blue-700 dark:text-blue-400 text-sm h-8 flex items-center justify-end px-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
                              $
                              {Math.round(
                                precioVentaItem(item) * item.cantidad,
                              ).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-gray-800/50 border-t border-slate-100 dark:border-gray-700 px-4 py-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <h4 className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                          <DollarSign className="h-3 w-3" /> Costos Asociados
                        </h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => agregarSubcosto(item.id)}
                        className="h-6 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-2 text-[10px] font-bold uppercase tracking-wide"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Agregar Costo
                      </Button>
                    </div>
                    {/* ✅ MODIFICADO: Header con "Desc. %" */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                      <div className="col-span-3">Proveedor</div>
                      <div className="col-span-2">Código</div>
                      <div className="col-span-1 text-center">Cant</div>
                      <div className="col-span-2 text-right">Unitario</div>
                      <div className="col-span-2 text-right">Desc. %</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>
                    <div className="space-y-1.5">
                      {item.subcostos.map((subcosto) => (
                        <div
                          key={subcosto.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center group relative"
                        >
                          <div className="col-span-1 md:col-span-3">
                            <Input
                              value={subcosto.proveedor || ""}
                              onChange={(e) =>
                                actualizarSubcosto(
                                  item.id,
                                  subcosto.id,
                                  "proveedor",
                                  e.target.value,
                                )
                              }
                              className={`${elegantInputClass} h-7 text-[11px] dark:text-gray-100`}
                            />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <Input
                              value={subcosto.codigo || ""}
                              onChange={(e) =>
                                actualizarSubcosto(
                                  item.id,
                                  subcosto.id,
                                  "codigo",
                                  e.target.value,
                                )
                              }
                              className={`${elegantInputClass} h-7 text-[11px] dark:text-gray-100`}
                            />
                          </div>
                          <div className="col-span-1 md:col-span-1">
                            <Input
                              type="number"
                              value={subcosto.cantidad || 0}
                              onChange={(e) =>
                                actualizarSubcosto(
                                  item.id,
                                  subcosto.id,
                                  "cantidad",
                                  Number(e.target.value),
                                )
                              }
                              className={`${elegantInputClass} h-7 text-[11px] text-center px-1 dark:text-gray-100`}
                            />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <Input
                              type="number"
                              value={subcosto.precio_unitario || 0}
                              onChange={(e) =>
                                actualizarSubcosto(
                                  item.id,
                                  subcosto.id,
                                  "precio_unitario",
                                  Number(e.target.value),
                                )
                              }
                              className={`${elegantInputClass} h-7 text-[11px] text-right dark:text-gray-100`}
                            />
                          </div>
                          {/* ✅ MODIFICADO: Input de descuento con ícono % */}
                          <div className="col-span-1 md:col-span-2">
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={subcosto.descuento || 0}
                                onChange={(e) =>
                                  actualizarSubcosto(
                                    item.id,
                                    subcosto.id,
                                    "descuento",
                                    Number(e.target.value),
                                  )
                                }
                                className={`${elegantInputClass} h-7 text-[11px] text-right text-red-500 dark:text-red-400 pr-6`}
                              />
                              <Percent className="absolute right-2 top-1.5 h-3.5 w-3.5 text-red-400 opacity-70" />
                            </div>
                          </div>
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end gap-2">
                            <div className="min-w-[60px] text-right">
                              <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                                $
                                {Math.round(
                                  subcosto.valor || 0,
                                ).toLocaleString()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                              onClick={() =>
                                eliminarSubcosto(item.id, subcosto.id)
                              }
                              title="Eliminar costo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!cotizacion.items || cotizacion.items.length === 0) && (
              <div className="text-center py-16 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900">
                <div className="w-16 h-16 bg-slate-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="h-8 w-8 text-slate-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-gray-100">
                  Sin productos
                </h3>
                <p className="text-slate-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                  Agrega productos o servicios para comenzar tu cotización
                </p>
                <Button
                  onClick={agregarItem}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                >
                  <Plus className="mr-2 h-4 w-4" /> Agregar Primer Producto
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
