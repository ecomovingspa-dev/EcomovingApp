
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
    Save
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


// Types
interface BancoMovimiento {
    id?: number;
    cartola_id?: number;
    fecha: string | null; // YYYY-MM-DD
    descripcion: string;
    numero_documento: string | null;
    cargos: number;
    abonos: number;
    saldo: number;
    estado: string; // 'pendiente', 'conciliado'
    tipo_conciliacion?: string;
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

export default function ConciliacionPage() {
    const [cartolas, setCartolas] = useState<BancoCartola[]>([]);
    const [movimientos, setMovimientos] = useState<BancoMovimiento[]>([]);
    const [selectedCartola, setSelectedCartola] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

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

            // Convert sheet to array of arrays to handle custom layout
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

            // 1. Extract Header Info (Based on BCI layout)
            // Empresa: Row 2 (Index 2 in 0-based? Let's assume user image is accurate)
            // Visual inspection:
            // Row 1: Logo Bci
            // Row 3: Empresa (Col C) | Ejecutivo (Col K)
            // Row 4: N de cuenta (Col C) | Periodo (Col K)
            // Row 5: Oficina
            // Row 9: Periodo | Saldo Anterior | Total Cargos ...
            // Row 10: Values for above

            // Safety check: is it really BCI format?
            // Let's implement robust searching for keywords just in case
            let saldoInicial = 0;
            let saldoFinal = 0;
            let banco = "BCI"; // Default assumption
            let periodo = "";

            // Try to find "Saldo Anterior" and "Saldo Contable Final" logic
            // Usually around row 9-10
            // Let's assume fixed positions for now as per "como muestra la imagen"
            // Row 10 (index 9) cols C (2) and I/M?

            // Let's iterate looking for the summary row
            let summaryRowIndex = -1;
            let movementsStartIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                const rowStr = JSON.stringify(rows[i]).toLowerCase();
                if (rowStr.includes("saldo anterior") && rowStr.includes("saldo contable final")) {
                    summaryRowIndex = i + 1; // data is next row
                }
                if (rowStr.includes("movimientos cuenta corriente")) {
                    movementsStartIndex = i + 2; // header then data?
                }
                // If we find the specific header row for movements
                if (rows[i] && rows[i].includes("Fecha") && rows[i].includes("Descripción") && rows[i].includes("Cargos y Cheques")) {
                    // Wait, image says "Cheques y otros" and "Depósitos y Abono"
                }
                if (rows[i] && rows[i].some((cell: any) => typeof cell === 'string' && cell.includes("Cheques y otros"))) {
                    movementsStartIndex = i + 1;
                }
            }

            // Fallback extraction
            if (summaryRowIndex !== -1 && rows[summaryRowIndex]) {
                // BCI Image: Saldo Anterior is 2nd value? 
                // Headers: Periodo | Saldo Anterior | Total Cargos... | Total Abonos... | Saldo Contable Final
                // Data:    Range   | 23.347        | 1.617.981      | ...             | 390.040
                // Let's try finding numbers in that row
                const summaryRow = rows[summaryRowIndex];
                // Simple heuristic: First Number is Saldo Anterior, Last Number is Saldo Final? 
                // Or strictly by column index if predictable.
                // Let's filter for numbers
                const numbers = summaryRow.filter(cell => typeof cell === 'number');
                if (numbers.length >= 2) {
                    saldoInicial = numbers[0];
                    saldoFinal = numbers[numbers.length - 1];
                }
            }

            // 2. Extract Movements
            const parsedMovimientos: any[] = [];

