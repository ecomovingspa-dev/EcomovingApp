
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertCircle,
    Clock,
    FileText,
    Upload,
    Loader2,
    CalendarDays,
    Search,
    Filter,
    RefreshCw,
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
    saldo: number;
    estado_pago: string; // 'Pendiente', 'Pagada', 'Vencida'
    created_at: string;
}

export default function ComprasPage() {
    const [compras, setCompras] = useState<Compra[]>([]);
    const [cargando, setCargando] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    // Filtros
    const [filtroProveedor, setFiltroProveedor] = useState("");
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

            let matchEstado = true;
            if (filtroEstado !== "todos") {
                matchEstado = compra.estado_pago === filtroEstado;
            }

            return matchProveedor && matchEstado;
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
        if (typeof fecha === "string") return fecha; // Asumiendo que ya viene bien o lo intentamos
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

            for (const fila of filas as any[]) {
                try {
                    if (!fila.Folio || !fila.RUTProveedor) {
                        continue; // Saltar filas inválidas
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
                        resultado_neto: parseFloat(fila.MntNeto) || 0, // Si existe
                        monto_iva: parseFloat(fila.MntIVA) || 0, // Si existe
                        estado_contable: fila.EstadoContab,
                        saldo: parseFloat(fila.Saldo) || parseFloat(fila.MntTotal) || 0,
                        // Estado de pago inicial
                        estado_pago: "Pendiente"
                    };

                    if (!existente) {
                        const { error } = await supabase.from("compras").insert(nuevaCompra);
                        if (error) throw error;
                        resultado.nuevas++;
                    } else {
                        // Podríamos actualizar, pero por ahora solo insertamos nuevas para evitar sobreescribir datos manuales
                        // Opcional: Actualizar el saldo si viene en el excel
                        resultado.actualizadas++; // Contamos como 'procesada'
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
            alert("Error al procesar archivo: " + error.message);
        } finally {
            setSincronizando(false);
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

                {/* Tabla Compras */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                            Detalle de Compras y Gastos
                        </h2>
                    </div>

                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[200px] max-w-[400px]">
                                <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Buscar Proveedor</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Nombre o RUT..."
                                        value={filtroProveedor}
                                        onChange={(e) => {
                                            setFiltroProveedor(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-8 h-9"
                                    />
                                </div>
                            </div>
                            <div className="min-w-[180px]">
                                <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Estado</Label>
                                <Select value={filtroEstado} onValueChange={(val) => {
                                    setFiltroEstado(val);
                                    setCurrentPage(1);
                                }}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
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
                                    <th className="px-6 py-3 text-right">Saldo</th>
                                    <th className="px-6 py-3 text-center">Estado</th>
                                    <th className="px-6 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {cargando ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-pink-500" />
                                            <p>Cargando compras...</p>
                                        </td>
                                    </tr>
                                ) : paginatedCompras.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                                                #{compra.folio}
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
                                            <td className="px-6 py-3 text-right text-gray-500 dark:text-gray-400">
                                                ${(compra.saldo || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(compra.estado_pago)}`}>
                                                    {compra.estado_pago}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {/* Placeholder for future actions */}
                                                <Button variant="ghost" size="sm" disabled>...</Button>
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
        </div>
    );
}
