
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Upload,
    Loader2,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    ArrowRightLeft,
    Search,
    PlusCircle,
    Save,
    DollarSign,
    Link,
    Ban,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types
interface BancoMovimiento {
    id: number;
    cartola_id?: number;
    fecha: string; // YYYY-MM-DD
    descripcion: string;
    numero_documento: string | null;
    cargos: number;
    abonos: number;
    saldo: number;
    estado: string; // 'pendiente', 'conciliado'
    tipo_conciliacion?: string;
    conciliado_id?: number | null;
}

interface BancoCartola {
    id: number;
    nombre_archivo: string;
    fecha_carga: string;
    saldo_inicial: number;
    saldo_final: number;
    banco: string;
    periodo: string;
}

interface Coincidencia {
    id: number;
    tipo: 'venta' | 'compra';
    entidad: string; // Cliente o Proveedor
    fecha: string;
    monto: number;
    folio: string | number;
    documento_relacionado?: any;
}

export default function ConciliacionPage() {
    const [cartolas, setCartolas] = useState<BancoCartola[]>([]);
    const [movimientos, setMovimientos] = useState<BancoMovimiento[]>([]);
    const [selectedCartola, setSelectedCartola] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Reconciliation Dialog State
    const [conciliarOpen, setConciliarOpen] = useState(false);
    const [selectedMovimiento, setSelectedMovimiento] = useState<BancoMovimiento | null>(null);
    const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
    const [searchingMatch, setSearchingMatch] = useState(false);
    const [matchTab, setMatchTab] = useState("sugerencias"); // sugerencias | manual

    useEffect(() => {
        cargarCartolas();
    }, []);

    useEffect(() => {
        if (selectedCartola) {
            cargarMovimientos(selectedCartola);
        } else {
            setMovimientos([]);
        }
    }, [selectedCartola]);

    const cargarCartolas = async () => {
        try {
            const { data, error } = await supabase
                .from("banco_cartolas")
                .select("*")
                .order("fecha_carga", { ascending: false });

            if (error) throw error;
            setCartolas(data || []);
            if (data && data.length > 0 && !selectedCartola) {
                setSelectedCartola(data[0].id);
            }
        } catch (error) {
            console.error("Error loading cartolas:", error);
        }
    };

    const cargarMovimientos = async (cartolaId: number) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("banco_movimientos")
                .select("*")
                .eq("cartola_id", cartolaId)
                .order("fecha", { ascending: true }); // Orden cronológico

            if (error) throw error;
            setMovimientos(data || []);
        } catch (error) {
            console.error("Error loading movimientos:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- PARSING LOGIC SPECIFIC TO YOUR BCI EXCEL ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

            let saldoInicial = 0;
            let saldoFinal = 0;
            let movementsStartIndex = -1;
            let cargoIdx = 10; // Default BCI
            let abonoIdx = 12; // Default BCI
            let saldoIdx = 14; // Default BCI

            // 1. Scan for headers and balance
            for (let i = 0; i < Math.min(rows.length, 50); i++) {
                const row = rows[i];
                if (!row) continue;
                const rowStr = JSON.stringify(row).toLowerCase();

                // Capture Saldo
                if (rowStr.includes("saldo anterior") && rowStr.includes("saldo contable final")) {
                    const summaryRow = rows[i + 1];
                    if (summaryRow) {
                        const numbers = summaryRow.filter(cell => typeof cell === 'number');
                        if (numbers.length >= 2) {
                            saldoInicial = numbers[0];
                            saldoFinal = numbers[numbers.length - 1];
                        }
                    }
                }

                // Detect Headers
                if ((rowStr.includes("cargos") && rowStr.includes("abonos")) || rowStr.includes("cheques y otros")) {
                    // Try to identify specific columns in this row
                    row.forEach((cell: any, idx: number) => {
                        if (typeof cell === 'string') {
                            const val = cell.toLowerCase().trim();
                            if (val === 'cargos' || val.includes('cargos')) cargoIdx = idx;
                            if (val === 'abonos' || val.includes('abonos')) abonoIdx = idx;
                            if (val === 'saldo' || val.includes('saldo')) saldoIdx = idx;
                        }
                    });
                    movementsStartIndex = i + 1;
                }
            }

            // Ensure we have a start index
            if (movementsStartIndex === -1) {
                // Fallback: look for first date-like cell? Or just assume after some rows?
                // Let's stick to what we had: if we didn't find headers, maybe the old check worked?
                // The old check was: includes("Cheques y otros") -> start = i+1
                // We covered that in the loop above.
            }

            const parsedMovimientos: any[] = [];
            if (movementsStartIndex !== -1) {
                for (let i = movementsStartIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const fechaRaw = row[0]; // A
                    if (!fechaRaw && fechaRaw !== 0) continue;

                    // Parse Date
                    let fecha: string | null = null;
                    if (typeof fechaRaw === 'number') {
                        const date = XLSX.SSF.parse_date_code(fechaRaw);
                        fecha = new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
                    } else if (typeof fechaRaw === 'string') {
                        const parts = fechaRaw.split('/');
                        if (parts.length === 3) {
                            // Assume DD/MM/YYYY
                            fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        } else {
                            // Try parsing standard date string
                            const d = new Date(fechaRaw);
                            if (!isNaN(d.getTime())) {
                                fecha = d.toISOString().split('T')[0];
                            }
                        }
                    }

                    if (!fecha) continue;

                    // Description Parts (Columns C to G usually)
                    const descParts = [];
                    for (let k = 2; k <= 6; k++) {
                        if (typeof row[k] === 'string') descParts.push(row[k]);
                    }
                    const finalDesc = descParts.join(" ") || "Sin descripción";

                    const nDoc = row[7] || row[8];

                    const parseMoney = (val: any) => {
                        if (typeof val === 'number') return val;
                        if (typeof val === 'string') {
                            // Remove $ and dots (thousands separator in CL), replace semi/colon with dot if needed? 
                            // CL Locale: 1.000,00 or 1.000 usually. Excel might give raw number 1000.
                            // If it's a string "$ 1.000", parsing it:
                            const clean = val.replace(/[^0-9,.-]/g, '');
                            // If using comma for decimal
                            const normalized = clean.replace(/\./g, '').replace(',', '.');
                            return parseFloat(normalized) || 0;
                        }
                        return 0;
                    };

                    const cargo = parseMoney(row[cargoIdx]);
                    const abono = parseMoney(row[abonoIdx]);
                    const saldo = parseMoney(row[saldoIdx]);

                    parsedMovimientos.push({
                        fecha,
                        descripcion: finalDesc,
                        numero_documento: nDoc ? String(nDoc) : null,
                        cargos: cargo,
                        abonos: abono,
                        saldo: saldo,
                        estado: 'pendiente'
                    });
                }
            }

            if (parsedMovimientos.length > 0) {
                await descomponerYGuardar(file.name, saldoInicial, saldoFinal, parsedMovimientos);
            } else {
                alert("No se encontraron movimientos válidos. Verifica el formato.");
            }

        } catch (e: any) {
            console.error("Error analyzing excel:", e);
            alert("Error leyendo el archivo: " + e.message);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const descomponerYGuardar = async (fileName: string, sIni: number, sFin: number, movs: any[]) => {
        const { data: cartolaData, error: cartolaError } = await supabase
            .from("banco_cartolas")
            .insert({
                nombre_archivo: fileName,
                banco: "BCI",
                periodo: "Detectado",
                saldo_inicial: sIni,
                saldo_final: sFin
            })
            .select()
            .single();

        if (cartolaError || !cartolaData) {
            alert("Error guardando cartola: " + cartolaError?.message);
            return;
        }

        const movimientosConId = movs.map(m => ({
            ...m,
            cartola_id: cartolaData.id
        }));

        const { error: movsError } = await supabase
            .from("banco_movimientos")
            .insert(movimientosConId);

        if (movsError) {
            alert("Error guardando movimientos: " + movsError.message);
        } else {
            alert("Cartola cargada exitosamente");
            cargarCartolas();
            setSelectedCartola(cartolaData.id);
        }
    };

    // --- RECONCILIATION LOGIC ---
    const handleConciliarClick = (mov: BancoMovimiento) => {
        setSelectedMovimiento(mov);
        setConciliarOpen(true);
        buscarSugerencias(mov);
    };

    const buscarSugerencias = async (mov: BancoMovimiento) => {
        setSearchingMatch(true);
        setCoincidencias([]);

        // Determine strict types:
        // Abono (Ingreso) -> Probablemente una Venta
        // Cargo (Egreso) -> Probablemente una Compra (Gasto)
        const esAbono = mov.abonos > 0;
        const montoBuscado = esAbono ? mov.abonos : mov.cargos;
        const tolerancia = 2000; // Tolerancia en pesos (para redondeos)

        const candidates: Coincidencia[] = [];

        // 1. Search Sales (Ventas)
        if (esAbono) {
            // Buscar en tabla 'ventas' (que creamos anteriormente o asumimos)
            // NOTA: Asumimos 'ventas' existe y tiene 'mnt_total', 'fch_emis'
            const { data: ventasMatch, error } = await supabase
                .from("ventas") // Make sure this table matches your schema
                .select("*")
                .gte("mnt_total", montoBuscado - tolerancia) // TODO: This might fail if mnt_total is numeric vs int discrepancy, but usually safe
                .lte("mnt_total", montoBuscado + tolerancia)
                //.eq("estado_deuda", "PE") // Only unpaid sales
                .limit(10); // Check more

            if (ventasMatch) {
                ventasMatch.forEach((v: any) => {
                    // Basic filter: date should not be AFTER movement (usually)
                    // But sometimes payment is partial or weird. Let's just suggest.
                    candidates.push({
                        id: v.id,
                        tipo: 'venta',
                        entidad: v.rzn_soc_recep || "Desconocido",
                        fecha: v.fch_emis,
                        monto: v.mnt_total,
                        folio: v.folio,
                        documento_relacionado: v
                    });
                });
            }
        }

        // 2. Search Compras (Expenses)
        if (!esAbono) {
            const { data: comprasMatch, error } = await supabase
                .from("compras")
                .select("*")
                .gte("monto_total", montoBuscado - tolerancia)
                .lte("monto_total", montoBuscado + tolerancia)
                .eq("estado_pago", "Pendiente") // Only unpaid expenses
                .limit(10);

            if (comprasMatch) {
                comprasMatch.forEach((c: any) => {
                    candidates.push({
                        id: c.id,
                        tipo: 'compra',
                        entidad: c.razon_social || "Desconocido",
                        fecha: c.fecha_emision,
                        monto: c.monto_total,
                        folio: c.folio,
                        documento_relacionado: c
                    });
                });
            }
        }

        setCoincidencias(candidates);
        setSearchingMatch(false);
    };

    const ejecutarConciliacion = async (item: Coincidencia) => {
        if (!selectedMovimiento) return;
        if (!confirm(`¿Estás seguro de conciliar este movimiento con ${item.tipo === 'venta' ? 'la Venta' : 'la Compra'} Folio ${item.folio}?`)) return;

        try {
            // 1. Update Banco Movimiento
            const { error: errMov } = await supabase
                .from("banco_movimientos")
                .update({
                    estado: "conciliado",
                    tipo_conciliacion: item.tipo,
                    conciliado_id: item.id
                })
                .eq("id", selectedMovimiento.id);

            if (errMov) throw errMov;

            // 2. Update Related Record (Venta or Compra)
            if (item.tipo === "venta") {
                // Update Venta -> estado_deuda = 'PA' (Pagada) ?
                // Note: Maybe we should also record fecha_abono
                await supabase.from("ventas").update({
                    estado_deuda: "PA", // Asumiendo convención
                    fecha_abono: new Date().toISOString().split("T")[0],
                    monto_abono: item.monto
                }).eq("id", item.id);
            } else {
                // Update Compra -> estado_pago = 'Pagada'
                await supabase.from("compras").update({
                    estado_pago: "Pagada",
                    saldo: 0
                }).eq("id", item.id);
            }

            // 3. UI Updates
            setConciliarOpen(false);

            // Update local list
            setMovimientos(prev => prev.map(m =>
                m.id === selectedMovimiento.id
                    ? { ...m, estado: "conciliado", tipo_conciliacion: item.tipo, conciliado_id: item.id }
                    : m
            ));

            setSelectedMovimiento(null);
            alert("¡Conciliación exitosa!");

        } catch (e: any) {
            alert("Error al conciliar: " + e.message);
        }
    };


    const fmtMoney = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    return (
        <div className="space-y-6 pb-10 fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ArrowRightLeft className="h-8 w-8 text-indigo-600" />
                        Conciliación Bancaria
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Sube tu cartola y concilia movimientos con tus registros.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <select
                            className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                            value={selectedCartola || ""}
                            onChange={(e) => setSelectedCartola(Number(e.target.value))}
                        >
                            {cartolas.map(c => {
                                const date = new Date(c.fecha_carga);
                                const monthName = date.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
                                return (
                                    <option key={c.id} value={c.id}>
                                        {monthName.charAt(0).toUpperCase() + monthName.slice(1)} ({c.nombre_archivo})
                                    </option>
                                );
                            })}
                            {!cartolas.length && <option value="">Sin cartolas</option>}
                        </select>
                    </div>

                    <div className="relative">
                        <input
                            type="file"
                            id="upload-cartola"
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                        <Label
                            htmlFor="upload-cartola"
                            className={`cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 ${uploading ? 'opacity-70' : ''}`}
                        >
                            {uploading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4 mr-2" />
                            )}
                            {uploading ? "Procesando..." : "Subir Cartola"}
                        </Label>
                    </div>
                </div>
            </div>

            {selectedCartola && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {(() => {
                        const c = cartolas.find(x => x.id === selectedCartola);
                        if (!c) return null;
                        return (
                            <>
                                <Card className="bg-white dark:bg-gray-800">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs text-gray-500 uppercase">Saldo Inicial</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-bold">{fmtMoney(c.saldo_inicial)}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-gray-800">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs text-gray-500 uppercase">Saldo Final</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-bold">{fmtMoney(c.saldo_final)}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-gray-800">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs text-gray-500 uppercase">Movimientos</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-bold">{movimientos.length}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-gray-800">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs text-gray-500 uppercase">Por Conciliar</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-bold text-yellow-600">
                                            {movimientos.filter(m => m.estado === 'pendiente').length}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        );
                    })()}
                </div>
            )}

            <Card className="border-t-4 border-t-indigo-500 shadow-md">
                <CardHeader className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                    <CardTitle className="flex justify-between items-center text-lg">
                        <span>Movimientos Cartola</span>
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-100 dark:bg-gray-800">
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Documento</TableHead>
                                <TableHead className="text-right text-red-600">Cargos</TableHead>
                                <TableHead className="text-right text-green-600">Abonos</TableHead>
                                <TableHead className="text-right">Saldo</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                                <TableHead className="text-center">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                                        <p className="mt-2 text-gray-500">Cargando movimientos...</p>
                                    </TableCell>
                                </TableRow>
                            ) : movimientos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                                        {selectedCartola ? "Esta cartola no tiene movimientos" : "Sube una cartola para comenzar"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movimientos.map((mov) => (
                                    <TableRow key={mov.id} className={mov.estado === 'conciliado' ? 'bg-gray-50 opacity-75' : ''}>
                                        <TableCell className="font-medium whitespace-nowrap">{mov.fecha}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={mov.descripcion}>{mov.descripcion}</TableCell>
                                        <TableCell>{mov.numero_documento || "-"}</TableCell>
                                        <TableCell className="text-right text-red-600 font-medium whitespace-nowrap">
                                            {mov.cargos ? fmtMoney(mov.cargos) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-medium whitespace-nowrap">
                                            {mov.abonos ? fmtMoney(mov.abonos) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-500 whitespace-nowrap">
                                            {fmtMoney(mov.saldo)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {mov.estado === 'conciliado' ? (
                                                <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-none">
                                                    <Check className="w-3 h-3 mr-1" /> Conciliado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">Pendiente</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {mov.estado !== 'conciliado' && (
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleConciliarClick(mov)}>
                                                    <Link className="h-4 w-4 text-indigo-600" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Dialog Conciliacion */}
            <Dialog open={conciliarOpen} onOpenChange={setConciliarOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Conciliar Movimiento</DialogTitle>
                        <DialogDescription>
                            Busca una venta o gasto que coincida con este movimiento bancario.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedMovimiento && (
                        <div className="space-y-4">
                            {/* Resumen del movimiento */}
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg flex justify-between items-center border border-gray-200 dark:border-gray-700">
                                <div>
                                    <h3 className="font-semibold text-sm text-gray-500">Movimiento Bancario</h3>
                                    <p className="font-bold text-gray-900 dark:text-gray-100">{selectedMovimiento.descripcion}</p>
                                    <p className="text-xs text-gray-400">{selectedMovimiento.fecha}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-bold ${selectedMovimiento.cargos > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {selectedMovimiento.cargos > 0 ? '-' : '+'}{fmtMoney(selectedMovimiento.cargos || selectedMovimiento.abonos)}
                                    </p>
                                    <Badge variant="outline">{selectedMovimiento.cargos > 0 ? 'Cargo / Gasto' : 'Abono / Ingreso'}</Badge>
                                </div>
                            </div>

                            <Tabs defaultValue="sugerencias">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="sugerencias">Sugerencias Inteligentes</TabsTrigger>
                                    <TabsTrigger value="manual">Búsqueda Manual</TabsTrigger>
                                </TabsList>

                                <TabsContent value="sugerencias" className="space-y-2 pt-2">
                                    {searchingMatch ? (
                                        <div className="text-center py-6">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                                            <p className="text-sm text-gray-500 mt-2">Buscando documentos relacionados...</p>
                                        </div>
                                    ) : coincidencias.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-500 font-medium">Se encontraron posibles coincidencias por monto y estado.</p>
                                            {coincidencias.map((item) => (
                                                <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-l-4 border-l-indigo-400">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="uppercase text-[10px]">{item.tipo}</Badge>
                                                            <span className="font-bold text-sm">Folio #{item.folio}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">{item.entidad}</p>
                                                        <p className="text-xs text-gray-400">{item.fecha}</p>
                                                    </div>
                                                    <div className="text-right flex items-center gap-3">
                                                        <div className="font-bold">{fmtMoney(item.monto)}</div>
                                                        <Button size="sm" variant="default" onClick={() => ejecutarConciliacion(item)}>
                                                            Conciliar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 border border-dashed rounded-md bg-gray-50/50">
                                            <Search className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                            <p>No se encontraron coincidencias automáticas.</p>
                                            <p className="text-xs">Prueba la búsqueda manual.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="manual">
                                    <div className="py-4 text-center text-gray-500">
                                        <AlertCircle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                                        <p>Funcionalidad de búsqueda manual en desarrollo.</p>
                                        <p className="text-xs">Por ahora usa las sugerencias automáticas basasdas en el monto.</p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