            if (movementsStartIndex !== -1) {
                for (let i = movementsStartIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    // Stop if empty or total line
                    const firstCell = row[0];
                    if (!firstCell) continue;

                    // Image Columns logic (0-indexed):
                    // A(0): Fecha
                    // B(1): Sucursal
                    // F(5)?: Descripción (Merged?)
                    // H(7)?: N Documento
                    // K(10)?: Cheques y otros (Cargos)
                    // M(12)?: Depósitos y Abono (Abonos)
                    // O(14)?: Saldo diario

                    // We need to be resilient to empty cells shifting indices if the array is sparse
                    // Better to map by known headers if possible, but 'sheet_to_json' with header:1 gives sparse arrays usually.

                    // Let's assume the array indices correspond roughly to Excel columns A=0, B=1 ...
                    // A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14

                    const fechaRaw = row[0]; // A
                    const descripcion = row[2] || row[3] || row[4] || row[5]; // Try to grab description, it spans multiple cols often
                    const nDoc = row[7] || row[8]; // H/I ?

                    // Values
                    const cargoStr = row[10]; // K
                    const abonoStr = row[12]; // M
                    const saldoStr = row[14]; // O

                    // If no date, skip
                    if (!fechaRaw) continue;

                    // Parse Date
                    let fecha: string | null = null;
                    if (typeof fechaRaw === 'number') {
                        const date = XLSX.SSF.parse_date_code(fechaRaw);
                        fecha = new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
                    } else if (typeof fechaRaw === 'string') {
                        // Try DD/MM/YYYY
                        const parts = fechaRaw.split('/');
                        if (parts.length === 3) {
                            fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }
                    }

                    if (!fecha) continue; // Invalid row

                    const cargo = typeof cargoStr === 'number' ? cargoStr : 0;
                    const abono = typeof abonoStr === 'number' ? abonoStr : 0;
                    const saldo = typeof saldoStr === 'number' ? saldoStr : 0;

                    // Description cleanup
                    // Sometimes description is split in cols, we can join valid strings between col 2 and 7
                    const descParts = [];
                    for (let k = 2; k <= 6; k++) {
                        if (typeof row[k] === 'string') descParts.push(row[k]);
                    }
                    const finalDesc = descParts.join(" ") || "Sin descripción";

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

            // Save to Supabase
            if (parsedMovimientos.length > 0) {
                await descomponerYGuardar(file.name, saldoInicial, saldoFinal, parsedMovimientos);
            } else {
                alert("No se encontraron movimientos válidos. Verifica el formato.");
            }

        } catch (e) {
            console.error("Error analyzing excel:", e);
            alert("Error leyendo el archivo.");
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = "";
        }
    };

    const descomponerYGuardar = async (fileName: string, sIni: number, sFin: number, movs: any[]) => {
        // 1. Create Header
        const { data: cartolaData, error: cartolaError } = await supabase
            .from("banco_cartolas")
            .insert({
                nombre_archivo: fileName,
                banco: "BCI", // detected or default
                periodo: "Detectado", // Could verify min/max date
                saldo_inicial: sIni,
                saldo_final: sFin
            })
            .select()
            .single();

        if (cartolaError || !cartolaData) {
            alert("Error guardando cartola: " + cartolaError?.message);
            return;
        }

        // 2. Create Movements
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

    // Format helpers
    const fmtMoney = (amount: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    };

    return (
        <div className="space-y-6 pb-10">
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
                    {/* Selector de Cartolas */}
                    <div className="relative w-64">
                        <select
                            className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                            value={selectedCartola || ""}
                            onChange={(e) => setSelectedCartola(Number(e.target.value))}
                        >
                            {cartolas.map(c => (
                                <option key={c.id} value={c.id}>
                                    {new Date(c.fecha_carga).toLocaleDateString()} - {c.nombre_archivo}
                                </option>
                            ))}
                            {!cartolas.length && <option value="">Sin cartolas</option>}
                        </select>
                    </div>

                    {/* Upload Button */}
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

            {/* Resumen Periodo */}
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

            {/* Tabla Movimientos */}
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
                                    <TableRow key={mov.id}>
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
                                                <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-none">OK</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">Pendiente</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <PlusCircle className="h-4 w-4 text-indigo-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
