
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Upload,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowRightLeft,
    Search,
    Link,
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
    tipo_gasto?: string | null;
    preconciliado_match?: Coincidencia | null;
}

interface BancoCartola {
    id: number;
    nombre_archivo: string;
    fecha_carga: string;
    saldo_inicial: number;
    saldo_final: number;
    banco: string;
    periodo: string;
    periodo_mes?: string;
}

interface Coincidencia {
    id: number;
    tipo: 'venta' | 'compra';
    entidad: string; // Cliente o Proveedor
    fecha: string;
    monto: number;
    folio: string | number;
    estado?: string;
    documento_relacionado?: any;
}

export default function ConciliacionPage() {
    const [cartolas, setCartolas] = useState<BancoCartola[]>([]);
    const [movimientos, setMovimientos] = useState<BancoMovimiento[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [categorias, setCategorias] = useState<string[]>([]);

    // Upload Summary Dialog State
    const [uploadSummaryOpen, setUploadSummaryOpen] = useState(false);
    const [uploadSummary, setUploadSummary] = useState<{
        total: number;
        nuevos: number;
        duplicados: number;
        cargos: number;
        abonos: number;
        saldoInicial: number;
        saldoFinal: number;
    } | null>(null);

    // Reconciliation Dialog State
    const [conciliarOpen, setConciliarOpen] = useState(false);
    const [selectedMovimiento, setSelectedMovimiento] = useState<BancoMovimiento | null>(null);
    const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
    const [searchingMatch, setSearchingMatch] = useState(false);
    const [matchTab, setMatchTab] = useState("sugerencias"); // sugerencias | manual
    const [preconciliacionOpen, setPreconciliacionOpen] = useState(false);
    const [preconciliacionesEncontradas, setPreconciliacionesEncontradas] = useState<{ mov: BancoMovimiento; match: Coincidencia }[]>([]);
    const [isPreconciliating, setIsPreconciliating] = useState(false);

    useEffect(() => {
        cargarCartolas();
        cargarCategorias();
    }, []);

    useEffect(() => {
        if (selectedPeriod) {
            cargarMovimientos(selectedPeriod);
        } else {
            setMovimientos([]);
        }
    }, [selectedPeriod]);

    const cargarCartolas = async () => {
        try {
            const { data, error } = await supabase
                .from("banco_cartolas")
                .select("*")
                .order("fecha_carga", { ascending: false });

            if (error) throw error;
            const cartolasData = data || [];
            setCartolas(cartolasData);
            if (cartolasData.length > 0 && !selectedPeriod) {
                const latestPeriod = cartolasData[0].periodo_mes || "";
                if (latestPeriod) setSelectedPeriod(latestPeriod);
            }
        } catch (error) {
            console.error("Error loading cartolas:", error);
        }
    };

    const cargarMovimientos = async (periodo: string) => {
        if (!periodo) return;
        setLoading(true);
        try {
            // Filter by date range for the month
            const [year, month] = periodo.split('-');
            const startDate = `${periodo}-01`;
            const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

            const { data, error } = await supabase
                .from("banco_movimientos")
                .select("*")
                .gte("fecha", startDate)
                .lt("fecha", endDate)
                .order("fecha", { ascending: true }); // Orden cronológico

            if (error) throw error;
            setMovimientos(data || []);
        } catch (error) {
            console.error("Error loading movimientos:", error);
        } finally {
            setLoading(false);
        }
    };

    const cargarCategorias = async () => {
        try {
            const { data, error } = await supabase
                .from("banco_categorias_gasto")
                .select("nombre")
                .order("nombre", { ascending: true });

            if (error) throw error;
            setCategorias(data?.map(c => c.nombre) || []);
        } catch (error) {
            console.error("Error loading categorias:", error);
        }
    };

    const handleTipoGastoChange = async (movimientoId: number, tipoGasto: string) => {
        try {
            // Update the database
            const { error } = await supabase
                .from("banco_movimientos")
                .update({ tipo_gasto: tipoGasto || null })
                .eq("id", movimientoId);

            if (error) throw error;

            // Update local state
            setMovimientos(prev => prev.map(m =>
                m.id === movimientoId ? { ...m, tipo_gasto: tipoGasto } : m
            ));

            // If it's a new category, add it to the list and database
            if (tipoGasto && !categorias.includes(tipoGasto)) {
                await supabase
                    .from("banco_categorias_gasto")
                    .insert({ nombre: tipoGasto });

                setCategorias(prev => [...prev, tipoGasto].sort());
            }
        } catch (error) {
            console.error("Error updating tipo_gasto:", error);
            alert("Error al actualizar el tipo de gasto");
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

            console.log("Total rows found:", rows.length);

            let saldoInicial = 0;
            let saldoFinal = 0;
            let movementsStartIndex = -1;

            // Default indices (will be overwritten if headers are found)
            let fechaIdx = 0;
            let descIdxStart = 2; // Usually merge of cols
            let docIdx = 7;
            let cargoIdx = 10;
            let abonoIdx = 12;
            let saldoIdx = 14;

            // Helper to clean string for comparison
            const cleanStr = (val: any) => String(val || "").toLowerCase().trim().replace(/\s+/g, ' ');

            const parseMoney = (val: any) => {
                if (val === undefined || val === null || val === "") return 0;
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    // Remove $ and any non-numeric chars except , . -
                    let clean = val.replace(/[^0-9,.-]/g, '');

                    // Detect decimal separator logic
                    if (clean.includes(',')) {
                        if (clean.includes('.')) {
                            // Has both. Last one is decimal?
                            if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                                // 1.234,56 -> remove dot, replace comma with dot
                                clean = clean.replace(/\./g, '').replace(',', '.');
                            } else {
                                // 1,234.56 -> remove comma
                                clean = clean.replace(/,/g, '');
                            }
                        } else {
                            // Has only comma. Is it decimal or thousand? "1,000" vs "0,5"
                            // In CL, comma is decimal.
                            clean = clean.replace(',', '.');
                        }
                    } else {
                        // Only dots? "1.000" -> usually 1000. 
                        // But "10.5" -> 10.5.
                        // If dot count > 1, certainly thousands separator.
                        const dotCount = (clean.match(/\./g) || []).length;
                        if (dotCount > 1) {
                            clean = clean.replace(/\./g, '');
                        } else if (dotCount === 1) {
                            // Ambiguous: 1.000 could be 1k. 3.5 could be 3.5.
                            // If we assume CL locale where DOT is thousands:
                            clean = clean.replace(/\./g, '');
                        }
                    }
                    return parseFloat(clean) || 0;
                }
                return 0;
            };

            // 1. Scan for Headers and Balances
            for (let i = 0; i < Math.min(rows.length, 50); i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const rowStr = row.map(cleanStr).join(" ");

                // Detect Initial Balance
                if (rowStr.includes("saldo anterior") || rowStr.includes("saldo inicial") || rowStr.includes("saldo apertura")) {
                    const numbers = row.filter(cell => typeof cell === 'number' || (typeof cell === 'string' && cell.match(/\d/)));
                    if (numbers.length > 0) {
                        // Find the first value that looks like money
                        for (const n of numbers) {
                            const val = parseMoney(n);
                            if (val !== 0) {
                                saldoInicial = val;
                                break;
                            }
                        }
                    }
                    // If not found in same row, try next row
                    if (saldoInicial === 0 && rows[i + 1]) {
                        const nextNumbers = rows[i + 1].filter(cell => typeof cell === 'number' || (typeof cell === 'string' && cell.match(/\d/)));
                        for (const n of nextNumbers) {
                            const val = parseMoney(n);
                            if (val !== 0) {
                                saldoInicial = val;
                                break;
                            }
                        }
                    }
                }

                // Detect Final Balance
                if (rowStr.includes("saldo final") || rowStr.includes("saldo actual") || rowStr.includes("saldo contable")) {
                    const numbers = row.filter(cell => typeof cell === 'number' || (typeof cell === 'string' && cell.match(/\d/)));
                    if (numbers.length > 0) {
                        // Find the last value that looks like money
                        for (let k = numbers.length - 1; k >= 0; k--) {
                            const val = parseMoney(numbers[k]);
                            if (val !== 0) {
                                saldoFinal = val;
                                break;
                            }
                        }
                    }
                    // If not found in same row, try next row
                    if (saldoFinal === 0 && rows[i + 1]) {
                        const nextNumbers = rows[i + 1].filter(cell => typeof cell === 'number' || (typeof cell === 'string' && cell.match(/\d/)));
                        for (let k = nextNumbers.length - 1; k >= 0; k--) {
                            const val = parseMoney(nextNumbers[k]);
                            if (val !== 0) {
                                saldoFinal = val;
                                break;
                            }
                        }
                    }
                }

                // Detect Column Headers
                // We look for a row that has date/fecha AND cargo/abono/monto/valor
                if (rowStr.includes("fecha") && (rowStr.includes("cargo") || rowStr.includes("abono") || rowStr.includes("monto") || rowStr.includes("valor"))) {
                    console.log("Header row found at index:", i);
                    movementsStartIndex = i + 1;

                    // Map columns dynamically
                    row.forEach((cell: any, idx: number) => {
                        const val = cleanStr(cell);
                        if (val.includes("fecha")) fechaIdx = idx;
                        if (val.includes("descripcion") || val.includes("movimiento")) descIdxStart = idx; // heuristic
                        if (val.includes("doc") || val.includes("num")) docIdx = idx;
                        // Changed to includes() to catch "Cargos y Cheques", "Total Cargos", etc.
                        if (val.includes("cargo")) cargoIdx = idx;
                        // Changed to includes() to catch "Depósitos y Abonos", "Total Abonos", etc.
                        if (val.includes("abono") || val.includes("deposito") || val.includes("depósito")) abonoIdx = idx;
                        if (val.includes("saldo") && !val.includes("anterior")) saldoIdx = idx;
                    });
                } else if (rowStr.includes("cheques") && rowStr.includes("otros") && rowStr.includes("cargos")) {
                    // Fallback for BCI specific header line which might be "Cheques y otros cargos..."
                    console.log("BCI Header detected via keywords at index:", i);
                    movementsStartIndex = i + 1;
                    // We can try to map if possible, otherwise rely on defaults.
                    row.forEach((cell: any, idx: number) => {
                        const val = cleanStr(cell);
                        if (val.includes("cargos")) cargoIdx = idx;
                        if (val.includes("abonos")) abonoIdx = idx;
                        if (val.includes("saldo")) saldoIdx = idx;
                    });
                }
            }

            console.log("Indices determined:", { fechaIdx, descIdxStart, docIdx, cargoIdx, abonoIdx, saldoIdx });

            // If header not found but we want to try parsing anyway
            if (movementsStartIndex === -1) {
                // Try finding first row with a date at column 0.
                for (let i = 0; i < rows.length; i++) {
                    const cell0 = rows[i][0];
                    if (cell0 && (typeof cell0 === 'number' || (typeof cell0 === 'string' && cell0.match(/\d{2}\/\d{2}\/\d{4}/)))) {
                        movementsStartIndex = i;
                        break;
                    }
                }
            }

            const parsedMovimientos: any[] = [];
            if (movementsStartIndex !== -1) {
                for (let i = movementsStartIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const fechaRaw = row[fechaIdx]; // Use mapped index
                    if (!fechaRaw) continue;

                    // Parse Date
                    let fecha: string | null = null;
                    if (typeof fechaRaw === 'number') {
                        const date = XLSX.SSF.parse_date_code(fechaRaw);
                        fecha = new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
                    } else if (typeof fechaRaw === 'string') {
                        // Try DD/MM/YYYY
                        const parts = fechaRaw.trim().split('/');
                        if (parts.length === 3) {
                            fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        } else {
                            // Try standard date parsing
                            const d = new Date(fechaRaw);
                            if (!isNaN(d.getTime())) {
                                fecha = d.toISOString().split('T')[0];
                            }
                        }
                    }

                    if (!fecha) continue; // Skip invalid rows

                    // Description: combine columns from descIdxStart up to docIdx
                    const descParts = [];
                    // Heuristic: take 3-4 columns after start or up to docIdx
                    const limit = docIdx > descIdxStart ? docIdx : descIdxStart + 4;
                    for (let k = descIdxStart; k < limit; k++) {
                        if (typeof row[k] === 'string') descParts.push(row[k]);
                    }
                    const finalDesc = descParts.join(" ") || "Sin descripción";

                    const nDoc = row[docIdx]; // Use mapped index



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
                alert("No se encontraron movimientos válidos. Verifica que el archivo tenga columnas de Fecha, Cargo/Abono.");
            }

        } catch (e: any) {
            console.error("Error analyzing excel:", e);
            alert("Error leyendo el archivo: " + e.message);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    // Generate unique hash for a movement to prevent duplicates
    const generateMovementHash = (mov: any, cartolaId: number): string => {
        // Combine key fields to create a unique identifier
        const data = `${cartolaId}|${mov.fecha}|${mov.descripcion}|${mov.cargos}|${mov.abonos}|${mov.saldo}`;

        // Simple hash function (you could use crypto.subtle.digest for SHA-256 if needed)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `mov_${Math.abs(hash).toString(36)}`;
    };


    const descomponerYGuardar = async (fileName: string, sIni: number, sFin: number, movs: any[]) => {
        // Calculate periodo_mes from first movement date
        let periodoMes = "Detectado";
        if (movs.length > 0 && movs[0].fecha) {
            // Split date string to avoid timezone shifts with new Date()
            const [year, month] = movs[0].fecha.split('-');
            periodoMes = `${year}-${month}`;
        }

        const { data: cartolaData, error: cartolaError } = await supabase
            .from("banco_cartolas")
            .insert({
                nombre_archivo: fileName,
                banco: "BCI",
                periodo: "Detectado",
                periodo_mes: periodoMes,
                saldo_inicial: sIni,
                saldo_final: sFin
            })
            .select()
            .single();

        if (cartolaError || !cartolaData) {
            alert("Error guardando cartola: " + cartolaError?.message);
            return;
        }

        const movimientosConId = movs.map(m => {
            const uniqueId = generateMovementHash(m, cartolaData.id);
            return {
                ...m,
                cartola_id: cartolaData.id,
                unique_id: uniqueId
            };
        });

        // Check for existing movements with same unique_id to prevent duplicates
        const uniqueIds = movimientosConId.map(m => m.unique_id);
        const { data: existingMovs } = await supabase
            .from("banco_movimientos")
            .select("unique_id")
            .in("unique_id", uniqueIds);

        const existingIds = new Set(existingMovs?.map(m => m.unique_id) || []);
        const newMovimientos = movimientosConId.filter(m => !existingIds.has(m.unique_id));

        if (newMovimientos.length === 0) {
            alert("Todos los movimientos ya existen en la base de datos. No se insertaron duplicados.");
            cargarCartolas();
            return;
        }

        const { error: movsError } = await supabase
            .from("banco_movimientos")
            .insert(newMovimientos);

        if (movsError) {
            alert("Error guardando movimientos: " + movsError.message);
        } else {
            const duplicateCount = movimientosConId.length - newMovimientos.length;

            // Calculate statistics
            const totalCargos = newMovimientos.reduce((sum, m) => sum + (m.cargos || 0), 0);
            const totalAbonos = newMovimientos.reduce((sum, m) => sum + (m.abonos || 0), 0);

            // Set summary data
            setUploadSummary({
                total: movimientosConId.length,
                nuevos: newMovimientos.length,
                duplicados: duplicateCount,
                cargos: totalCargos,
                abonos: totalAbonos,
                saldoInicial: sIni,
                saldoFinal: sFin
            });

            // Show summary dialog
            setUploadSummaryOpen(true);

            cargarCartolas();
            setSelectedPeriod(periodoMes);
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
        const tolerancia = 5; // Tolerancia en pesos (para redondeos) - Ahora ajustado a +/- $5

        const candidates: Coincidencia[] = [];

        // 1. Search Sales (Ventas)
        if (esAbono) {
            // Buscar en tabla 'ventas' (que creamos anteriormente o asumimos)
            // NOTA: Asumimos 'ventas' existe y tiene 'mnt_total', 'fch_emis'
            const { data: ventasMatch, error } = await supabase
                .from("ventas")
                .select("*")
                // Se quita el filtro estricto de saldo > 0 para permitir conciliar 
                // facturas que ya fueron marcadas como pagadas administrativamente.
                .gte("mnt_total", montoBuscado - tolerancia)
                .lte("mnt_total", montoBuscado + tolerancia)
                .limit(10);

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
                        estado: v.estado_deuda || "Pendiente",
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
                // Se quita el filtro estricto de "Pendiente" para permitir el flujo profesional
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
                        estado: c.estado_pago || "Pendiente",
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
            if (item.estado !== "Pagada") {
                if (item.tipo === "venta") {
                    // Update Venta -> saldo = 0, estado_deuda = 'Pagada'
                    const { error: errVenta } = await supabase.from("ventas").update({
                        estado_deuda: "Pagada",
                        saldo: 0,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        monto_abono: item.monto
                    }).eq("id", item.id);

                    if (errVenta) throw errVenta;

                    // Also record in 'abonos' table to keep history consistent with VentasPage
                    await supabase.from("abonos").insert({
                        venta_id: item.id,
                        monto_abono: item.monto,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        tipo_abono: "Transferencia",
                        detalle_abono: `Conciliación bancaria - Movimiento: ${selectedMovimiento.descripcion}`
                    });
                } else {
                    // Update Compra -> estado_pago = 'Pagada', saldo = 0
                    const { error: errCompra } = await supabase.from("compras").update({
                        estado_pago: "Pagada",
                        saldo: 0
                    }).eq("id", item.id);

                    if (errCompra) throw errCompra;
                }
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


    const handlePreconciliacion = async () => {
        if (!selectedPeriod || movimientos.length === 0) return;

        setIsPreconciliating(true);
        const pendientes = movimientos.filter(m => m.estado === 'pendiente');
        const encontradas: { mov: BancoMovimiento; match: Coincidencia }[] = [];
        const tolerancia = 5;

        try {
            // Buscamos coincidencias para cada movimiento pendiente
            for (const mov of pendientes) {
                const esAbono = mov.abonos > 0;
                const montoBuscado = esAbono ? mov.abonos : mov.cargos;
                let candidate: Coincidencia | null = null;

                if (esAbono) {
                    const { data: ventasMatch } = await supabase
                        .from("ventas")
                        .select("*")
                        .gte("mnt_total", montoBuscado - tolerancia)
                        .lte("mnt_total", montoBuscado + tolerancia)
                        .limit(2); // Solo nos interesa si hay exactamente 1

                    if (ventasMatch && ventasMatch.length === 1) {
                        const v = ventasMatch[0];
                        candidate = {
                            id: v.id,
                            tipo: 'venta',
                            entidad: v.rzn_soc_recep || "Desconocido",
                            fecha: v.fch_emis,
                            monto: v.mnt_total,
                            folio: v.folio,
                            estado: v.estado_deuda || "Pendiente",
                            documento_relacionado: v
                        };
                    }
                } else {
                    const { data: comprasMatch } = await supabase
                        .from("compras")
                        .select("*")
                        .gte("monto_total", montoBuscado - tolerancia)
                        .lte("monto_total", montoBuscado + tolerancia)
                        .limit(2);

                    if (comprasMatch && comprasMatch.length === 1) {
                        const c = comprasMatch[0];
                        candidate = {
                            id: c.id,
                            tipo: 'compra',
                            entidad: c.razon_social || "Desconocido",
                            fecha: c.fecha_emision,
                            monto: c.monto_total,
                            folio: c.folio,
                            estado: c.estado_pago || "Pendiente",
                            documento_relacionado: c
                        };
                    }
                }

                if (candidate) {
                    encontradas.push({ mov, match: candidate });
                }
            }

            setPreconciliacionesEncontradas(encontradas);

            // Actualizar el estado local de los movimientos para marcar los preconciliados visualmente
            setMovimientos(prev => prev.map(mov => {
                const matchFound = encontradas.find(e => e.mov.id === mov.id);
                if (matchFound) {
                    return { ...mov, preconciliado_match: matchFound.match };
                }
                return mov;
            }));

            setPreconciliacionOpen(true);
        } catch (error) {
            console.error("Error en preconciliación:", error);
            alert("Ocurrió un error al buscar coincidencias.");
        } finally {
            setIsPreconciliating(false);
        }
    };

    const ejecutarConciliacionEspecifica = async (mov: BancoMovimiento, item: Coincidencia) => {
        if (!confirm(`¿Conciliar este movimiento con ${item.tipo === 'venta' ? 'la Venta' : 'la Compra'} Folio ${item.folio}?`)) return;

        setLoading(true);
        try {
            // 1. Actualizar Movimiento Bancario
            const { error: errMov } = await supabase
                .from("banco_movimientos")
                .update({
                    estado: "conciliado",
                    tipo_conciliacion: item.tipo,
                    conciliado_id: item.id
                })
                .eq("id", mov.id);

            if (errMov) throw errMov;

            // 2. Actualizar Registro Relacionado (Venta o Compra)
            if (item.estado !== "Pagada") {
                if (item.tipo === "venta") {
                    await supabase.from("ventas").update({
                        estado_deuda: "Pagada",
                        saldo: 0,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        monto_abono: item.monto
                    }).eq("id", item.id);

                    await supabase.from("abonos").insert({
                        venta_id: item.id,
                        monto_abono: item.monto,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        tipo_abono: "Transferencia",
                        detalle_abono: `Conciliación - Movimiento: ${mov.descripcion}`
                    });
                } else {
                    await supabase.from("compras").update({
                        estado_pago: "Pagada",
                        saldo: 0
                    }).eq("id", item.id);
                }
            }

            // Actualizar estado local
            setMovimientos(prev => prev.map(m =>
                m.id === mov.id
                    ? { ...m, estado: "conciliado", tipo_conciliacion: item.tipo, conciliado_id: item.id, preconciliado_match: null }
                    : m
            ));

            alert("¡Conciliado exitosamente!");
        } catch (e: any) {
            console.error("Error conciliando:", e);
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const fmtMoney = (amount: number) => {
        return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    };

    return (
        <div className="space-y-6 pb-10 fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ArrowRightLeft className="h-8 w-8 text-indigo-600" />
                        Conciliación Bancaria
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <select
                            className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                        >
                            {Array.from(new Set(cartolas.map(c => c.periodo_mes)))
                                .filter(Boolean)
                                .sort()
                                .reverse()
                                .map(periodCode => {
                                    if (!periodCode) return null;
                                    const [year, month] = periodCode.split('-');
                                    const date = new Date(parseInt(year), parseInt(month) - 1);
                                    let displayText = date.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
                                    displayText = displayText.charAt(0).toUpperCase() + displayText.slice(1);

                                    return (
                                        <option key={periodCode} value={periodCode}>
                                            {displayText}
                                        </option>
                                    );
                                })}
                            {!cartolas.some(c => c.periodo_mes) && <option value="">Sin períodos</option>}
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
                            className={`cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 ${uploading ? 'opacity-70' : ''}`}
                        >
                            {uploading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4 mr-2" />
                            )}
                            {uploading ? "Procesando..." : "Subir Cartola"}
                        </Label>
                    </div>

                    <Button
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                        onClick={handlePreconciliacion}
                        disabled={isPreconciliating || loading || movimientos.filter(m => m.estado === 'pendiente').length === 0}
                    >
                        {isPreconciliating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                        )}
                        Pre-conciliar
                    </Button>
                </div>
            </div>

            {selectedPeriod && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {(() => {
                        const c = cartolas.find(x => x.periodo_mes === selectedPeriod);
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
                                <TableHead className="w-[100px]">Fecha</TableHead>
                                <TableHead className="min-w-[300px]">Descripción</TableHead>
                                <TableHead className="w-[150px]">Tipo de Gasto</TableHead>
                                <TableHead className="text-right text-red-600 w-[120px]">Cargos</TableHead>
                                <TableHead className="text-right text-green-600 w-[120px]">Abonos</TableHead>
                                <TableHead className="text-right w-[120px]">Saldo</TableHead>
                                <TableHead className="text-center w-[130px]">Estado</TableHead>
                                <TableHead className="text-center w-[120px]">Acción</TableHead>
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
                                        {selectedPeriod ? "Este período no tiene movimientos" : "Sube una cartola para comenzar"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movimientos.map((mov) => (
                                    <TableRow
                                        key={mov.id}
                                        className={
                                            mov.estado === 'conciliado'
                                                ? 'bg-gray-50 dark:bg-gray-900/30 opacity-75'
                                                : mov.preconciliado_match
                                                    ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-400'
                                                    : ''
                                        }
                                    >
                                        <TableCell className="font-medium whitespace-nowrap">{mov.fecha}</TableCell>
                                        <TableCell className="whitespace-normal break-words py-4 leading-relaxed min-w-[300px]" title={mov.descripcion}>
                                            {mov.descripcion}
                                        </TableCell>
                                        <TableCell className="w-[150px]">
                                            <select
                                                className="w-full p-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                value={mov.tipo_gasto || ""}
                                                onChange={(e) => handleTipoGastoChange(mov.id, e.target.value)}
                                            >
                                                <option value="">Sin categoría</option>
                                                {categorias.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </TableCell>
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
                                            ) : mov.preconciliado_match ? (
                                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100 flex items-center gap-1">
                                                    <ArrowRightLeft className="w-3 h-3" /> Pre-conciliado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">Pendiente</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {mov.estado !== 'conciliado' && (
                                                <div className="flex justify-center gap-2">
                                                    {mov.preconciliado_match && (
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 px-3 shadow-sm"
                                                            onClick={() => ejecutarConciliacionEspecifica(mov, mov.preconciliado_match!)}
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                            <span className="text-[10px] font-bold">CONCILIAR</span>
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleConciliarClick(mov)}>
                                                        <Search className="h-4 w-4 text-indigo-600" />
                                                    </Button>
                                                </div>
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
                <DialogContent className="max-w-3xl bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100 font-bold">Conciliar Movimiento</DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
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
                                    <Badge variant="outline" className="border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                                        {selectedMovimiento.cargos > 0 ? 'Cargo / Gasto' : 'Abono / Ingreso'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {searchingMatch ? (
                                    <div className="text-center py-6">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Buscando documentos relacionados...</p>
                                    </div>
                                ) : coincidencias.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Se encontraron posibles coincidencias por monto y estado.</p>
                                        {coincidencias.map((item) => (
                                            <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-l-4 border-l-indigo-400 shadow-sm">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="uppercase text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-none">{item.tipo}</Badge>
                                                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Folio {item.folio}</span>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${item.estado === 'Pagada' ? 'text-green-600 border-green-200 bg-green-50' : 'text-yellow-600 border-yellow-200 bg-yellow-50'}`}
                                                        >
                                                            {item.estado}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.entidad}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.fecha}</p>
                                                </div>
                                                <div className="text-right flex items-center gap-3">
                                                    <div className="font-bold text-gray-900 dark:text-gray-100">{fmtMoney(item.monto)}</div>
                                                    <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => ejecutarConciliacion(item)}>
                                                        Conciliar
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-md bg-gray-50/50 dark:bg-gray-900/20">
                                        <Search className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                                        <p>No se encontraron coincidencias automáticas.</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">Asegúrate de que el documento esté cargado y pendiente de pago.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Upload Summary Dialog */}
            <Dialog open={uploadSummaryOpen} onOpenChange={setUploadSummaryOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                            Resumen de Carga
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                            Detalles de los movimientos procesados desde el archivo Excel.
                        </DialogDescription>
                    </DialogHeader>

                    {uploadSummary && (
                        <div className="space-y-4 py-4">
                            {/* Statistics Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase mb-1">Total Procesados</p>
                                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{uploadSummary.total}</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase mb-1">Nuevos Insertados</p>
                                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">{uploadSummary.nuevos}</p>
                                </div>
                                {uploadSummary.duplicados > 0 && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold uppercase mb-1">Duplicados Omitidos</p>
                                        <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{uploadSummary.duplicados}</p>
                                    </div>
                                )}
                            </div>

                            {/* Financial Summary */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Resumen Financiero</h4>

                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Saldo Inicial</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        ${uploadSummary.saldoInicial.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-sm text-red-600 dark:text-red-400">Total Cargos</span>
                                    <span className="font-semibold text-red-700 dark:text-red-400">
                                        -${uploadSummary.cargos.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-sm text-green-600 dark:text-green-400">Total Abonos</span>
                                    <span className="font-semibold text-green-700 dark:text-green-400">
                                        +${uploadSummary.abonos.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-2 bg-gray-50 dark:bg-gray-800 px-3 rounded-md">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saldo Final</span>
                                    <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                                        ${uploadSummary.saldoFinal.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button onClick={() => setUploadSummaryOpen(false)}>
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Pre-conciliacion */}
            <Dialog open={preconciliacionOpen} onOpenChange={setPreconciliacionOpen}>
                <DialogContent className="max-w-3xl bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100 font-bold flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                            Pre-conciliación Sugerida
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            Se han encontrado {preconciliacionesEncontradas.length} movimientos con coincidencias exactas y únicas por monto.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[50vh] overflow-y-auto space-y-2 py-4">
                        {preconciliacionesEncontradas.length > 0 ? (
                            preconciliacionesEncontradas.map((item, index) => (
                                <div key={index} className="flex flex-col p-3 border border-gray-100 dark:border-gray-800 rounded-md bg-gray-50/50 dark:bg-gray-900/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase">Movimiento Bancario</p>
                                            <p className="text-sm font-bold truncate">{item.mov.descripcion}</p>
                                            <p className="text-[10px] text-gray-400">{item.mov.fecha}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${item.mov.cargos > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {fmtMoney(item.mov.cargos || item.mov.abonos)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded border border-indigo-100 dark:border-indigo-900/30">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">{item.match.tipo}</Badge>
                                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Folio {item.match.folio}</span>
                                        </div>
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">{item.match.entidad}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">No se encontraron coincidencias únicas para pre-conciliar.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setPreconciliacionOpen(false)}>
                            Cerrar
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => setPreconciliacionOpen(false)}
                            disabled={preconciliacionesEncontradas.length === 0}
                        >
                            Aceptar Preconciliaciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
