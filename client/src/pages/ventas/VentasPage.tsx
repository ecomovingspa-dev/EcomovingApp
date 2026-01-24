import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import * as XLSX from "xlsx";
import type { Venta } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Clock,
  FileText,
  Phone,
  Mail,
  User,
  X,
  Save,
  Upload,
  Loader2,
  Banknote,
  UserCheck,
  CalendarDays,
  Receipt,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  DollarSign,
  Settings, // Added Settings icon
} from "lucide-react";
import { ConfiguracionCobranza } from "@/components/ventas/ConfiguracionCobranza";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Filtros
  const [filtroRazonSocial, setFiltroRazonSocial] = useState("");
  const [filtroFolio, setFiltroFolio] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Cobranza
  const [cobranzaOpen, setCobranzaOpen] = useState<number | null>(null);
  const [cobranzaForm, setCobranzaForm] = useState({
    contacto_cobranza: "",
    correo_cobranza: "",
    telefono_cobranza: "",
    correo_vendedor: "",
  });
  const [guardando, setGuardando] = useState(false);

  // Abono
  const [abonoOpen, setAbonoOpen] = useState<number | null>(null);
  const [abonoForm, setAbonoForm] = useState({
    fecha_abono: new Date().toISOString().split("T")[0],
    tipo_abono: "",
    detalle_abono: "",
    monto_abono: "",
  });
  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const [abonosHistorial, setAbonosHistorial] = useState<any[]>([]);
  const [cargandoAbonos, setCargandoAbonos] = useState(false);
  const [configCobranzaOpen, setConfigCobranzaOpen] = useState(false);

  // Sincronización
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<any>(null);
  const [dialogResultadoOpen, setDialogResultadoOpen] = useState(false);

  useEffect(() => {
    cargarVentas();
  }, []);

  useEffect(() => {
    if (abonoOpen) {
      cargarAbonos(abonoOpen);
    } else {
      setAbonosHistorial([]);
    }
  }, [abonoOpen]);

  // Función auxiliar para calcular estado (debe estar antes de cargarVentas)
  const calcularEstado = (
    saldo: number,
    fchVenc: string | null,
    anulada: boolean,
    mntTotal?: number,
    totalNc?: number,
  ) => {
    // Anulada si está marcada como anulada O si MntTotal = TotalNc
    if (anulada || (mntTotal && totalNc && mntTotal === totalNc)) {
      return "Anulada";
    }

    if (saldo <= 0) return "Pagada";

    if (fchVenc) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaVenc = new Date(fchVenc);
      fechaVenc.setHours(0, 0, 0, 0);

      if (fechaVenc < hoy) return "Vencida";
      return "Pendiente";
    }

    return "Pendiente";
  };

  const cargarVentas = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("ventas")
        .select("*")
        .order("folio", { ascending: false });

      if (error) throw error;

      // IMPORTANTE: Recalcular estado_deuda para cada venta al cargar
      const ventasConEstadoActualizado = (data || []).map((venta) => ({
        ...venta,
        estado_deuda: calcularEstado(
          venta.saldo || 0,
          venta.fch_venc,
          venta.anulada || false,
          venta.mnt_total,
          venta.total_nc,
        ),
      }));

      setVentas(ventasConEstadoActualizado);
    } catch (e) {
      console.error("Error cargando ventas:", e);
    } finally {
      setCargando(false);
    }
  };

  // Cálculos del dashboard - CORREGIDO
  const summary = ventas.reduce(
    (acc, venta) => {
      const estado = venta.estado_deuda || "";
      const saldo = venta.saldo || 0;

      if (estado === "Pendiente") {
        acc.pendientes.count++;
        acc.pendientes.total += saldo;
      } else if (estado === "Vencida") {
        acc.vencidas.count++;
        acc.vencidas.total += saldo;
      }
      return acc;
    },
    {
      pendientes: { count: 0, total: 0 },
      vencidas: { count: 0, total: 0 },
      mensual: { count: 0, total: 0 },
    },
  );

  // Calcular totales mensuales en una pasada separada o integrar arriba si es posible
  // Lo integramos calculando en el render para asegurar reactividad correcta o extendemos el reduce
  // Mejor extendemos el reduce anterior
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  ventas.forEach((venta) => {
    // Sumar al acumulador mensual
    if (venta.fch_emis) {
      // Asumiendo formato YYYY-MM-DD
      const parts = venta.fch_emis.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1; // 0-indexed
        if (y === currentYear && m === currentMonth) {
          summary.mensual.count++;
          summary.mensual.total += venta.mnt_total || 0;
        }
      }
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pendiente":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
      case "Pagada":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
      case "Vencida":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      case "Anulada":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600";
    }
  };

  // Filtrado
  const ventasFiltradas = ventas
    .filter((venta) => {
      const matchRazonSocial =
        filtroRazonSocial === "" ||
        (venta.rzn_soc_recep || "")
          .toLowerCase()
          .includes(filtroRazonSocial.toLowerCase());

      const matchFolio =
        filtroFolio === "" ||
        String(venta.folio || "").includes(filtroFolio);

      let matchEstado = true;
      if (filtroEstado !== "todos") {
        matchEstado = venta.estado_deuda === filtroEstado;
      }

      return matchRazonSocial && matchFolio && matchEstado;
    })
    .sort((a, b) => {
      // Mantener orden descendente por folio después de filtrar
      const folioA = parseInt(a.folio) || 0;
      const folioB = parseInt(b.folio) || 0;
      return folioB - folioA;
    });

  // Paginación
  const totalPages = Math.ceil(ventasFiltradas.length / ITEMS_PER_PAGE);
  const paginatedVentas = ventasFiltradas.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // ==================== SINCRONIZACIÓN ====================

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = [".xls", ".xlsx"];
    const isValid = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );

    if (!isValid) {
      alert("Solo se permiten archivos .xls y .xlsx");
      return;
    }

    await procesarExcel(file);
  };

  const procesarExcel = async (file: File) => {
    setSincronizando(true);

    const resultado = {
      nuevas: 0,
      actualizadas: 0,
      sinCambios: 0,
      errores: [] as any[],
      avisos: [] as any[],
    };

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const filas = XLSX.utils.sheet_to_json(sheet) as any[];

      if (!filas || filas.length === 0) {
        alert("El archivo Excel está vacío");
        return;
      }

      for (const fila of filas) {
        try {
          if (!fila.Folio) {
            resultado.errores.push({
              fila: filas.indexOf(fila) + 2,
              error: "Folio vacío",
            });
            continue;
          }

          const { data: ventaExistente, error: errorBusqueda } = await supabase
            .from("ventas")
            .select("id, folio, total_nc, mnt_total, fch_venc, anulada")
            .eq("folio", String(fila.Folio))
            .maybeSingle();

          if (errorBusqueda) {
            resultado.errores.push({
              folio: fila.Folio,
              error: errorBusqueda.message,
            });
            continue;
          }

          if (!ventaExistente) {
            await insertarFacturaNueva(fila, resultado);
          } else {
            await actualizarFacturaExistente(ventaExistente, fila, resultado);
          }
        } catch (error: any) {
          resultado.errores.push({
            folio: fila.Folio,
            error: error.message,
          });
        }
      }

      setResultadoSync(resultado);
      setDialogResultadoOpen(true);
      await cargarVentas();
    } catch (error: any) {
      console.error("Error procesando Excel:", error);
      alert("Error al procesar archivo: " + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const insertarFacturaNueva = async (fila: any, resultado: any) => {
    const mntTotal = parseFloat(fila.MntTotal) || 0;
    const totalNc = parseFloat(fila.TotalNc) || 0;

    if (totalNc > mntTotal) {
      resultado.avisos.push({
        folio: fila.Folio,
        mensaje: `TotalNc ($${totalNc.toLocaleString()}) es mayor que MntTotal ($${mntTotal.toLocaleString()}). Revisar.`,
      });
    }

    const saldo = mntTotal - totalNc;

    const nuevaVenta = {
      folio: String(fila.Folio),
      rut_recep: fila.RutRecep || null,
      rzn_soc_recep: fila.RznSocRecep || null,
      tipo_dte: fila.TipoDTE || null,
      mnt_total: mntTotal,
      mnt_neto: parseFloat(fila.MntNeto) || 0,
      mnt_iva: parseFloat(fila.MntIVA) || 0,
      total_nc: totalNc,
      total_ncnd: parseFloat(fila.Totalncnd) || 0,
      saldo: saldo,
      fch_emis: parseFecha(fila.FchEmis),
      fch_venc: parseFecha(fila.FchVenc),
      fec_recepcion: parseFecha(fila.FecRecepcion),
      fec_reclamado: parseFecha(fila.FecReclamado),
      anulada: parseBoolean(fila.Anulada),
      dte_cesion: parseBoolean(fila.DteCesion),
      estado_deuda: calcularEstado(
        saldo,
        parseFecha(fila.FchVenc),
        parseBoolean(fila.Anulada),
        mntTotal,
        totalNc,
      ),
    };

    const { error } = await supabase.from("ventas").insert(nuevaVenta);

    if (error) throw error;

    resultado.nuevas++;
  };

  const actualizarFacturaExistente = async (
    ventaExistente: any,
    fila: any,
    resultado: any,
  ) => {
    const updates: any = {};
    let huboCambios = false;

    const nuevaFecReclamado = parseFecha(fila.FecReclamado);
    if (nuevaFecReclamado) {
      updates.fec_reclamado = nuevaFecReclamado;
      huboCambios = true;
    }

    const nuevoTotalNc = parseFloat(fila.TotalNc) || 0;
    const totalNcAnterior = ventaExistente.total_nc || 0;

    if (nuevoTotalNc !== totalNcAnterior) {
      updates.total_nc = nuevoTotalNc;

      if (nuevoTotalNc > ventaExistente.mnt_total) {
        resultado.avisos.push({
          folio: fila.Folio,
          mensaje: `TotalNc ($${nuevoTotalNc.toLocaleString()}) es mayor que MntTotal ($${ventaExistente.mnt_total.toLocaleString()}). Revisar.`,
        });
      }

      const { data: abonos } = await supabase
        .from("abonos")
        .select("monto_abono")
        .eq("venta_id", ventaExistente.id);

      const sumAbonos =
        abonos?.reduce((sum, a) => sum + (a.monto_abono || 0), 0) || 0;
      const nuevoSaldo = ventaExistente.mnt_total - nuevoTotalNc - sumAbonos;

      updates.saldo = nuevoSaldo;
      updates.estado_deuda = calcularEstado(
        nuevoSaldo,
        ventaExistente.fch_venc,
        ventaExistente.anulada,
        ventaExistente.mnt_total,
        nuevoTotalNc,
      );

      huboCambios = true;
    }

    if (huboCambios) {
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("ventas")
        .update(updates)
        .eq("id", ventaExistente.id);

      if (error) throw error;

      resultado.actualizadas++;
    } else {
      resultado.sinCambios++;
    }
  };

  const parseFecha = (fecha: any): string | null => {
    if (!fecha) return null;

    if (typeof fecha === "string") {
      return fecha;
    }

    if (typeof fecha === "number") {
      const excelEpoch = new Date(1900, 0, 1);
      const days = fecha - 2;
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      return date.toISOString().split("T")[0];
    }

    return null;
  };

  const parseBoolean = (valor: any): boolean => {
    if (typeof valor === "boolean") return valor;
    if (typeof valor === "string") {
      const valorLower = valor.toLowerCase();
      return (
        valorLower === "true" ||
        valorLower === "si" ||
        valorLower === "sí" ||
        valorLower === "1"
      );
    }
    if (typeof valor === "number") return valor === 1;
    return false;
  };

  // ==================== COBRANZA ====================

  const openCobranzaForm = (venta: Venta) => {
    setCobranzaForm({
      contacto_cobranza: venta.contacto_cobranza || "",
      correo_cobranza: venta.correo_cobranza || "",
      telefono_cobranza: venta.telefono_cobranza || "",
      correo_vendedor: venta.correo_vendedor || "",
    });
    setCobranzaOpen(venta.id);
  };

  const handleGuardarCobranza = async (ventaId: number) => {
    setGuardando(true);
    try {
      const { error } = await supabase
        .from("ventas")
        .update(cobranzaForm)
        .eq("id", ventaId);

      if (error) throw error;

      setVentas((prev) =>
        prev.map((v) => (v.id === ventaId ? { ...v, ...cobranzaForm } : v)),
      );
      setCobranzaOpen(null);
    } catch (e) {
      console.error("Error guardando cobranza:", e);
      alert("Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  // ==================== ABONO ====================

  const cargarAbonos = async (ventaId: number) => {
    setCargandoAbonos(true);
    try {
      const { data, error } = await supabase
        .from("abonos")
        .select("*")
        .eq("venta_id", ventaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAbonosHistorial(data || []);
    } catch (e) {
      console.error("Error cargando abonos:", e);
    } finally {
      setCargandoAbonos(false);
    }
  };

  const openAbonoForm = (venta: Venta) => {
    setAbonoForm({
      fecha_abono: new Date().toISOString().split("T")[0],
      tipo_abono: "",
      detalle_abono: "",
      monto_abono: "",
    });
    setAbonoOpen(venta.id);
  };

  const handleGuardarAbono = async (ventaId: number) => {
    setGuardandoAbono(true);
    try {
      const venta = ventas.find((v) => v.id === ventaId);
      if (!venta) {
        alert("Venta no encontrada");
        return;
      }

      const montoAbono = abonoForm.monto_abono
        ? parseFloat(abonoForm.monto_abono)
        : 0;
      if (montoAbono <= 0) {
        alert("El monto del abono debe ser mayor a 0");
        return;
      }

      const nuevoSaldo = Math.max(0, venta.saldo - montoAbono);
      const nuevoEstado = nuevoSaldo === 0 ? "Pagada" : venta.estado_deuda;

      const { error: errorAbono } = await supabase.from("abonos").insert({
        venta_id: ventaId,
        monto_abono: montoAbono,
        fecha_abono:
          abonoForm.fecha_abono || new Date().toISOString().split("T")[0],
        tipo_abono: abonoForm.tipo_abono || "transferencia",
        detalle_abono: abonoForm.detalle_abono || "",
      });

      if (errorAbono) throw errorAbono;

      const { error: errorVenta } = await supabase
        .from("ventas")
        .update({
          saldo: nuevoSaldo,
          estado_deuda: nuevoEstado,
        })
        .eq("id", ventaId);

      if (errorVenta) throw errorVenta;

      // Recargar abonos
      await cargarAbonos(ventaId);

      // Limpiar formulario y cerrar si se pagó total o dejar abierto para ver
      setAbonoForm({
        fecha_abono: new Date().toISOString().split("T")[0],
        tipo_abono: "",
        detalle_abono: "",
        monto_abono: "",
      });

      alert(
        "Pago guardado correctamente. Nuevo saldo: $" +
        nuevoSaldo.toLocaleString(),
      );

      setVentas((prev) =>
        prev.map((v) =>
          v.id === ventaId
            ? { ...v, saldo: nuevoSaldo, estado_deuda: nuevoEstado }
            : v,
        ),
      );
      // No cerramos el modal inmediatamente para que vea el historial actualizado
      // setAbonoOpen(null); 
    } catch (e: any) {
      console.error("Error guardando abono:", e);
      alert("Error al guardar: " + e.message);
    } finally {
      setGuardandoAbono(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      {/* Header & Stats */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Ventas y Facturación
            </h1>
          </div>

          {/* Botón sincronización Compacto */}
          <div className="flex items-center">
            <input
              type="file"
              id="sync-excel-input"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
              disabled={sincronizando}
            />
            <Label
              htmlFor="sync-excel-input"
              className={`cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 ${sincronizando ? 'opacity-70 cursor-wait' : ''}`}
            >
              {sincronizando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2 text-white" />
              )}
              {sincronizando ? "Procesando..." : "Sincronizar Facturas"}
            </Label>

            <Button
              variant="outline"
              className="h-10 gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/20"
              onClick={() => setConfigCobranzaOpen(true)}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurar Cobranza</span>
            </Button>
          </div>
        </div>

        {/* Tarjetas Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-yellow-400 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Facturas Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {summary.pendientes.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Documentos por cobrar
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-500">
                    ${summary.pendientes.total.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Monto Total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Facturas Vencidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {summary.vencidas.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Documentos atrasados
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-red-600 dark:text-red-500">
                    ${summary.vencidas.total.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Monto Total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                Facturación Mensual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {summary.mensual.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Emitidas este mes
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    ${summary.mensual.total.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Monto Total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Detalle de Facturas
          </h2>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] max-w-[400px]">
              <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                Buscar por Razón Social
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Escriba para buscar cliente..."
                  value={filtroRazonSocial}
                  onChange={(e) => {
                    setFiltroRazonSocial(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-9"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[150px] max-w-[200px]">
              <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                Folio
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="N° Folio"
                  value={filtroFolio}
                  onChange={(e) => {
                    setFiltroFolio(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-9"
                />
              </div>
            </div>

            <div className="min-w-[180px]">
              <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                Filtrar por Estado
              </Label>
              <Select
                value={filtroEstado}
                onValueChange={(value) => {
                  setFiltroEstado(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <Filter className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Pagada">Pagada</SelectItem>
                  <SelectItem value="Vencida">Vencida</SelectItem>
                  <SelectItem value="Anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(filtroRazonSocial || filtroEstado !== "todos") && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltroRazonSocial("");
                    setFiltroEstado("todos");
                    setCurrentPage(1);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar filtros
                </Button>
              </div>
            )}
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {ventasFiltradas.length} de {ventas.length} facturas
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            Cargando facturas...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 font-semibold">Emisión</th>
                  <th className="px-6 py-3 font-semibold text-center">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 font-semibold">Folio</th>
                  <th className="px-6 py-3 font-semibold">Razón Social</th>
                  <th className="px-6 py-3 font-semibold text-right">
                    Monto Total
                  </th>
                  <th className="px-6 py-3 font-semibold text-center">N.C.</th>
                  <th className="px-6 py-3 font-semibold text-right">Saldo</th>
                  <th className="px-6 py-3 font-semibold text-center">
                    Estado
                  </th>
                  <th className="px-6 py-3 font-semibold text-center w-10">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedVentas.map((venta) => (
                  <tr
                    key={venta.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {venta.fch_emis}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {venta.fch_venc}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {venta.folio}
                    </td>
                    <td className="px-6 py-4 text-gray-800 dark:text-gray-200 font-medium">
                      {venta.rzn_soc_recep}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                      ${venta.mnt_total?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-red-500 font-semibold">
                      {venta.total_nc ? `$${venta.total_nc.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                      ${venta.saldo?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(venta.estado_deuda)}`}
                      >
                        {venta.estado_deuda}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {/* Popover Cobranza */}
                        <Popover
                          open={cobranzaOpen === venta.id}
                          onOpenChange={(open) => {
                            if (open) openCobranzaForm(venta);
                            else setCobranzaOpen(null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-orange-50"
                              title="Datos de cobranza"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-orange-600" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-72 p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
                            align="end"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  Cobranza
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setCobranzaOpen(null)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Nombre
                                  </Label>
                                  <div className="relative">
                                    <User className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      value={cobranzaForm.contacto_cobranza}
                                      onChange={(e) =>
                                        setCobranzaForm((prev) => ({
                                          ...prev,
                                          contacto_cobranza: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                      placeholder="Nombre contacto"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Correo
                                  </Label>
                                  <div className="relative">
                                    <Mail className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      value={cobranzaForm.correo_cobranza}
                                      onChange={(e) =>
                                        setCobranzaForm((prev) => ({
                                          ...prev,
                                          correo_cobranza: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                      placeholder="correo@empresa.cl"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Teléfono
                                  </Label>
                                  <div className="relative">
                                    <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      value={cobranzaForm.telefono_cobranza}
                                      onChange={(e) =>
                                        setCobranzaForm((prev) => ({
                                          ...prev,
                                          telefono_cobranza: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                      placeholder="+56 9..."
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Correo Vendedor
                                  </Label>
                                  <div className="relative">
                                    <Mail className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      value={cobranzaForm.correo_vendedor}
                                      onChange={(e) =>
                                        setCobranzaForm((prev) => ({
                                          ...prev,
                                          correo_vendedor: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                      placeholder="vendedor@empresa.cl"
                                    />
                                  </div>
                                </div>

                                {/* Campos informativos (solo lectura) */}
                                {(ventas.find((v) => v.id === cobranzaOpen)
                                  ?.ultimo_tipo_aviso ||
                                  ventas.find((v) => v.id === cobranzaOpen)
                                    ?.fecha_ultimo_aviso) && (
                                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                      <p className="text-[10px] uppercase text-gray-500 font-semibold mb-2">
                                        Información de Cobranza
                                      </p>
                                      {ventas.find((v) => v.id === cobranzaOpen)
                                        ?.ultimo_tipo_aviso && (
                                          <div className="flex justify-between items-center py-1">
                                            <span className="text-xs text-gray-600">
                                              Último Aviso:
                                            </span>
                                            <span className="text-xs font-medium text-gray-900 dark:text-gray-200 capitalize">
                                              {
                                                ventas.find(
                                                  (v) => v.id === cobranzaOpen,
                                                )?.ultimo_tipo_aviso
                                              }
                                            </span>
                                          </div>
                                        )}
                                      {ventas.find((v) => v.id === cobranzaOpen)
                                        ?.fecha_ultimo_aviso && (
                                          <div className="flex justify-between items-center py-1">
                                            <span className="text-xs text-gray-600">
                                              Fecha Aviso:
                                            </span>
                                            <span className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                              {
                                                ventas.find(
                                                  (v) => v.id === cobranzaOpen,
                                                )?.fecha_ultimo_aviso
                                              }
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                  )}
                              </div>
                              <Button
                                size="sm"
                                className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700"
                                onClick={() => handleGuardarCobranza(venta.id)}
                                disabled={guardando}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                {guardando ? "Guardando..." : "Guardar"}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Popover Abono */}
                        <Popover
                          open={abonoOpen === venta.id}
                          onOpenChange={(open) => {
                            if (open) openAbonoForm(venta);
                            else setAbonoOpen(null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-green-50"
                              title="Registrar pago"
                            >
                              <Banknote className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-72 p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
                            align="end"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  Registrar Pago
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setAbonoOpen(null)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* Historial de Abonos */}
                              {cargandoAbonos ? (
                                <div className="text-center py-2 text-xs text-gray-400">
                                  Cargando historial...
                                </div>
                              ) : abonosHistorial.length > 0 ? (
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-2 max-h-32 overflow-y-auto mb-3 border border-gray-100 dark:border-gray-700">
                                  <h5 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                    Pagos realizados
                                  </h5>
                                  <div className="space-y-2">
                                    {abonosHistorial.map((abono) => (
                                      <div
                                        key={abono.id}
                                        className="flex justify-between items-start text-xs border-b border-gray-100 dark:border-gray-800 last:border-0 pb-1 last:pb-0"
                                      >
                                        <div>
                                          <div className="font-medium text-gray-800 dark:text-gray-200">
                                            ${abono.monto_abono?.toLocaleString()}
                                          </div>
                                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                            {abono.fecha_abono}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-medium text-gray-600 dark:text-gray-300 capitalize">
                                            {abono.tipo_abono?.replace("_", " ")}
                                          </div>
                                          {abono.detalle_abono && (
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[100px]" title={abono.detalle_abono}>
                                              {abono.detalle_abono}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-center py-2 text-gray-400 italic">
                                  No hay pagos registrados
                                </div>
                              )}

                              <div className="space-y-2 pt-2 border-t border-gray-100">
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Fecha
                                  </Label>
                                  <div className="relative">
                                    <CalendarDays className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      type="date"
                                      value={abonoForm.fecha_abono}
                                      onChange={(e) =>
                                        setAbonoForm((prev) => ({
                                          ...prev,
                                          fecha_abono: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Tipo
                                  </Label>
                                  <Select
                                    value={abonoForm.tipo_abono}
                                    onValueChange={(val) =>
                                      setAbonoForm((prev) => ({
                                        ...prev,
                                        tipo_abono: val,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="transferencia">
                                        Transferencia
                                      </SelectItem>
                                      <SelectItem value="cheque">
                                        Cheque
                                      </SelectItem>
                                      <SelectItem value="efectivo">
                                        Efectivo
                                      </SelectItem>
                                      <SelectItem value="nota_credito">
                                        Nota de Crédito
                                      </SelectItem>
                                      <SelectItem value="otro">Otro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Monto
                                  </Label>
                                  <div className="relative">
                                    <DollarSign className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      type="number"
                                      value={abonoForm.monto_abono}
                                      onChange={(e) =>
                                        setAbonoForm((prev) => ({
                                          ...prev,
                                          monto_abono: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase text-gray-500 font-semibold">
                                    Detalle
                                  </Label>
                                  <div className="relative">
                                    <Receipt className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                      value={abonoForm.detalle_abono}
                                      onChange={(e) =>
                                        setAbonoForm((prev) => ({
                                          ...prev,
                                          detalle_abono: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-xs pl-7"
                                      placeholder="Nota..."
                                    />
                                  </div>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => handleGuardarAbono(venta.id)}
                                disabled={guardandoAbono}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                {guardandoAbono ? "Guardando..." : "Guardar"}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!cargando && ventasFiltradas.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, ventasFiltradas.length)}{" "}
              de {ventasFiltradas.length} facturas
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Anterior
              </button>
              <div className="flex items-center px-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Página {currentPage} de {totalPages}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog Resultado */}
      <Dialog open={dialogResultadoOpen} onOpenChange={setDialogResultadoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resultado de Sincronización</DialogTitle>
            <DialogDescription>
              Resumen de la importación desde Excel
            </DialogDescription>
          </DialogHeader>
          {resultadoSync && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Resultado de Importación</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {resultadoSync.nuevas}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Nuevas</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <RefreshCw className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {resultadoSync.actualizadas}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      Actualizadas
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <XCircle className="h-8 w-8 text-gray-600 dark:text-gray-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                      {resultadoSync.sinCambios}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      Sin cambios
                    </p>
                  </div>
                </div>
              </div>

              {resultadoSync.errores && resultadoSync.errores.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Errores ({resultadoSync.errores.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded border border-red-200 text-xs">
                    {resultadoSync.errores.map((err: any, idx: number) => (
                      <div key={idx} className="mb-1">
                        <span className="font-semibold">
                          {err.folio
                            ? `Folio ${err.folio}`
                            : `Fila ${err.fila}`}
                          :
                        </span>{" "}
                        {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resultadoSync.avisos && resultadoSync.avisos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-600 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Avisos ({resultadoSync.avisos.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto bg-yellow-50 p-3 rounded border border-yellow-200 text-xs">
                    {resultadoSync.avisos.map((aviso: any, idx: number) => (
                      <div key={idx} className="mb-1">
                        <span className="font-semibold">
                          Folio {aviso.folio}:
                        </span>{" "}
                        {aviso.mensaje}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setDialogResultadoOpen(false)}
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfiguracionCobranza
        open={configCobranzaOpen}
        onOpenChange={setConfigCobranzaOpen}
      />
    </div >
  );
}
