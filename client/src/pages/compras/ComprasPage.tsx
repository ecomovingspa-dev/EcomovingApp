
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertCircle,
    Clock,
    Upload,
    Loader2,
    CalendarDays,
    Search,
    ShoppingBag,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Check,
    Banknote,
    DollarSign,
    Receipt,
    Save,
    X,
    Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Tipos adaptados para Compras
interface Compra {
    id: number;
    tipo_dte: number;
    folio: number;
    fecha_emision: string | null;
    fecha_vencimiento: string | null;
    rut_proveedor: string | null;
    razon_social: string | null;
    monto_total: number;
    // New Fields
    monto_exento?: number;
    monto_sin_credito?: number;
    impuestos_especificos?: number;
    codigo_sucursal?: string | null;
    lista_referencias?: string | null;
    iva_uso_comun?: number;
    lista_nc: string | null;
    saldo: number;
    estado_pago: string; // 'Pendiente', 'Pagada', 'Vencida'
    conciliado?: boolean;
    created_at: string;
}

export default function ComprasPage() {
    const [compras, setCompras] = useState<Compra[]>([]);
    const [cargando, setCargando] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Filtros
    const [filtroProveedor, setFiltroProveedor] = useState("");
    const [filtroFolio, setFiltroFolio] = useState("");
    const [filtroEstado, setFiltroEstado] = useState<string>("todos");
    const [filtroMes, setFiltroMes] = useState<string>("todos");
    const [filtroAnio, setFiltroAnio] = useState<string>("todos");

    // Sincronización
    const [sincronizando, setSincronizando] = useState(false);
    const [resultadoSync, setResultadoSync] = useState<any>(null);
    const [dialogResultadoOpen, setDialogResultadoOpen] = useState(false);


    useEffect(() => {
        cargarCompras();
    }, [currentPage, filtroProveedor, filtroFolio, filtroEstado, filtroMes, filtroAnio]);



    const calcularEstado = (
        saldo: number,
        fchVenc: string | null,
        estadoActual: string
    ) => {
        if (saldo <= 0) return "Pagada";

        if (fchVenc) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const fechaVenc = new Date(fchVenc);
            fechaVenc.setHours(0, 0, 0, 0);

            if (fechaVenc < hoy) return "Vencida";
            return "Pendiente";
        }

        return estadoActual || "Pendiente";
    };

    const [totalRecords, setTotalRecords] = useState(0);
    const [allComprasForSummary, setAllComprasForSummary] = useState<any[]>([]);

    const cargarCompras = async () => {
        setCargando(true);
        try {
            let query = supabase
                .from("compras")
                .select("*", { count: "exact" });

            if (filtroProveedor) {
                const term = `*${filtroProveedor.trim()}*`;
                query = query.or(`razon_social.ilike."${term}",rut_proveedor.ilike."${term}"`);
            }
            if (filtroFolio) {
                query = query.ilike("folio", `%${filtroFolio.trim()}%`);
            }
            if (filtroEstado !== "todos") {
                if (filtroEstado === "Vencida") {
                    const hoyStr = new Date().toISOString().split('T')[0];
                    query = query.or(`estado_pago.eq.Vencida,and(saldo.gt.0,fecha_vencimiento.lt.${hoyStr})`);
                } else if (filtroEstado === "Pendiente") {
                    const hoyStr = new Date().toISOString().split('T')[0];
                    query = query.eq("estado_pago", "Pendiente").or(`fecha_vencimiento.gte.${hoyStr},fecha_vencimiento.is.null`);
                } else {
                    query = query.eq("estado_pago", filtroEstado);
                }
            }

            if (filtroAnio !== "todos") {
                if (filtroMes !== "todos") {
                    const lastDay = new Date(parseInt(filtroAnio), parseInt(filtroMes), 0).getDate();
                    const formattedMonth = filtroMes.padStart(2, "0");
                    query = query.gte("fecha_emision", `${filtroAnio}-${formattedMonth}-01`)
                                 .lte("fecha_emision", `${filtroAnio}-${formattedMonth}-${lastDay}`);
                } else {
                    query = query.gte("fecha_emision", `${filtroAnio}-01-01`)
                                 .lte("fecha_emision", `${filtroAnio}-12-31`);
                }
            } else if (filtroMes !== "todos") {
                const years = ["2023", "2024", "2025", "2026", "2027"];
                const formattedMonth = filtroMes.padStart(2, "0");
                const orConditions = years.map(yr => {
                    const lastDay = new Date(parseInt(yr), parseInt(filtroMes), 0).getDate();
                    return `and(fecha_emision.gte.${yr}-${formattedMonth}-01,fecha_emision.lte.${yr}-${formattedMonth}-${lastDay})`;
                }).join(",");
                query = query.or(orConditions);
            }

            const { data, error, count } = await query
                .order("fecha_emision", { ascending: false })
                .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

            if (error) throw error;

            // Recalcular estados visuales
            const comprasProcesadas = (data || []).map((compra) => ({
                ...compra,
                estado_pago: calcularEstado(
                    compra.saldo !== undefined ? compra.saldo : compra.monto_total,
                    compra.fecha_vencimiento,
                    compra.estado_pago
                ),
            }));

            setCompras(comprasProcesadas);
            if (count !== null) setTotalRecords(count);

            // Fetch summary data separately for accuracy
            const { data: sData } = await supabase
                .from("compras")
                .select("monto_total, saldo, fecha_vencimiento, estado_pago, fecha_emision");

            if (sData) setAllComprasForSummary(sData);

        } catch (e) {
            console.error("Error cargando compras:", e);
        } finally {
            setCargando(false);
        }
    };


    const getStatusColor = (status: string) => {
        switch (status) {
            case "Pendiente":
                return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
            case "Pagada":
                return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
            case "Vencida":
                return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600";
        }
    };

    // Cálculos del dashboard
    const summary = allComprasForSummary.reduce(
        (acc, compra) => {
            const saldo = compra.saldo !== undefined ? compra.saldo : compra.monto_total;
            const estado = calcularEstado(saldo, compra.fecha_vencimiento, compra.estado_pago || "");

            if (saldo > 0) {
                acc.pendientes.count++;
                acc.pendientes.total += saldo;
            }
            if (estado === "Vencida") {
                acc.vencidas.count++;
                acc.vencidas.total += saldo;
            }
            return acc;
        },
        {
            pendientes: { count: 0, total: 0 },
            vencidas: { count: 0, total: 0 },
            mensual: { count: 0, total: 0 },
        }
    );

    // Totales Mensuales
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    allComprasForSummary.forEach((compra) => {
        if (compra.fecha_emision) {
            const parts = compra.fecha_emision.split("-"); // YYYY-MM-DD
            if (parts.length === 3) {
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                if (y === currentYear && m === currentMonth) {
                    summary.mensual.count++;
                    summary.mensual.total += compra.monto_total || 0;
                }
            }
        }
    });

    // Filtrado - Now just using the already-filtered 'compras' from server
    const comprasFiltradas = compras;

    // Paginación
    const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);
    const paginatedCompras = compras; // Ya paginadas por el servidor


    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    // ==================== SINCRONIZACIÓN (Upload) ====================

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validExtensions = [".xls", ".xlsx"];
        const isValid = validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!isValid) {
            alert("Solo se permiten archivos .xls y .xlsx");
            return;
        }

        await procesarExcel(file);
    };

    const parseFecha = (fecha: any): string | null => {
        if (!fecha) return null;
        if (typeof fecha === "string") return fecha;
        if (typeof fecha === "number") {
            const excelEpoch = new Date(1900, 0, 1);
            const days = fecha - 2;
            const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
            return date.toISOString().split("T")[0];
        }
        return null;
    };

    const procesarExcel = async (file: File) => {
        setSincronizando(true);
        const resultado = {
            nuevas: 0,
            actualizadas: 0,
            errores: [] as any[],
        };

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const filas = XLSX.utils.sheet_to_json(sheet);

            if (!filas || filas.length === 0) {
                alert("El archivo Excel está vacío");
                return;
            }

            console.log("Primera fila detectada:", filas[0]);

            for (const fila of filas as any[]) {
                const rutProveedor = fila["RUT Proveedor"] || fila.RUTProveedor;
                const folio = fila.Folio !== undefined ? String(fila.Folio) : "";
                const tipoDte = parseInt(fila["Tipo Doc"] || fila.TipoDTE) || 0;

                try {
                    if (!folio || !rutProveedor) {
                        continue;
                    }

                    if (!tipoDte || tipoDte <= 0) {
                        throw new Error(`Tipo de documento inválido o no especificado para Folio ${folio}`);
                    }

                    // Verificar si ya existe
                    const { data: existente } = await supabase
                        .from("compras")
                        .select("id")
                        .eq("rut_proveedor", rutProveedor)
                        .eq("tipo_dte", tipoDte)
                        .eq("folio", folio)
                        .maybeSingle();

                    const fechaEmision = parseFecha(fila["Fecha Docto"] || fila.FchEmis);
                    const fechaRecepcion = parseFecha(fila["Fecha Recepcion"] || fila.FecRecepcion);
                    const fechaVencimiento = parseFecha(fila["Fecha Vencimiento"] || fila.FchVenc) || fechaEmision;

                    const nuevaCompra = {
                        tipo_dte: tipoDte,
                        folio: folio,
                        fecha_recepcion: fechaRecepcion,
                        fecha_emision: fechaEmision,
                        fecha_vencimiento: fechaVencimiento,
                        rut_proveedor: rutProveedor,
                        razon_social: fila["Razon Social"] || fila.RznSoc,
                        monto_total: parseFloat(fila["Monto Total"]) || parseFloat(fila.MntTotal) || 0,
                        lista_nc: fila.ListaNC || null,
                        monto_neto: parseFloat(fila["Monto Neto"]) || parseFloat(fila.MntNeto) || 0,
                        monto_iva: parseFloat(fila["Monto IVA Recuperable"]) || parseFloat(fila.MntIVA) || 0,
                        monto_exento: parseFloat(fila["Monto Exento"]) || parseFloat(fila.MntExe) || 0,
                        monto_sin_credito: parseFloat(fila["Monto IVA No Recuperable"]) || parseFloat(fila.MntSinCred) || parseFloat(fila.MntIvaNoRec) || 0,
                        impuestos_especificos: parseFloat(fila["Valor Otro Impuesto"]) || parseFloat(fila.OtroImp) || parseFloat(fila.Impuestos) || 0,
                        codigo_sucursal: fila["Codigo Sucursal"] || fila.CdgSIISucur || fila.Sucursal || null,
                        lista_referencias: fila.ListaRef || null,
                        iva_uso_comun: parseFloat(fila["IVA Uso Comun"]) || parseFloat(fila.IVAUsoComun) || parseFloat(fila.MntIVAUsoComun) || 0,
                        estado_contable: fila["Tipo Compra"] || fila.EstadoContab || "Del Giro",
                        saldo: parseFloat(fila["Monto Total"]) || parseFloat(fila.MntTotal) || 0,
                        estado_pago: "Pendiente"
                    };

                    if (!existente) {
                        const { error } = await supabase.from("compras").insert(nuevaCompra);
                        if (error) throw error;
                        resultado.nuevas++;
                    } else {
                        resultado.actualizadas++;
                    }

                } catch (error: any) {
                    resultado.errores.push({
                        folio: folio,
                        error: error.message,
                    });
                }
            }

            setResultadoSync(resultado);
            setDialogResultadoOpen(true);
            await cargarCompras();

        } catch (error: any) {
            console.error("Error procesando Excel:", error);
            const msg = error.message || "Error desconocido";
            alert(`Error al procesar archivo: ${msg}`);
        } finally {
            setSincronizando(false);
        }
    };

    // Estado Abono/Pago
    const [abonoOpen, setAbonoOpen] = useState<number | null>(null);
    const [guardandoAbono, setGuardandoAbono] = useState(false);
    const [abonoForm, setAbonoForm] = useState({
        fecha_abono: new Date().toISOString().split("T")[0],
        tipo_abono: "",
        detalle_abono: "",
        monto_abono: "",
    });

    // Historial de Abonos
    const [abonosHistorial, setAbonosHistorial] = useState<any[]>([]);
    const [cargandoAbonos, setCargandoAbonos] = useState(false);

    const cargarAbonos = async (compraId: number) => {
        setCargandoAbonos(true);
        try {
            const { data, error } = await supabase
                .from("compras_abonos")
                .select("*")
                .eq("compra_id", compraId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAbonosHistorial(data || []);
        } catch (e) {
            console.error("Error cargando abonos:", e);
        } finally {
            setCargandoAbonos(false);
        }
    };

    // Abrir formulario
    const openAbonoForm = (compra: Compra) => {
        setAbonoOpen(compra.id);
        cargarAbonos(compra.id);
        // Pre-fill amount with pending balance
        setAbonoForm({
            fecha_abono: new Date().toISOString().split("T")[0],
            tipo_abono: "transferencia", // default
            detalle_abono: "",
            monto_abono: String(compra.saldo > 0 ? compra.saldo : 0),
        });
    };

    const handleGuardarAbono = async (compraId: number) => {
        try {
            setGuardandoAbono(true);
            const monto = parseFloat(abonoForm.monto_abono) || 0;
            if (monto <= 0) {
                alert("El monto debe ser mayor a 0");
                return;
            }

            const compra = compras.find(c => c.id === compraId);
            if (!compra) return;

            // 1. Calcular nuevo saldo
            const nuevoSaldo = Math.max(0, compra.saldo - monto);
            const nuevoEstado = nuevoSaldo === 0 ? "Pagada" : "Pendiente"; // Simple logic

            // 2. Actualizar Tabla compras
            const { error } = await supabase
                .from("compras")
                .update({
                    saldo: nuevoSaldo,
                    estado_pago: nuevoEstado
                })
                .eq("id", compraId);

            if (error) throw error;

            // 3. Crear Registro de Abono
            await supabase.from("compras_abonos").insert({
                compra_id: compraId,
                monto_abono: monto,
                fecha_abono: abonoForm.fecha_abono || new Date().toISOString().split("T")[0],
                tipo_abono: abonoForm.tipo_abono || "transferencia",
                detalle_abono: abonoForm.detalle_abono || ""
            });

            // Si funciona:
            setAbonoOpen(null);
            cargarCompras(); // Recargar datos
            alert("Pago registrado correctamente");

        } catch (error: any) {
            console.error("Error guardando abono:", error);
            alert("Error al guardar pago: " + error.message);
        } finally {
            setGuardandoAbono(false);
        }
    };


    // ==================== CORRECCIÓN MANUAL ====================
    const [correctionOpen, setCorrectionOpen] = useState<number | null>(null);
    const [correctionForm, setCorrectionForm] = useState({
        saldo: 0,
        estado_pago: "",
        conciliado: false
    });

    const openCorrectionForm = (compra: Compra) => {
        setCorrectionForm({
            saldo: compra.saldo,
            estado_pago: compra.estado_pago,
            conciliado: compra.conciliado || false
        });
        setCorrectionOpen(compra.id);
    };

    const handleManualCorrection = async (compraId: number) => {
        try {
            const { error } = await supabase
                .from("compras")
                .update({
                    saldo: correctionForm.saldo,
                    estado_pago: correctionForm.estado_pago,
                    conciliado: correctionForm.conciliado
                })
                .eq("id", compraId);

            if (error) throw error;

            setCompras(prev => prev.map(c => c.id === compraId ? { ...c, ...correctionForm } : c));
            setCorrectionOpen(null);
            alert("Registro corregido correctamente");
        } catch (e: any) {
            alert("Error al corregir: " + e.message);
        }
    };


    return (
        <div className="space-y-6 pb-10 fade-in-up">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8 text-pink-600" />
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Libros de Compras
                        </h1>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="file"
                            id="sync-compras-input"
                            accept=".xls,.xlsx"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={sincronizando}
                        />
                        <Label
                            htmlFor="sync-compras-input"
                            className={`cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 bg-pink-600 text-white hover:bg-pink-700 dark:bg-pink-600 dark:hover:bg-pink-700 ${sincronizando ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {sincronizando ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                            ) : (
                                <Upload className="h-4 w-4 mr-2 text-white" />
                            )}
                            {sincronizando ? "Cargando Detalle..." : "Cargar Detalle Compras SII"}
                        </Label>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-l-4 border-l-yellow-400 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                Por Pagar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {summary.pendientes.count}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Documentos pendientes
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-500">
                                        ${summary.pendientes.total.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold">
                                        Deuda Total
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-500 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                Vencidas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {summary.vencidas.count}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Documentos Vencidos
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-red-600 dark:text-red-500">
                                        ${summary.vencidas.total.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-pink-500 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-pink-500" />
                                Compras del Mes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {summary.mensual.count}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Ingresadas este mes
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-pink-600 dark:text-pink-400">
                                        ${summary.mensual.total.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters and Search */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Buscar Proveedor</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Nombre o RUT..."
                                        value={filtroProveedor}
                                        onChange={(e) => {
                                            setFiltroProveedor(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-10 h-10 border-gray-200 focus:border-pink-500 focus:ring-pink-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Folio</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="N° Folio"
                                        value={filtroFolio}
                                        onChange={(e) => {
                                            setFiltroFolio(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-10 h-10 border-gray-200 focus:border-pink-500 focus:ring-pink-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</Label>
                                <Select value={filtroEstado} onValueChange={(val) => {
                                    setFiltroEstado(val);
                                    setCurrentPage(1);
                                }}>
                                    <SelectTrigger className="h-10 border-gray-200 focus:ring-pink-500 transition-all">
                                        <SelectValue placeholder="Seleccionar Estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los estados</SelectItem>
                                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                                        <SelectItem value="Pagada">Pagada</SelectItem>
                                        <SelectItem value="Vencida">Vencida</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mes</Label>
                                <Select value={filtroMes} onValueChange={(val) => {
                                    setFiltroMes(val);
                                    setCurrentPage(1);
                                }}>
                                    <SelectTrigger className="h-10 border-gray-200 focus:ring-pink-500 transition-all">
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="1">Enero</SelectItem>
                                        <SelectItem value="2">Febrero</SelectItem>
                                        <SelectItem value="3">Marzo</SelectItem>
                                        <SelectItem value="4">Abril</SelectItem>
                                        <SelectItem value="5">Mayo</SelectItem>
                                        <SelectItem value="6">Junio</SelectItem>
                                        <SelectItem value="7">Julio</SelectItem>
                                        <SelectItem value="8">Agosto</SelectItem>
                                        <SelectItem value="9">Septiembre</SelectItem>
                                        <SelectItem value="10">Octubre</SelectItem>
                                        <SelectItem value="11">Noviembre</SelectItem>
                                        <SelectItem value="12">Diciembre</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Año</Label>
                                <Select value={filtroAnio} onValueChange={(val) => {
                                    setFiltroAnio(val);
                                    setCurrentPage(1);
                                }}>
                                    <SelectTrigger className="h-10 border-gray-200 focus:ring-pink-500 transition-all">
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="2027">2027</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2024">2024</SelectItem>
                                        <SelectItem value="2023">2023</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-3">Emisión</th>
                                    <th className="px-6 py-3">Vencim.</th>
                                    <th className="px-6 py-3">Folio</th>
                                    <th className="px-6 py-3">Proveedor</th>
                                    <th className="px-6 py-3 text-right">Monto</th>
                                    <th className="px-6 py-3 text-center">N.C.</th>
                                    <th className="px-6 py-3 text-right">Saldo</th>
                                    <th className="px-6 py-3 text-center">Estado</th>
                                    <th className="px-6 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {cargando ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-pink-500" />
                                            <p>Cargando compras...</p>
                                        </td>
                                    </tr>
                                ) : paginatedCompras.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                                            No se encontraron documentos
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCompras.map((compra) => (
                                        <tr key={compra.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                                                {compra.fecha_emision}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                                                {compra.fecha_vencimiento || "-"}
                                            </td>
                                            <td className="px-6 py-3 text-gray-600 dark:text-gray-300">
                                                {compra.folio}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1 max-w-[200px]" title={compra.razon_social || ""}>
                                                    {compra.razon_social}
                                                </div>
                                                <div className="text-xs text-gray-500">{compra.rut_proveedor}</div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                                                ${compra.monto_total.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-center text-xs text-red-500">
                                                {compra.lista_nc || "-"}
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-500 dark:text-gray-400">
                                                ${(compra.saldo || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(compra.estado_pago)}`}>
                                                        {compra.estado_pago}
                                                    </span>
                                                    {compra.conciliado ? (
                                                        <Badge variant="default" className="bg-emerald-500 text-white border-none text-[9px] px-1.5 py-0">
                                                            <Check className="w-2 h-2 mr-1" /> CONCILIADA
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="bg-rose-500 text-white border-none text-[9px] px-1.5 py-0">
                                                            SIN BANCARIZAR
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {/* Boton Pagar (Popover) */}
                                                <Popover
                                                    open={abonoOpen === compra.id}
                                                    onOpenChange={(open) => {
                                                        if (open) openAbonoForm(compra);
                                                        else setAbonoOpen(null);
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-9 w-9 p-0 hover:bg-green-50 dark:hover:bg-green-900/20 shadow-sm border border-gray-100 dark:border-gray-700"
                                                            title="Registrar Pago"
                                                        >
                                                            <Banknote className="h-5 w-5 text-green-600" />
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

                                                            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                                                {/* Historial de Pagos Anteriores */}
                                                                {abonosHistorial.length > 0 && (
                                                                    <div className="mb-4 space-y-1">
                                                                        <Label className="text-[10px] uppercase text-indigo-500 font-bold">Pagos Registrados</Label>
                                                                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                                            {abonosHistorial.map((abono) => (
                                                                                <div key={abono.id} className="text-[10px] flex justify-between bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded border border-gray-100 dark:border-gray-800">
                                                                                    <span className="text-gray-500">{abono.fecha_abono}</span>
                                                                                    <span className="font-bold text-gray-700 dark:text-gray-300">
                                                                                        ${Number(abono.monto_abono).toLocaleString()}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
                                                                        Nueva Fecha
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
                                                                    <Label className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
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
                                                                            <SelectItem value="tarjeta">
                                                                                Tarjeta
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
                                                                        Monto a Pagar
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
                                                                    <Label className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
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
                                                                onClick={() => handleGuardarAbono(compra.id)}
                                                                disabled={guardandoAbono}
                                                            >
                                                                <Save className="h-3 w-3 mr-1" />
                                                                {guardandoAbono ? "Guardando..." : "Guardar"}
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>

                                                {/* Popover Corrección Manual */}
                                                <Popover
                                                    open={correctionOpen === compra.id}
                                                    onOpenChange={(open) => {
                                                        if (open) openCorrectionForm(compra);
                                                        else setCorrectionOpen(null);
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-900/10 shadow-sm border border-gray-100 dark:border-gray-700 ml-1"
                                                            title="Corregir estado manualmente"
                                                        >
                                                            <Settings2 className="h-5 w-5 text-gray-500 hover:text-red-600" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-72 p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
                                                        align="end"
                                                    >
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-semibold text-red-600">
                                                                    Corrección Manual
                                                                </h4>
                                                            </div>

                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                                                                Usa esto solo para corregir errores de estado o saldo.
                                                            </p>

                                                            <div className="space-y-3">
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-gray-400 font-semibold">Saldo Pendiente</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={correctionForm.saldo}
                                                                        onChange={(e) => setCorrectionForm(prev => ({ ...prev, saldo: parseFloat(e.target.value) || 0 }))}
                                                                        className="h-8 text-xs dark:bg-gray-950"
                                                                    />
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-gray-400 font-semibold">Estado</Label>
                                                                    <Select
                                                                        value={correctionForm.estado_pago}
                                                                        onValueChange={(val) => setCorrectionForm(prev => ({ ...prev, estado_pago: val }))}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs dark:bg-gray-950">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                                                                            <SelectItem value="Parcial">Parcial</SelectItem>
                                                                            <SelectItem value="Pagada">Pagada</SelectItem>
                                                                            <SelectItem value="Vencida">Vencida</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="flex items-center space-x-2 py-1">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`conc-check-compra-${compra.id}`}
                                                                        checked={correctionForm.conciliado}
                                                                        onChange={(e) => setCorrectionForm(prev => ({ ...prev, conciliado: e.target.checked }))}
                                                                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600 dark:bg-gray-950"
                                                                    />
                                                                    <Label htmlFor={`conc-check-compra-${compra.id}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                        Bancarizada (Conciliada)
                                                                    </Label>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="w-full h-8 text-xs"
                                                                onClick={() => handleManualCorrection(compra.id)}
                                                            >
                                                                Aplicar Corrección
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                            <div className="flex items-center text-sm font-medium">
                                Página {currentPage} de {totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={dialogResultadoOpen} onOpenChange={setDialogResultadoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resultado de Carga</DialogTitle>
                        <DialogDescription>
                            Resumen del procesamiento del Libro de Compras.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {resultadoSync && (
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <p className="text-2xl font-bold text-green-700">{resultadoSync.nuevas}</p>
                                    <p className="text-xs text-green-600 font-medium">Nuevas</p>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <p className="text-2xl font-bold text-blue-700">{resultadoSync.actualizadas}</p>
                                    <p className="text-xs text-blue-600 font-medium">Procesadas</p>
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                    <p className="text-2xl font-bold text-red-700">{resultadoSync.errores.length}</p>
                                    <p className="text-xs text-red-600 font-medium">Errores</p>
                                </div>
                            </div>
                        )}

                        {resultadoSync?.errores?.length > 0 && (
                            <div className="mt-4 max-h-40 overflow-y-auto bg-gray-100 p-2 rounded text-xs font-mono">
                                {resultadoSync.errores.map((err: any, idx: number) => (
                                    <div key={idx} className="text-red-600 mb-1">
                                        Folio {err.folio}: {err.error}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={() => setDialogResultadoOpen(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
