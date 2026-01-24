
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
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
    Banknote,
    DollarSign,
    Receipt,
    Save,
    X,
} from "lucide-react";

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

    // Sincronización
    const [sincronizando, setSincronizando] = useState(false);
    const [resultadoSync, setResultadoSync] = useState<any>(null);
    const [dialogResultadoOpen, setDialogResultadoOpen] = useState(false);


    useEffect(() => {
        cargarCompras();
    }, []);

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

    const cargarCompras = async () => {
        setCargando(true);
        try {
            const { data, error } = await supabase
                .from("compras")
                .select("*")
                .order("fecha_emision", { ascending: false });

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
    const summary = compras.reduce(
        (acc, compra) => {
            const estado = compra.estado_pago || "";
            const saldo = compra.saldo !== undefined ? compra.saldo : compra.monto_total;

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
        }
    );

    // Totales Mensuales
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    compras.forEach((compra) => {
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

    // Filtrado
    const comprasFiltradas = compras
        .filter((compra) => {
            const matchProveedor =
                filtroProveedor === "" ||
                (compra.razon_social || "")
                    .toLowerCase()
                    .includes(filtroProveedor.toLowerCase());

            const matchFolio =
                filtroFolio === "" ||
                String(compra.folio || "").includes(filtroFolio);

            let matchEstado = true;
            if (filtroEstado !== "todos") {
                matchEstado = compra.estado_pago === filtroEstado;
            }

            return matchProveedor && matchFolio && matchEstado;
        })
        .sort((a, b) => {
            return (new Date(b.fecha_emision || 0).getTime()) - (new Date(a.fecha_emision || 0).getTime());
        });

    // Paginación
    const totalPages = Math.ceil(comprasFiltradas.length / ITEMS_PER_PAGE);
    const paginatedCompras = comprasFiltradas.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
                try {
                    if (!fila.Folio || !fila.RUTProveedor) {
                        continue;
                    }

                    // Verificar si ya existe
                    const { data: existente } = await supabase
                        .from("compras")
                        .select("id")
                        .eq("rut_proveedor", fila.RUTProveedor)
                        .eq("tipo_dte", fila.TipoDTE)
                        .eq("folio", fila.Folio)
                        .maybeSingle();

                    const nuevaCompra = {
                        tipo_dte: fila.TipoDTE,
                        folio: fila.Folio,
                        fecha_recepcion: parseFecha(fila.FecRecepcion),
                        fecha_emision: parseFecha(fila.FchEmis),
                        fecha_vencimiento: parseFecha(fila.FchVenc),
                        rut_proveedor: fila.RUTProveedor,
                        razon_social: fila.RznSoc,
                        monto_total: parseFloat(fila.MntTotal) || 0,
                        lista_nc: fila.ListaNC || null,
                        monto_neto: parseFloat(fila.MntNeto) || 0,
                        monto_iva: parseFloat(fila.MntIVA) || 0,
                        monto_exento: parseFloat(fila.MntExe) || 0,
                        monto_sin_credito: parseFloat(fila.MntSinCred) || parseFloat(fila.MntIvaNoRec) || 0,
                        impuestos_especificos: parseFloat(fila.OtroImp) || parseFloat(fila.Impuestos) || 0,
                        codigo_sucursal: fila.CdgSIISucur || fila.Sucursal || null,
                        lista_referencias: fila.ListaRef || null,
                        iva_uso_comun: parseFloat(fila.IVAUsoComun) || parseFloat(fila.MntIVAUsoComun) || 0,
                        estado_contable: fila.EstadoContab,
                        saldo: parseFloat(fila.Saldo) || parseFloat(fila.MntTotal) || 0,
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
                        folio: fila.Folio,
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

    // Abrir formulario
    const openAbonoForm = (compra: Compra) => {
        setAbonoOpen(compra.id);
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

            if (error) throw error; // Revert if fails

            // 3. Crear Registro de Movimiento en 'banco_movimientos' ?
            // Opcional: Si queremos registrar el egreso automáticamente en la conciliación.
            // Por ahora solo actualizamos la compra como "pagada" parcialmente.

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


    return (
        <div className="space-y-6 pb-10 fade-in-up">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8 text-pink-600" />
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Libro de Compras
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
                            {sincronizando ? "Cargando Libro..." : "Cargar Libro Compras"}
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
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                            Detalle de Compras y Gastos
                        </h2>
                    </div>

                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(compra.estado_pago)}`}>
                                                    {compra.estado_pago}
                                                </span>
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
                                                            className="h-7 w-7 p-0 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                            title="Registrar Pago"
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

                                                            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
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
