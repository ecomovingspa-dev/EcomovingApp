// BCI Reconciliation Page - Updated: 2026-01-30T23:11
// Force rebuild
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
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
    Check,
    Mic,
    MicOff,
    Sparkles,
    Trash2,
    Info,
    FileText,
    Calendar,
    DollarSign,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { askGeminiAboutImage } from "../../lib/gemini";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

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
    // BCI Detailed Columns
    bci_glosa_detalle?: string | null;
    bci_comentario_transferencia?: string | null;
    bci_rut?: string | null;
    bci_nombre?: string | null;
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
    monto: number; // Monto PENDIENTE (Saldo)
    monto_total: number; // Monto Original
    folio: string | number;
    estado?: string;
    documento_relacionado?: any;
    score?: number; // 0-100 confidence score
    matchReason?: string; // Description of why this matched
    conciliado?: boolean;
    saldo?: number;
}

// ============================================================
// PROFESSIONAL HELPER FUNCTIONS - EXTRACTED FOR REUSABILITY
// ============================================================

/** Tolerancia de monto para matching (en pesos) */
const TOLERANCIA_MONTO = 5;

/** Cantidad de movimientos por página */
const ITEMS_PER_PAGE = 50;

/** Palabras bancarias comunes que no identifican a un cliente/proveedor */
const BANK_NOISE = new Set([
    'TRANSFERENCIA', 'ABONO', 'PAGO', 'RECIBIDO', 'DE', 'POR', 'TEF', 'ELECTRONICA', 'BANCARIA', 'DEPOSITO', 'DOCUMENTO',
    'CARGO', 'GASTO', 'COMISION', 'IVA', 'VALOR', 'RECAUDACION', 'PORTAL', 'BANCO', 'BCI', 'SANTANDER', 'ESTADO', 'CHILE',
    'SCOTIABANK', 'ITAU', 'WEB', 'APP', 'MOVIL', 'CAJERO', 'AUTOMATICO', 'SERVIPAG', 'UNIRED', 'TRANSBANK', 'ENVIADA',
    'PARA', 'DESTINATARIO', 'REMITENTE', 'GIRO', 'CHEQUE', 'EFECTIVO'
]);

/** Palabras de razón social que no aportan unicidad en la búsqueda */
const ENTITY_NOISE = new Set([
    'UNIVERSIDAD', 'SOCIEDAD', 'LTDA', 'LIMITADA', 'S.A.', 'SA', 'SPA', 'EIRL', 'EMPRESA', 'CIA', 'ASOCIACION',
    'CORPORACION', 'FUNDACION', 'DE', 'EL', 'LA', 'LOS', 'LAS', 'Y', 'AL', 'DEL', 'E', 'O', 'U', 'SERVICIOS',
    'INVERSIONES', 'COMERCIAL', 'LIMITAD', 'CHILE', 'S.P.A'
]);

/** Extrae términos significativos de un texto para búsqueda */
const getSearchTokens = (text: string | null | undefined): string[] => {
    if (!text) return [];
    return text.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^A-Z0-9\s]/g, ' ') // Solo letras, números y espacios
        .split(/\s+/)
        .filter(word => word.length >= 3)
        .filter(word => !BANK_NOISE.has(word) && !ENTITY_NOISE.has(word))
        .filter(word => isNaN(Number(word))); // No queremos números puros aquí (los folios se manejan aparte)
};

/** Rango de días para considerar fechas cercanas */
const RANGO_DIAS_FECHA = 60;

/**
 * Limpia un RUT chileno para búsqueda
 * Elimina puntos y normaliza formato
 */
const cleanRut = (rut: string | null | undefined): string | null => {
    if (!rut) return null;
    return rut.replace(/\./g, '').trim().toLowerCase();
};

/**
 * Normaliza texto para comparaciones (quita acentos y convierte a minúsculas)
 */
const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
};

/**
 * Extrae posibles folios de un texto
 * Busca números de 3-8 dígitos que podrían ser folios
 */
const extractFolios = (text: string | null | undefined): number[] => {
    if (!text) return [];
    const matches = text.match(/\b\d{3,8}\b/g);
    return matches ? matches.map(m => parseInt(m, 10)) : [];
};

/**
 * Calcula la diferencia en días entre dos fechas
 */
const getDateDiffDays = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calcula un score de confianza (0-100) para un match
 * Mayor score = mayor confianza en el match
 */
const calculateMatchScore = (
    matchType: 'folio_monto' | 'rut_monto' | 'monto_unico',
    movFecha: string,
    docFecha: string,
    movMonto: number,
    docMonto: number
): { score: number; reason: string } => {
    let score = 0;
    let reasons: string[] = [];

    // Base score by match type
    if (matchType === 'folio_monto') {
        score = 95;
        reasons.push('Folio + Monto coinciden');
    } else if (matchType === 'rut_monto') {
        score = 80;
        reasons.push('RUT + Monto coinciden');
    } else {
        score = 60;
        reasons.push('Solo monto único');
    }

    // Adjust by date proximity
    const daysDiff = getDateDiffDays(movFecha, docFecha);
    if (daysDiff <= 7) {
        score += 5;
        reasons.push('Fechas muy cercanas');
    } else if (daysDiff <= 30) {
        score += 2;
    } else if (daysDiff > 90) {
        score -= 10;
        reasons.push('Fechas distantes');
    }

    // Adjust by monto exactness
    if (movMonto === docMonto) {
        score += 3;
        reasons.push('Monto exacto');
    }

    return { score: Math.min(100, Math.max(0, score)), reason: reasons.join(' | ') };
};

export default function ConciliacionPage() {
    const [cartolas, setCartolas] = useState<BancoCartola[]>([]);
    const [movimientos, setMovimientos] = useState<BancoMovimiento[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [categorias, setCategorias] = useState<string[]>([]);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

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
    const [foliosCache, setFoliosCache] = useState<Record<string, string>>({});
    const [preconciliacionOpen, setPreconciliacionOpen] = useState(false);
    const [preconciliacionesEncontradas, setPreconciliacionesEncontradas] = useState<{ mov: BancoMovimiento; match: Coincidencia }[]>([]);
    const [isPreconciliating, setIsPreconciliating] = useState(false);
    const [searchQuery, setSearchQuery] = useState(""); // Búsqueda de movimientos

    // --- CONCILIACIÓN MANUAL STATE ---
    const [manualCategoria, setManualCategoria] = useState("");
    const [manualDetalle, setManualDetalle] = useState("");
    const [manualReferencia, setManualReferencia] = useState("");
    const [conciliandoManual, setConciliandoManual] = useState(false);

    // --- VOICE AGENT STATE ---
    const [isListening, setIsListening] = useState(false);
    const [agentText, setAgentText] = useState("");
    const [agentResponse, setAgentResponse] = useState("");
    const [agentProcessing, setAgentProcessing] = useState(false);

    // --- MULTI-SELECTION STATE ---
    const [multipleSelectedDocs, setMultipleSelectedDocs] = useState<Coincidencia[]>([]);
    const [allUnreconciledDocs, setAllUnreconciledDocs] = useState<Coincidencia[]>([]);
    const [loadingAllDocs, setLoadingAllDocs] = useState(false);
    const [multiSearchQuery, setMultiSearchQuery] = useState("");

    const speak = (text: string) => {
        const SpeechSynthesis = (window as any).speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-CL';
        SpeechSynthesis.speak(utterance);
    };

    const toggleVoiceAgent = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Tu navegador no soporta reconocimiento de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-CL';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
            setAgentResponse("Te escucho, Mario...");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setAgentText(transcript);
            processAgentCommand(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error(event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const stopListening = () => {
        setIsListening(false);
    };

    const processAgentCommand = async (command: string) => {
        setAgentProcessing(true);
        try {
            const resumeMovimientos = movimientos
                .filter(m => m.estado === 'pendiente')
                .slice(0, 10)
                .map(m => `ID: ${m.id}, Desc: ${m.descripcion}, Monto: ${m.cargos || m.abonos}`)
                .join(" | ");

            const systemPrompt = `
Eres el Agente de Conciliación de Ecomoving. Tu misión es ayudar a Mario a gestionar la cartola bancaria.
MOVIMIENTOS PENDIENTES ACTUALES: ${resumeMovimientos}
CATEGORÍAS DISPONIBLES: ${categorias.join(", ")}

INSTRUCCIÓN DEL USUARIO: "${command}"

Responde EXCLUSIVAMENTE en formato JSON plano (sin markdown):
{
  "intent": "categorize" | "reconcile" | "info" | "unknown",
  "target_id": number,
  "value": "nombre de categoria",
  "message": "Mensaje corto de voz para Mario"
}

Ejemplos:
- "Ponle categoría Mugs al movimiento 5": {"intent": "categorize", "target_id": 5, "value": "MUGS", "message": "Listo Mario, clasificado como MUGS."}
- "¿Qué movimientos tengo?": {"intent": "info", "message": "Tienes ${movimientos.filter(m => m.estado === 'pendiente').length} movimientos pendientes."}
`;

            const responseText = await askGeminiAboutImage(null, systemPrompt);
            const cleanJson = responseText.replace(/```json|```/g, "").trim();
            const action = JSON.parse(cleanJson);

            setAgentResponse(action.message);
            speak(action.message);

            if (action.intent === "categorize" && action.target_id && action.value) {
                await handleTipoGastoChange(action.target_id, action.value);
            } else if (action.intent === "reconcile" && action.target_id) {
                const mov = movimientos.find(m => m.id === action.target_id);
                if (mov) handleConciliarClick(mov);
            }

        } catch (error) {
            console.error("Error Agente:", error);
            setAgentResponse("Perdona Mario, hubo un problema.");
        } finally {
            setAgentProcessing(false);
        }
    };

    useEffect(() => {
        cargarCartolas();
        cargarCategorias();
    }, []);

    useEffect(() => {
        if (selectedPeriod) {
            cargarMovimientos(selectedPeriod, currentPage);
        } else {
            setMovimientos([]);
            setTotalRecords(0);
        }
    }, [selectedPeriod, currentPage, searchQuery]);

    // Reset page when period or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedPeriod, searchQuery]);

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

    const cargarMovimientos = async (periodo: string, page: number = 1) => {
        if (!periodo) return;
        setLoading(true);
        try {
            let query = supabase.from("banco_movimientos").select("*", { count: 'exact' });

            // 1. Filtro por Período
            if (periodo !== "__ALL__") {
                const [year, month] = periodo.split('-');
                const startDate = `${periodo}-01`;
                const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
                const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
                const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
                query = query.gte("fecha", startDate).lt("fecha", endDate);
            }

            // 2. Filtro por Búsqueda (Texto)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                // Filtros especiales por estado en la query
                if (q === 'conciliado' || q === 'conciliados') {
                    query = query.eq('estado', 'conciliado');
                } else if (q === 'pendiente' || q === 'pendientes') {
                    query = query.eq('estado', 'pendiente');
                } else {
                    // Búsqueda general por texto (ilike)
                    query = query.or(`descripcion.ilike.%${q}%,bci_nombre.ilike.%${q}%,bci_rut.ilike.%${q}%,bci_comentario_transferencia.ilike.%${q}%,numero_documento.ilike.%${q}%,tipo_gasto.ilike.%${q}%`);
                }
            }

            // 3. Paginación y Orden
            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error, count } = await query
                .order("fecha", { ascending: false })
                .range(from, to);

            if (error) throw error;
            
            setMovimientos(data || []);
            setTotalRecords(count || 0);

            // 4. Cargar Folios en Lote para el Caché
            const conciliados = (data || []).filter(m => m.estado === 'conciliado' && m.conciliado_id);
            if (conciliados.length > 0) {
                const ventasIds = [...new Set(conciliados
                    .filter(m => m.tipo_conciliacion === 'venta' || m.tipo_conciliacion === 'multiple')
                    .map(m => m.conciliado_id))];
                const comprasIds = [...new Set(conciliados
                    .filter(m => m.tipo_conciliacion === 'compra')
                    .map(m => m.conciliado_id))];

                const newCache = { ...foliosCache };
                let changed = false;

                if (ventasIds.length > 0) {
                    const { data: vData } = await supabase.from('ventas').select('id, folio').in('id', ventasIds);
                    vData?.forEach(v => {
                        newCache[`venta:${v.id}`] = v.folio;
                        newCache[`multiple:${v.id}`] = v.folio;
                        changed = true;
                    });
                }

                if (comprasIds.length > 0) {
                    const { data: cData } = await supabase.from('compras').select('id, folio').in('id', comprasIds);
                    cData?.forEach(c => {
                        newCache[`compra:${c.id}`] = c.folio;
                        changed = true;
                    });
                }
                if (changed) setFoliosCache(newCache);
            }
        } catch (error) {
            console.error("Error loading movimientos:", error);
        } finally {
            setLoading(false);
        }
    };

    const cargarCategorias = async () => {
        try {
            console.log("Banco: Intentando cargar categorías desde 'banco_categorias'...");
            const { data, error } = await supabase
                .from("banco_categorias")
                .select("nombre")
                .order("nombre", { ascending: true });

            if (error) {
                console.error("Banco: Error al cargar categorías:", error);
                throw error;
            }
            
            const list = data?.map(c => c.nombre) || [];
            console.log("Banco: Categorías encontradas:", list.length, list);
            setCategorias(list);
        } catch (error) {
            console.error("Banco: Error fatal cargando categorias:", error);
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
                    .from("banco_categorias")
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

            let saldoInicial = 0;
            let saldoFinal = 0;
            let movementsStartIndex = -1;

            // Column indices - will be detected from headers
            let fechaIdx = -1;
            let docIdx = -1;
            let ingresoIdx = -1;  // Abonos (dinero que entra)
            let egresoIdx = -1;   // Cargos (dinero que sale)
            let saldoIdx = -1;
            let bciGlosaIdx = -1;
            let bciComentarioIdx = -1;
            let bciRutIdx = -1;
            let bciNombreIdx = -1;

            const cleanStr = (val: any) => String(val || "").toLowerCase().trim().replace(/\s+/g, ' ');

            const parseMoney = (val: any): number => {
                if (val === undefined || val === null || val === "") return 0;
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    let clean = val.replace(/[^0-9,.-]/g, '');
                    if (clean.includes(',') && clean.includes('.')) {
                        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                            clean = clean.replace(/\./g, '').replace(',', '.');
                        } else {
                            clean = clean.replace(/,/g, '');
                        }
                    } else if (clean.includes(',')) {
                        clean = clean.replace(',', '.');
                    } else if ((clean.match(/\./g) || []).length > 1) {
                        clean = clean.replace(/\./g, '');
                    }
                    return parseFloat(clean) || 0;
                }
                return 0;
            };

            // 1. Scan for Headers - Look for the row with column headers
            for (let i = 0; i < Math.min(rows.length, 30); i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const rowStr = row.map(cleanStr).join(" ");

                // Detect header row by looking for key BCI columns
                const hasIngreso = rowStr.includes("ingreso");
                const hasEgreso = rowStr.includes("egreso");
                const hasFecha = rowStr.includes("fecha");
                const hasGlosa = rowStr.includes("glosa");

                if (hasFecha && (hasIngreso || hasEgreso || hasGlosa)) {
                    movementsStartIndex = i + 1;

                    // Map each column
                    row.forEach((cell: any, idx: number) => {
                        const val = cleanStr(cell);

                        // Fecha
                        if (val.includes("fecha") && fechaIdx === -1) {
                            fechaIdx = idx;
                        }

                        // Glosa detalle
                        if (val.includes("glosa") && val.includes("detalle")) {
                            bciGlosaIdx = idx;
                        } else if (val.includes("glosa") && bciGlosaIdx === -1) {
                            bciGlosaIdx = idx;
                        }

                        // Ingreso (Abonos - dinero que entra)
                        if (val.includes("ingreso")) {
                            ingresoIdx = idx;
                        }

                        // Egreso (Cargos - dinero que sale)
                        if (val.includes("egreso")) {
                            egresoIdx = idx;
                        }

                        // Saldo
                        if (val.includes("saldo") && (val.includes("contable") || val.includes("actual"))) {
                            saldoIdx = idx;
                        } else if (val.includes("saldo") && saldoIdx === -1) {
                            saldoIdx = idx;
                        }

                        // Comentario
                        if (val.includes("comentario")) {
                            bciComentarioIdx = idx;
                        }

                        // RUT
                        if (val === "rut" || val.includes("rut ")) {
                            bciRutIdx = idx;
                        }

                        // Nombre
                        if (val === "nombre" || val.includes("nombre ")) {
                            bciNombreIdx = idx;
                        }

                        // Número documento
                        if (val.includes("numero") || val.includes("n°") || val.includes("num ") || val.includes("serie")) {
                            docIdx = idx;
                        }
                    });

                    console.log("BCI Parser - Columnas detectadas:", {
                        fecha: fechaIdx,
                        glosa: bciGlosaIdx,
                        ingreso: ingresoIdx,
                        egreso: egresoIdx,
                        saldo: saldoIdx,
                        comentario: bciComentarioIdx,
                        rut: bciRutIdx,
                        nombre: bciNombreIdx,
                        doc: docIdx,
                        headerRow: i
                    });
                    break; // Found header row, stop searching
                }
            }

            if (movementsStartIndex === -1 || (ingresoIdx === -1 && egresoIdx === -1)) {
                alert("No se detectó el formato de cartola BCI. Asegúrate de que el archivo tenga columnas de Fecha, Ingreso y/o Egreso.");
                setUploading(false);
                return;
            }


            const parsedMovimientos: any[] = [];
            if (movementsStartIndex !== -1) {
                for (let i = movementsStartIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    // Handle fechaIdx = -1 case
                    const fechaRaw = fechaIdx !== -1 ? row[fechaIdx] : row[0];
                    if (!fechaRaw) continue;

                    // Date Parsing
                    let fecha: string | null = null;
                    if (typeof fechaRaw === 'number') {
                        const date = XLSX.SSF.parse_date_code(fechaRaw);
                        fecha = new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
                    } else if (typeof fechaRaw === 'string') {
                        const parts = fechaRaw.trim().split('/');
                        if (parts.length === 3) fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    if (!fecha) continue;

                    // Description & Content
                    const finalDesc = String(bciGlosaIdx !== -1 ? row[bciGlosaIdx] : row[1] || "Sin descripción");
                    const nDoc = docIdx !== -1 ? row[docIdx] : null;

                    // Egreso = Cargos (dinero que sale), Ingreso = Abonos (dinero que entra)
                    const cargo = egresoIdx !== -1 ? parseMoney(row[egresoIdx]) : 0;
                    const abono = ingresoIdx !== -1 ? parseMoney(row[ingresoIdx]) : 0;
                    const saldo = saldoIdx !== -1 ? parseMoney(row[saldoIdx]) : 0;

                    parsedMovimientos.push({
                        fecha,
                        descripcion: finalDesc,
                        numero_documento: nDoc ? String(nDoc) : null,
                        cargos: cargo,
                        abonos: abono,
                        saldo: saldo,
                        estado: 'pendiente',
                        bci_glosa_detalle: bciGlosaIdx !== -1 ? String(row[bciGlosaIdx] || "") : "",
                        bci_comentario_transferencia: bciComentarioIdx !== -1 ? String(row[bciComentarioIdx] || "") : null,
                        bci_rut: bciRutIdx !== -1 ? String(row[bciRutIdx] || "") : null,
                        bci_nombre: bciNombreIdx !== -1 ? String(row[bciNombreIdx] || "") : null
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
    // Must be stable across different uploads of the same movement
    const generateMovementHash = (mov: any): string => {
        // Safe string for hashing (handle tildes/unicode)
        const normalize = (val: any) => String(val || "").trim().toLowerCase();

        const data = [
            normalize(mov.fecha),
            normalize(mov.descripcion),
            normalize(mov.cargos),
            normalize(mov.abonos),
            normalize(mov.saldo),
            normalize(mov.bci_rut),
            normalize(mov.numero_documento)
        ].join('|');

        // DJB2 Hash implementation (better than simple integer addition)
        let hash = 5381;
        for (let i = 0; i < data.length; i++) {
            hash = (hash * 33) ^ data.charCodeAt(i);
        }
        return `hash_${(hash >>> 0).toString(36)}`;
    };


    const descomponerYGuardar = async (fileName: string, sIni: number, sFin: number, movs: any[]) => {
        try {
            // Calculate periodo_mes from first movement date
            let periodoMes = "Detectado";
            if (movs.length > 0 && movs[0].fecha) {
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
                // Now passing only the movement, making hash stable across uploads
                const uniqueId = generateMovementHash(m);
                return {
                    ...m,
                    cartola_id: cartolaData.id,
                    unique_id: uniqueId
                };
            });

            // Check for existing movements with same unique_id to prevent duplicates across uploads
            const uniqueIds = movimientosConId.map(m => m.unique_id);
            const { data: existingMovs } = await supabase
                .from("banco_movimientos")
                .select("unique_id")
                .in("unique_id", uniqueIds);

            const existingIdsInDb = new Set(existingMovs?.map(m => m.unique_id) || []);

            // Filter out those already in DB AND deduplicate those within the same Excel file
            const seenInBatch = new Set();
            const newMovimientos = movimientosConId.filter(m => {
                if (existingIdsInDb.has(m.unique_id)) return false;
                if (seenInBatch.has(m.unique_id)) return false;
                seenInBatch.add(m.unique_id);
                return true;
            });

            if (newMovimientos.length === 0) {
                alert("No hay movimientos nuevos para cargar (todos ya existen o están repetidos en el archivo).");
                setUploading(false);
                cargarCartolas();
                return;
            }

            const { error: movsError } = await supabase
                .from("banco_movimientos")
                .insert(newMovimientos);

            if (movsError) {
                alert("Error guardando movimientos: " + movsError.message);
                // Si fallan los movimientos, podemos intentar limpiar la cartola huérfana
                await supabase.from("banco_cartolas").delete().eq("id", cartolaData.id);
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

                await cargarCartolas();
                setSelectedPeriod(periodoMes);
            }
        } catch (err: any) {
            console.error("Error crítico en guardado:", err);
            alert("Error crítico al procesar los datos: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    // --- RECONCILIATION LOGIC ---
    const handleConciliarClick = (mov: BancoMovimiento) => {
        setSelectedMovimiento(mov);
        setConciliarOpen(true);
        setMatchTab("sugerencias");
        setMultipleSelectedDocs([]);
        cargarCategorias(); // Proactive reload of categories
        buscarSugerencias(mov);
    };

    const buscarSugerencias = async (mov: BancoMovimiento) => {
        setSearchingMatch(true);
        setCoincidencias([]);

        const esAbono = mov.abonos > 0;
        const montoBuscado = esAbono ? mov.abonos : mov.cargos;
        const fechaMovimiento = mov.fecha;

        // 1. Identificadores Fuertes (RUT y Folios)
        let rutCandidate = mov.bci_rut;
        if (!rutCandidate) {
            const textosExplorables = [mov.descripcion, mov.bci_glosa_detalle, mov.bci_comentario_transferencia].filter(Boolean) as string[];
            const regexRut = /(\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b)/;
            for (const t of textosExplorables) {
                const m = t.match(regexRut);
                if (m) { rutCandidate = m[0]; break; }
            }
        }
        const rutBuscado = cleanRut(rutCandidate);
        const rutSinDV = rutBuscado?.split('-')[0];

        const foliosEnContenedores = [
            ...extractFolios(mov.bci_comentario_transferencia),
            ...extractFolios(mov.descripcion),
            ...extractFolios(mov.numero_documento)
        ];
        const foliosUnicos = Array.from(new Set(foliosEnContenedores));

        // 2. Tokens de búsqueda (NLP básico)
        const tokens = getSearchTokens(`${mov.descripcion} ${mov.bci_glosa_detalle || ''}`);

        // 3. Sistema de Scoring
        const scoreCandidato = (doc: any, docFolio: number | string, docMontoOriginal: number, docSaldo: number, docFecha: string, entityName: string): { score: number; reason: string } => {
            let score = 0;
            const reasons: string[] = [];

            // A. Match RUT (Prioridad máxima)
            if (rutSinDV) {
                const docRut = cleanRut(doc.rut_recep || doc.rut_proveedor)?.split('-')[0];
                if (docRut === rutSinDV) {
                    score += 50;
                    reasons.push('Entidad (RUT)');
                }
            }

            // B. Match Folio
            const folioNum = typeof docFolio === 'string' ? parseInt(docFolio) : docFolio;
            if (foliosUnicos.includes(folioNum)) {
                score += 40;
                reasons.push('Folio');
            }

            // C. Match Monto (Priorizar coincidencia con Saldo Pendiente)
            const diffSaldo = Math.abs(docSaldo - montoBuscado);
            const diffTotal = Math.abs(docMontoOriginal - montoBuscado);

            if (diffSaldo === 0) {
                score += 30;
                reasons.push('Saldo exacto');
            } else if (diffTotal === 0) {
                score += 20;
                reasons.push('Monto total exacto');
            } else if (diffSaldo <= 5) {
                score += 25;
                reasons.push('Monto ajustable (saldo)');
            }

            // D. Match de Tokens (Nombre)
            const docTokens = getSearchTokens(entityName);
            const matchingTokens = tokens.filter(t => docTokens.includes(t));
            if (matchingTokens.length > 0) {
                score += (matchingTokens.length * 15);
                reasons.push(`Nombre (${matchingTokens.length} keywords)`);
            }

            // E. Proximidad Temporal
            const diffDias = getDateDiffDays(fechaMovimiento, docFecha);
            if (diffDias <= 7) score += 10;

            return { score, reason: reasons.join(' | ') };
        };

        const candidatesRaw: Array<Coincidencia & { scoreTmp: number }> = [];
        const tabla = esAbono ? 'ventas' : 'compras';
        const colEntidad = esAbono ? 'rzn_soc_recep' : 'razon_social';
        const colRut = esAbono ? 'rut_recep' : 'rut_proveedor';

        // 4. Búsqueda Multi-factor
        let query = supabase.from(tabla).select("*").eq("conciliado", false);

        // Construir filtros dinámicos basados en lo que tenemos
        const orFilters = [];
        if (rutSinDV) orFilters.push(`${colRut}.ilike.%${rutSinDV}%`);
        if (foliosUnicos.length > 0) orFilters.push(`folio.in.(${foliosUnicos.join(',')})`);
        // Solo usar los primeros 2 tokens para no sobrecargar la query SQL
        tokens.slice(0, 3).forEach(t => orFilters.push(`${colEntidad}.ilike.%${t}%`));

        if (orFilters.length > 0) {
            const { data } = await query.or(orFilters.join(',')).limit(100);
            if (data) {
                data.forEach(d => {
                    const montoTotal = d.mnt_total || d.monto_total || 0;
                    const balance = d.saldo !== undefined && d.saldo !== null ? d.saldo : montoTotal;

                    const { score, reason } = scoreCandidato(d, d.folio, montoTotal, balance, d.fch_emis || d.fecha_emision, d[colEntidad]);
                    candidatesRaw.push({
                        id: d.id,
                        tipo: esAbono ? 'venta' : 'compra',
                        entidad: d[colEntidad] || "Desconocido",
                        fecha: d.fch_emis || d.fecha_emision,
                        monto: balance, // Mostramos el Saldo como monto principal
                        monto_total: montoTotal,
                        folio: d.folio,
                        estado: d.estado_deuda || d.estado_pago || "Pendiente",
                        documento_relacionado: d,
                        score,
                        matchReason: reason,
                        scoreTmp: score
                    });
                });
            }
        }

        // 5. Fallback por Monto si no hay nada
        if (candidatesRaw.length === 0) {
            const { data: byMonto } = await supabase.from(tabla).select("*")
                .eq("conciliado", false)
                .gte(esAbono ? "mnt_total" : "monto_total", montoBuscado - 1)
                .lte(esAbono ? "mnt_total" : "monto_total", montoBuscado + 1)
                .limit(10);
            byMonto.forEach(d => {
                const montoTotal = d.mnt_total || d.monto_total || 0;
                const balance = d.saldo !== undefined && d.saldo !== null ? d.saldo : montoTotal;
                candidatesRaw.push({
                    id: d.id, tipo: esAbono ? 'venta' : 'compra',
                    entidad: d[colEntidad] || "Desconocido",
                    fecha: d.fch_emis || d.fecha_emision,
                    monto: balance,
                    monto_total: montoTotal,
                    folio: d.folio, estado: d.estado_deuda || d.estado_pago || "Pendiente",
                    documento_relacionado: d, score: 30, matchReason: 'Monto similar', scoreTmp: 30
                });
            });
        }

        const sortedCandidates = candidatesRaw
            .sort((a, b) => b.scoreTmp - a.scoreTmp)
            .slice(0, 20)
            .map(({ scoreTmp, ...rest }) => rest);

        setCoincidencias(sortedCandidates);
        setSearchingMatch(false);

        if (sortedCandidates.length === 0 && (rutSinDV || tokens.length > 0)) {
            cargarTodosLosDocumentosPendientes(mov);
            setMatchTab("multiple");
        }
    };

    const cargarTodosLosDocumentosPendientes = async (mov: BancoMovimiento) => {
        setLoadingAllDocs(true);
        try {
            const esAbono = Boolean(mov.abonos && mov.abonos > 0);
            const tabla = esAbono ? 'ventas' : 'compras';
            const colEntidad = esAbono ? 'rzn_soc_recep' : 'razon_social';
            const colRut = esAbono ? 'rut_recep' : 'rut_proveedor';

            const rutBuscado = cleanRut(mov.bci_rut);
            const rutSinDV = rutBuscado?.split('-')[0];
            const tokens = getSearchTokens(`${mov.descripcion} ${mov.bci_glosa_detalle || ''}`);

            let docs: Coincidencia[] = [];

            // 1. Filtrar por identificadores conocidos
            const q = (supabase.from(tabla).select("*") as any).eq("conciliado", false);
            const orFilters = [];
            if (rutSinDV) orFilters.push(`${colRut}.ilike.%${rutSinDV}%`);
            tokens.slice(0, 3).forEach(t => orFilters.push(`${colEntidad}.ilike.%${t}%`));

            if (orFilters.length > 0) {
                const { data } = await q.or(orFilters.join(',')).limit(100);
                if (data) docs = processDocs(data, esAbono);
            }

            // 2. Fallback: últimos 200 sin bancarizar si no hay filtros o resultados
            if (docs.length === 0) {
                const { data } = await (supabase.from(tabla).select("*") as any)
                    .eq("conciliado", false)
                    .order(esAbono ? 'fch_emis' : 'fecha_emision', { ascending: false })
                    .limit(200);
                if (data) docs = processDocs(data || [], esAbono);
            }

            setAllUnreconciledDocs(docs);
        } catch (error) {
            console.error("Error loading docs:", error);
        } finally {
            setLoadingAllDocs(false);
        }
    };


    // Helper para procesar documentos de ventas/compras a Coincidencia
    const processDocs = (data: any[], esAbono: boolean): Coincidencia[] => {
        return data
            .filter((d: any) => {
                const montoTotal = d.mnt_total || d.monto_total || 0;
                const balance = d.saldo !== undefined && d.saldo !== null ? d.saldo : montoTotal;
                return balance > 0; // Solo mostrar documentos con saldo pendiente
            })
            .map((d: any) => {
                const montoTotal = d.mnt_total || d.monto_total || 0;
                const balance = d.saldo !== undefined && d.saldo !== null ? d.saldo : montoTotal;
                return {
                    id: d.id,
                    tipo: esAbono ? 'venta' : 'compra',
                    entidad: d.rzn_soc_recep || d.razon_social || "Desconocido",
                    fecha: d.fch_emis || d.fecha_emision,
                    monto: balance, // Importante: Mostrar Saldo como monto a conciliar
                    monto_total: montoTotal,
                    folio: d.folio,
                    estado: d.estado_deuda || d.estado_pago || "Pendiente",
                    conciliado: d.conciliado || false,
                    documento_relacionado: d
                };
            });
    };


    const toggleDocSelection = (doc: Coincidencia) => {
        setMultipleSelectedDocs(prev => {
            // Usamos == para permitir comparación de string vs number si fuera necesario
            const exists = prev.find(d => String(d.id) === String(doc.id) && d.tipo === doc.tipo);
            if (exists) {
                return prev.filter(d => !(String(d.id) === String(doc.id) && d.tipo === doc.tipo));
            } else {
                return [...prev, doc];
            }
        });
    };

    const totalSelectedAmount = useMemo(() => {
        return multipleSelectedDocs.reduce((sum, doc) => sum + doc.monto, 0);
    }, [multipleSelectedDocs]);

    const ejecutarConciliacionMultiple = async () => {
        if (!selectedMovimiento || multipleSelectedDocs.length === 0) return;

        const montoMovimiento = Math.abs(selectedMovimiento.cargos || selectedMovimiento.abonos || 0);
        const diff = Math.abs(totalSelectedAmount - montoMovimiento);

        if (diff > 5) { // Tolerancia de 5 pesos
            if (!confirm(`El monto total seleccionado (${fmtMoney(totalSelectedAmount)}) no coincide con el movimiento (${fmtMoney(montoMovimiento)}). ¿Deseas continuar de todas formas?`)) {
                return;
            }
        }

        if (!confirm(`¿Estás seguro de conciliar este movimiento con los ${multipleSelectedDocs.length} documentos seleccionados?`)) return;

        setLoading(true);
        try {
            // 1. Marcar movimiento como conciliado (tipo 'multiple')
            const { error: errMov } = await supabase
                .from("banco_movimientos")
                .update({
                    estado: "conciliado",
                    tipo_conciliacion: "multiple",
                    conciliado_id: multipleSelectedDocs[0].id // Guardamos el primero como referencia
                })
                .eq("id", selectedMovimiento.id);

            if (errMov) throw errMov;

            // 2. Actualizar documentos y registrar pagos
            let montoDisponible = montoMovimiento;

            for (const doc of multipleSelectedDocs) {
                if (montoDisponible <= 0) break;

                const docData = doc.documento_relacionado as any;
                const saldoActual = (docData.saldo !== undefined && docData.saldo !== null) ? Number(docData.saldo) : Number(doc.monto_total);

                // El abono para este doc es el mínimo entre su saldo y lo que queda del movimiento
                const montoAAbonar = Math.min(saldoActual, montoDisponible);
                const nuevoSaldo = Math.max(0, saldoActual - montoAAbonar);
                const esPagoTotal = nuevoSaldo <= 100;

                const updateDoc: any = {
                    conciliado: esPagoTotal,
                    saldo: esPagoTotal ? 0 : nuevoSaldo,
                };

                if (doc.tipo === 'venta') {
                    updateDoc.estado_deuda = esPagoTotal ? "Pagada" : "Parcial";
                    await supabase.from("ventas").update(updateDoc).eq("id", doc.id);
                    
                    await supabase.from("abonos").insert({
                        venta_id: doc.id,
                        monto_abono: montoAAbonar,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        tipo_abono: "Transferencia",
                        detalle_abono: `Conciliación Múltiple [Movimiento ID: ${selectedMovimiento.id}] - ${selectedMovimiento.descripcion}`
                    });
                } else {
                    updateDoc.estado_pago = esPagoTotal ? "Pagada" : "Parcial";
                    await supabase.from("compras").update(updateDoc).eq("id", doc.id);

                    await supabase.from("compras_abonos").insert({
                        compra_id: doc.id,
                        monto_abono: montoAAbonar,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        tipo_abono: "Transferencia",
                        detalle_abono: `Conciliación Múltiple [Movimiento ID: ${selectedMovimiento.id}] - ${selectedMovimiento.descripcion}`
                    }).catch(e => console.warn("Aviso: No se pudo registrar abono en compras:", e));
                }

                montoDisponible -= montoAAbonar;
            }

            setConciliarOpen(false);
            setMovimientos(prev => prev.map(m =>
                m.id === selectedMovimiento.id
                    ? { ...m, estado: "conciliado", tipo_conciliacion: "multiple", conciliado_id: multipleSelectedDocs[0].id }
                    : m
            ));

            // Populate cache with the first document's folio for reference
            if (multipleSelectedDocs.length > 0) {
                const firstDoc = multipleSelectedDocs[0];
                setFoliosCache(prev => ({
                    ...prev,
                    [`multiple:${firstDoc.id}`]: String(firstDoc.folio)
                }));
            }

            alert("¡Conciliación múltiple exitosa!");
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
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
            const docData = item.documento_relacionado as any;
            const montoMovimiento = Math.abs(selectedMovimiento.cargos || selectedMovimiento.abonos || 0);

            const saldoActual = (docData.saldo !== undefined && docData.saldo !== null) ? Number(docData.saldo) : Number(item.monto_total);
            let nuevoSaldo = saldoActual - montoMovimiento;
            if (nuevoSaldo < 0) nuevoSaldo = 0;

            const esPagoTotal = nuevoSaldo <= 100;
            const updateDoc: any = {
                conciliado: esPagoTotal,
                saldo: esPagoTotal ? 0 : nuevoSaldo,
                [item.tipo === "venta" ? "estado_deuda" : "estado_pago"]: esPagoTotal ? "Pagada" : "Parcial"
            };

            const { error: errDoc } = await supabase
                .from(item.tipo === "venta" ? "ventas" : "compras")
                .update(updateDoc)
                .eq("id", item.id);

            if (errDoc) throw errDoc;

            // 3. Record in 'abonos' or 'compras_abonos'
            const abonosTable = item.tipo === "venta" ? "abonos" : "compras_abonos";
            const foreignKey = item.tipo === "venta" ? "venta_id" : "compra_id";

            await supabase.from(abonosTable).insert({
                [foreignKey]: item.id,
                monto_abono: montoMovimiento,
                fecha_abono: new Date().toISOString().split("T")[0],
                tipo_abono: "Transferencia",
                detalle_abono: `Conciliación bancaria - Movimiento: ${selectedMovimiento.descripcion}`
            });

            // 4. UI Updates
            setConciliarOpen(false);

            // Update local list
            setMovimientos(prev => prev.map(m =>
                m.id === selectedMovimiento.id
                    ? { ...m, estado: "conciliado", tipo_conciliacion: item.tipo, conciliado_id: item.id }
                    : m
            ));

            // Populate cache immediately so the Folio is visible
            setFoliosCache(prev => ({
                ...prev,
                [`${item.tipo}:${item.id}`]: String(item.folio)
            }));

            setSelectedMovimiento(null);
            alert("¡Conciliación exitosa!");

        } catch (e: any) {
            alert("Error al conciliar: " + e.message);
        }
    };

    // --- DESHACER CONCILIACIÓN ---
    const deshacerConciliacion = async (mov: BancoMovimiento) => {
        if (!confirm(`¿Estás seguro de deshacer la conciliación de este movimiento?\n\nEsto lo marcará como pendiente nuevamente.`)) return;

        try {
            const montoMovimiento = Math.abs(mov.cargos || mov.abonos || 0);

            // NUEVO: Manejar múltiples documentos de abono relacionados
            if (mov.estado === 'conciliado' && mov.tipo_conciliacion !== 'manual') {
                const searchPatterns = [
                    `%Movimiento ID: ${mov.id}%`,
                    `%Movimiento: ${mov.descripcion}%`,
                    `% - ${mov.descripcion}%`
                ];

                const types = ['venta', 'compra'];
                for (const type of types) {
                    const tablaAbonos = (type === 'venta') ? 'abonos' : 'compras_abonos';
                    const tablaDocs = (type === 'venta') ? 'ventas' : 'compras';
                    const campoFK = (type === 'venta') ? 'venta_id' : 'compra_id';
                    const campoEstado = (type === 'venta') ? 'estado_deuda' : 'estado_pago';
                    const campoMontoTotal = (type === 'venta') ? 'mnt_total' : 'monto_total';

                    // 1. Encontrar los abonos registrados para este movimiento ID o descripción
                    const { data: abonosRelacionados } = await supabase.from(tablaAbonos)
                        .select(`*, ${tablaDocs}(*)`)
                        .or(searchPatterns.map(p => `detalle_abono.ilike.${p}`).join(','));

                    if (abonosRelacionados && abonosRelacionados.length > 0) {
                        for (const abono of abonosRelacionados) {
                            const doc = abono[tablaDocs];
                            if (!doc) continue;

                            const montoAReversar = Number(abono.monto_abono);
                            const saldoActual = Number(doc.saldo ?? 0);
                            const montoTotal = Number(doc[campoMontoTotal]);
                            const nuevoSaldo = Math.min(saldoActual + montoAReversar, montoTotal);

                            // Determinar nuevo estado
                            let nuevoEstado = (nuevoSaldo >= montoTotal - 100) ? 'Pendiente' : 'Parcial';

                            // 2. Restaurar saldo del documento
                            await supabase.from(tablaDocs).update({
                                [campoEstado]: nuevoEstado,
                                saldo: nuevoSaldo,
                                conciliado: false
                            }).eq('id', doc.id);

                            // 3. Eliminar el abono
                            await supabase.from(tablaAbonos).delete().eq('id', abono.id);
                        }
                    }
                }
            }

            // Si es conciliación manual, eliminar registro de conciliaciones_manuales
            if (mov.tipo_conciliacion === 'manual') {
                await supabase.from('conciliaciones_manuales')
                    .delete()
                    .eq('movimiento_id', mov.id);
            }

            // Revertir el movimiento bancario
            const { error } = await supabase.from("banco_movimientos")
                .update({
                    estado: "pendiente",
                    tipo_conciliacion: null,
                    conciliado_id: null
                })
                .eq("id", mov.id);

            if (error) throw error;

            // Actualizar lista local
            setMovimientos(prev => prev.map(m =>
                m.id === mov.id
                    ? { ...m, estado: "pendiente", tipo_conciliacion: undefined, conciliado_id: null }
                    : m
            ));

            alert("Conciliación deshecha. El movimiento está pendiente nuevamente.");

        } catch (e: any) {
            console.error("Error deshaciendo conciliación:", e);
            alert("Error al deshacer: " + e.message);
        }
    };

    // --- CONCILIACIÓN MANUAL (sin factura) ---
    const handleConciliacionManual = async () => {
        if (!selectedMovimiento) return;
        if (!manualCategoria) {
            alert("Por favor selecciona una categoría");
            return;
        }

        setConciliandoManual(true);
        try {
            // 1. Update banco_movimientos - marcar como conciliado manual
            const { error: errMov } = await supabase
                .from("banco_movimientos")
                .update({
                    estado: "conciliado",
                    tipo_conciliacion: "manual",
                    tipo_gasto: manualCategoria
                })
                .eq("id", selectedMovimiento.id);

            if (errMov) throw errMov;

            // 2. Insert registro de auditoría
            const { error: errAudit } = await supabase
                .from("conciliaciones_manuales")
                .insert({
                    movimiento_id: selectedMovimiento.id,
                    categoria: manualCategoria,
                    detalle: manualDetalle || null,
                    referencia: manualReferencia || null
                });

            if (errAudit) {
                console.warn("Advertencia: No se pudo registrar auditoría:", errAudit.message);
                // No lanzamos error, la conciliación ya se hizo
            }

            // 3. UI Updates
            setMovimientos(prev => prev.map(m =>
                m.id === selectedMovimiento.id
                    ? { ...m, estado: "conciliado", tipo_conciliacion: "manual", tipo_gasto: manualCategoria }
                    : m
            ));

            // Limpiar formulario
            setManualCategoria("");
            setManualDetalle("");
            setManualReferencia("");
            setMatchTab("sugerencias");
            setConciliarOpen(false);
            setSelectedMovimiento(null);

            alert("✅ Movimiento conciliado manualmente");

        } catch (e: any) {
            alert("Error al conciliar manualmente: " + e.message);
        } finally {
            setConciliandoManual(false);
        }
    };

    const handlePreconciliacion = async () => {
        if (!selectedPeriod || movimientos.length === 0) return;

        setIsPreconciliating(true);
        const movimientosPendientes = movimientos.filter(m => m.estado === 'pendiente');
        const encontradas: { mov: BancoMovimiento; match: Coincidencia }[] = [];

        try {
            // Buscamos coincidencias para cada movimiento pendiente
            for (const mov of movimientosPendientes) {
                const esAbono = mov.abonos > 0;
                const montoBuscado = esAbono ? mov.abonos : mov.cargos;

                // Usar funciones helper externas (ya no redefinidas en cada iteración)
                const rutBuscado = cleanRut(mov.bci_rut);
                const rutSinDV = rutBuscado?.split('-')[0];

                const foliosPossible = Array.from(new Set([
                    ...extractFolios(mov.bci_comentario_transferencia),
                    ...extractFolios(mov.descripcion)
                ]));

                let candidate: Coincidencia | null = null;
                let matchType: 'folio_monto' | 'rut_monto' | 'monto_unico' = 'monto_unico';

                if (esAbono) {
                    // ========== VENTAS ==========
                    // 1. Intentar por Folio + Monto (Muy Seguro) - EXCLUIR YA PAGADAS
                    if (foliosPossible.length > 0) {
                        const { data: fMatch } = await supabase.from("ventas")
                            .select("*")
                            .in("folio", foliosPossible)
                            .neq("estado_deuda", "Pagada")
                            .limit(10);

                        if (fMatch) {
                            const exactMatch = fMatch.find(v => {
                                const balance = v.saldo !== undefined && v.saldo !== null ? v.saldo : v.mnt_total;
                                return Math.abs(balance - montoBuscado) <= TOLERANCIA_MONTO;
                            });

                            if (exactMatch) {
                                const v = exactMatch;
                                matchType = 'folio_monto';
                                const balance = v.saldo !== undefined && v.saldo !== null ? v.saldo : v.mnt_total;
                                const scoring = calculateMatchScore(matchType, mov.fecha, v.fch_emis, montoBuscado, balance);
                                candidate = {
                                    id: v.id, tipo: 'venta', entidad: v.rzn_soc_recep || "Desconocido",
                                    fecha: v.fch_emis, monto: balance, monto_total: v.mnt_total, folio: v.folio,
                                    estado: v.estado_deuda || "Pendiente", documento_relacionado: v,
                                    score: scoring.score, matchReason: scoring.reason
                                };
                            }
                        }
                    }

                    // 2. Intentar por RUT + Monto (Seguro)
                    if (!candidate && (rutBuscado || rutSinDV)) {
                        let query = supabase.from("ventas").select("*")
                            .eq("conciliado", false); // Solo no bancarizadas

                        if (rutBuscado) {
                            query = query.or(`rut_recep.eq.${rutBuscado},rut_recep.ilike.%${rutSinDV}%`);
                        }

                        const { data: rMatch } = await query.limit(50);
                        if (rMatch) {
                            const exactMatch = rMatch.find(v => {
                                const balance = v.saldo !== undefined && v.saldo !== null ? v.saldo : v.mnt_total;
                                return Math.abs(balance - montoBuscado) <= TOLERANCIA_MONTO;
                            });

                            if (exactMatch) {
                                const v = exactMatch;
                                matchType = 'rut_monto';
                                const balance = v.saldo !== undefined && v.saldo !== null ? v.saldo : v.mnt_total;
                                const scoring = calculateMatchScore(matchType, mov.fecha, v.fch_emis, montoBuscado, balance);
                                candidate = {
                                    id: v.id, tipo: 'venta', entidad: v.rzn_soc_recep || "Desconocido",
                                    fecha: v.fch_emis, monto: balance, monto_total: v.mnt_total, folio: v.folio,
                                    estado: v.estado_deuda || "Pendiente", documento_relacionado: v,
                                    score: scoring.score, matchReason: scoring.reason
                                };
                            }
                        }
                    }

                    // 3. Intentar solo por Monto (Si es único)
                    if (!candidate) {
                        const { data: mMatch } = await supabase.from("ventas")
                            .select("*")
                            .eq("conciliado", false) // Solo no bancarizadas
                            .limit(100);

                        if (mMatch) {
                            const matchingDocs = mMatch.filter(v => {
                                const balance = v.saldo !== undefined && v.saldo !== null ? v.saldo : v.mnt_total;
                                return Math.abs(balance - montoBuscado) <= TOLERANCIA_MONTO;
                            });

                            if (matchingDocs.length === 1) {
                                const v = matchingDocs[0];
                                matchType = 'monto_unico';
                                const balance = v.saldo !== undefined && v.saldo !== null ? v.saldo : v.mnt_total;
                                const scoring = calculateMatchScore(matchType, mov.fecha, v.fch_emis, montoBuscado, balance);
                                candidate = {
                                    id: v.id, tipo: 'venta', entidad: v.rzn_soc_recep || "Desconocido",
                                    fecha: v.fch_emis, monto: balance, monto_total: v.mnt_total, folio: v.folio,
                                    estado: v.estado_deuda || "Pendiente", documento_relacionado: v,
                                    score: scoring.score, matchReason: scoring.reason
                                };
                            }
                        }
                    }
                } else {
                    // ========== COMPRAS ==========
                    // 1. Folio + Monto (Matching against Balance)
                    if (foliosPossible.length > 0) {
                        const { data: fMatch } = await supabase.from("compras")
                            .select("*")
                            .eq("conciliado", false)
                            .in("folio", foliosPossible)
                            .limit(10); // Check multiple if needed

                        if (fMatch) {
                            const exactMatch = fMatch.find(c => {
                                const balance = c.saldo !== undefined && c.saldo !== null ? c.saldo : c.monto_total;
                                return Math.abs(balance - montoBuscado) <= TOLERANCIA_MONTO;
                            });

                            if (exactMatch) {
                                const c = exactMatch;
                                matchType = 'folio_monto';
                                const balance = c.saldo !== undefined && c.saldo !== null ? c.saldo : c.monto_total;
                                const scoring = calculateMatchScore(matchType, mov.fecha, c.fecha_emision, montoBuscado, balance);
                                candidate = {
                                    id: c.id, tipo: 'compra', entidad: c.razon_social || "Desconocido",
                                    fecha: c.fecha_emision, monto: balance, monto_total: c.monto_total, folio: c.folio,
                                    estado: c.estado_pago || "Pendiente", documento_relacionado: c,
                                    score: scoring.score, matchReason: scoring.reason
                                };
                            }
                        }
                    }

                    // 2. RUT + Monto (Matching against Balance)
                    if (!candidate && (rutBuscado || rutSinDV)) {
                        let query = supabase.from("compras").select("*")
                            .eq("conciliado", false);

                        if (rutBuscado) {
                            query = query.or(`rut_proveedor.eq.${rutBuscado},rut_proveedor.ilike.%${rutSinDV}%`);
                        }

                        const { data: rMatch } = await query.limit(50);
                        if (rMatch) {
                            const exactMatch = rMatch.find(c => {
                                const balance = c.saldo !== undefined && c.saldo !== null ? c.saldo : c.monto_total;
                                return Math.abs(balance - montoBuscado) <= TOLERANCIA_MONTO;
                            });

                            if (exactMatch) {
                                const c = exactMatch;
                                matchType = 'rut_monto';
                                const balance = c.saldo !== undefined && c.saldo !== null ? c.saldo : c.monto_total;
                                const scoring = calculateMatchScore(matchType, mov.fecha, c.fecha_emision, montoBuscado, balance);
                                candidate = {
                                    id: c.id, tipo: 'compra', entidad: c.razon_social || "Desconocido",
                                    fecha: c.fecha_emision, monto: balance, monto_total: c.monto_total, folio: c.folio,
                                    estado: c.estado_pago || "Pendiente", documento_relacionado: c,
                                    score: scoring.score, matchReason: scoring.reason
                                };
                            }
                        }
                    }

                    // 3. Monto (Matching against Balance)
                    if (!candidate) {
                        const { data: mMatch } = await supabase.from("compras")
                            .select("*")
                            .eq("conciliado", false)
                            .limit(100);

                        if (mMatch) {
                            const matchingDocs = mMatch.filter(c => {
                                const balance = c.saldo !== undefined && c.saldo !== null ? c.saldo : c.monto_total;
                                return Math.abs(balance - montoBuscado) <= TOLERANCIA_MONTO;
                            });

                            if (matchingDocs.length === 1) {
                                const c = matchingDocs[0];
                                matchType = 'monto_unico';
                                const balance = c.saldo !== undefined && c.saldo !== null ? c.saldo : c.monto_total;
                                const scoring = calculateMatchScore(matchType, mov.fecha, c.fecha_emision, montoBuscado, balance);
                                candidate = {
                                    id: c.id, tipo: 'compra', entidad: c.razon_social || "Desconocido",
                                    fecha: c.fecha_emision, monto: balance, monto_total: c.monto_total, folio: c.folio,
                                    estado: c.estado_pago || "Pendiente", documento_relacionado: c,
                                    score: scoring.score, matchReason: scoring.reason
                                };
                            }
                        }
                    }
                }

                if (candidate) {
                    encontradas.push({ mov, match: candidate });
                }
            }

            // Ordenar por score de confianza (mayor primero)
            encontradas.sort((a, b) => (b.match.score || 0) - (a.match.score || 0));

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
            const docData = item.documento_relacionado as any;
            const montoMovimiento = Math.abs(mov.cargos || mov.abonos || 0);

            const saldoActual = (docData.saldo !== undefined && docData.saldo !== null) ? Number(docData.saldo) : Number(item.monto_total);
            let nuevoSaldo = saldoActual - montoMovimiento;
            if (nuevoSaldo < 0) nuevoSaldo = 0;

            const esPagoTotal = nuevoSaldo <= 100;
            const updateDoc: any = {
                conciliado: esPagoTotal,
                saldo: esPagoTotal ? 0 : nuevoSaldo,
                [item.tipo === "venta" ? "estado_deuda" : "estado_pago"]: esPagoTotal ? "Pagada" : "Parcial"
            };

            const { error: errDoc } = await supabase
                .from(item.tipo === "venta" ? "ventas" : "compras")
                .update(updateDoc)
                .eq("id", item.id);

            if (errDoc) {
                console.error(`Error actualizando documento ${item.id}:`, errDoc);
                throw errDoc;
            }

            // 3. Registrar Abono
            const abonosTable = item.tipo === "venta" ? "abonos" : "compras_abonos";
            const foreignKey = item.tipo === "venta" ? "venta_id" : "compra_id";

            const { error: errAbono } = await supabase.from(abonosTable).insert({
                [foreignKey]: item.id,
                monto_abono: montoMovimiento,
                fecha_abono: new Date().toISOString().split("T")[0],
                tipo_abono: "Transferencia",
                detalle_abono: `Conciliación Específica - Movimiento: ${mov.descripcion}`
            });

            if (errAbono) {
                console.error(`Error insertando abono para ${item.tipo} ${item.id}:`, errAbono);
                // No lanzamos error para no revertir lo ya hecho, pero avisamos
                alert(`Advertencia: El movimiento se concilió pero no se pudo registrar el detalle del pago: ${errAbono.message}`);
            }

            // Actualizar estado local
            setMovimientos(prev => prev.map(m =>
                m.id === mov.id
                    ? { ...m, estado: "conciliado", tipo_conciliacion: item.tipo, conciliado_id: item.id, preconciliado_match: null }
                    : m
            ));

            // Populate cache immediately
            setFoliosCache(prev => ({
                ...prev,
                [`${item.tipo}:${item.id}`]: String(item.folio)
            }));

            alert("¡Conciliado exitosamente!");
        } catch (e: any) {
            console.error("Error conciliando:", e);
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const ejecutarPreconciliacionesEnLote = async () => {
        if (preconciliacionesEncontradas.length === 0) return;

        if (!confirm(`¿Estás seguro de conciliar automáticamente los ${preconciliacionesEncontradas.length} movimientos encontrados?`)) return;

        setLoading(true);
        let exitosos = 0;
        let errores = 0;

        try {
            for (const item of preconciliacionesEncontradas) {
                try {
                    const { mov, match } = item;

                    // 1. Actualizar Movimiento Bancario
                    const { error: errMov } = await supabase
                        .from("banco_movimientos")
                        .update({
                            estado: "conciliado",
                            tipo_conciliacion: match.tipo,
                            conciliado_id: match.id
                        })
                        .eq("id", mov.id);

                    if (errMov) throw errMov;

                    // 2. Actualizar Registro Relacionado (Venta o Compra)
                    const docData = match.documento_relacionado as any;
                    const montoMovimiento = Math.abs(mov.cargos || mov.abonos || 0);

                    const saldoActual = (docData.saldo !== undefined && docData.saldo !== null) ? Number(docData.saldo) : Number(match.monto_total);
                    let nuevoSaldo = saldoActual - montoMovimiento;
                    if (nuevoSaldo < 0) nuevoSaldo = 0;

                    const esPagoTotal = nuevoSaldo <= 100;
                    const updateDoc: any = {
                        conciliado: esPagoTotal,
                        saldo: esPagoTotal ? 0 : nuevoSaldo,
                        [match.tipo === "venta" ? "estado_deuda" : "estado_pago"]: esPagoTotal ? "Pagada" : "Parcial"
                    };

                    const { error: errDoc } = await supabase
                        .from(match.tipo === "venta" ? "ventas" : "compras")
                        .update(updateDoc)
                        .eq("id", match.id);

                    if (errDoc) {
                        console.error(`Error actualizando documento ${match.id} en lote:`, errDoc);
                        throw errDoc;
                    }

                    // 3. Registrar Abono
                    const abonosTable = match.tipo === "venta" ? "abonos" : "compras_abonos";
                    const foreignKey = match.tipo === "venta" ? "venta_id" : "compra_id";

                    const { error: errAbono } = await supabase.from(abonosTable).insert({
                        [foreignKey]: match.id,
                        monto_abono: montoMovimiento,
                        fecha_abono: new Date().toISOString().split("T")[0],
                        tipo_abono: "Transferencia",
                        detalle_abono: `Conciliación Lote - Movimiento: ${mov.descripcion}`
                    });

                    if (errAbono) {
                        console.warn(`Error insertando abono para ${match.tipo} ${match.id} en lote:`, errAbono);
                    }
                    exitosos++;
                } catch (err) {
                    console.error("Error conciliando item en lote:", err);
                    errores++;
                }
            }

            setPreconciliacionOpen(false);
            // Recargar movimientos para ver cambios reales de la base de datos
            if (selectedPeriod) await cargarMovimientos(selectedPeriod, currentPage);

            alert(`Proceso terminado.\nÉxito: ${exitosos}\nErrores: ${errores}`);

        } catch (e: any) {
            console.error("Error crítico en lote:", e);
            alert("Error crítico: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Los movimientos ya vienen filtrados desde el servidor (Supabase)
    const movimientosFiltrados = useMemo(() => {
        return movimientos;
    }, [movimientos]);

    const getFolioFromCache = (mov: BancoMovimiento) => {
        if (!mov.conciliado_id) return "-";
        
        const key = `${mov.tipo_conciliacion || 'venta'}:${mov.conciliado_id}`;
        const folio = foliosCache[key];
        
        // Si ya está en el caché, lo devolvemos
        if (folio) {
            if (mov.tipo_conciliacion === 'multiple') {
                return `Múltiple (ex: ${folio})`;
            }
            return folio;
        }

        // FALLBACK INTELIGENTE (Mapping): Si no está en el caché, intentamos extraerlo de la glosa/comentarios
        // que vienen directamente del banco, tal como sugiere el usuario ("Factura 3420" en la descripción).
        const textToSearch = `${mov.descripcion} ${mov.bci_glosa_detalle || ''} ${mov.bci_comentario_transferencia || ''} ${mov.numero_documento || ''}`;
        
        // Regex para buscar "Factura [numero]", "Factura N° [numero]", etc.
        const matches = textToSearch.match(/Factura\s*N?°?\s*(\d+)/i) || 
                       textToSearch.match(/Factura\s*(\d+)/i) ||
                       textToSearch.match(/Folio\s*(\d+)/i) ||
                       textToSearch.match(/DTE\s*(\d+)/i);
        
        if (matches && matches[1]) {
            return matches[1];
        }

        // Si falló la extracción y no está en caché, mostramos el ID como último recurso
        return `#${mov.conciliado_id}`;
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
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-mono font-normal">v1.2-fixed-v2</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <select
                            className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                        >
                            <option value="__ALL__">📋 Mostrar todos</option>
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
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar o filtrar: conciliado, pendiente..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            <span className="text-sm text-gray-500">
                                {movimientosFiltrados.length} de {movimientos.length}
                            </span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-100 dark:bg-gray-800">
                            <TableRow>
                                <TableHead className="w-[5ch]">ID</TableHead>
                                <TableHead className="w-[100px]">Fecha</TableHead>
                                <TableHead className="min-w-[250px]">Descripción</TableHead>
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
                                    <TableCell colSpan={9} className="text-center py-10">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                                        <p className="mt-2 text-gray-500">Cargando movimientos...</p>
                                    </TableCell>
                                </TableRow>
                            ) : movimientosFiltrados.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                                        {searchQuery ? "No hay movimientos que coincidan con la búsqueda" : selectedPeriod ? "Este período no tiene movimientos" : "Sube una cartola para comenzar"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movimientosFiltrados.map((mov) => (
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
                                        <TableCell className="text-xs text-gray-400 font-mono">{mov.id}</TableCell>
                                        <TableCell className="font-medium whitespace-nowrap">{mov.fecha}</TableCell>
                                        <TableCell className="whitespace-normal break-words py-4 leading-relaxed min-w-[250px]">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-gray-900 dark:text-gray-100">{mov.descripcion}</span>
                                                {mov.bci_nombre && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                        <span className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">{mov.bci_rut}</span>
                                                        <span className="font-medium">{mov.bci_nombre}</span>
                                                    </div>
                                                )}
                                                {mov.bci_comentario_transferencia && (
                                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full w-fit italic">
                                                        "{mov.bci_comentario_transferencia}"
                                                    </span>
                                                )}
                                            </div>
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
                                                <Badge variant="default" className="bg-green-600 text-white hover:bg-green-700 border-none">
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
                                            <div className="flex justify-center gap-1">
                                                {mov.estado !== 'conciliado' ? (
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleConciliarClick(mov)}>
                                                        <Search className="h-4 w-4 text-indigo-600" />
                                                    </Button>
                                                ) : (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                <Info className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-96 p-0" align="end" sideOffset={5}>
                                                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-t-lg">
                                                                <h4 className="font-semibold flex items-center gap-2 text-base">
                                                                    <FileText className="h-5 w-5" />
                                                                    Detalle de Conciliación
                                                                </h4>
                                                                <p className="text-blue-100 text-xs mt-1">Información del movimiento conciliado</p>
                                                            </div>
                                                            <div className="p-5 space-y-4 bg-white dark:bg-gray-900">
                                                                {/* Descripción */}
                                                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                                                                        {mov.descripcion}
                                                                    </p>
                                                                </div>

                                                                {/* Grid de información */}
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <Calendar className="h-4 w-4 text-gray-400" />
                                                                        <div>
                                                                            <span className="text-gray-500 text-xs block">Fecha</span>
                                                                            <span className="font-medium text-gray-900 dark:text-gray-100">{mov.fecha}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <DollarSign className="h-4 w-4 text-gray-400" />
                                                                        <div>
                                                                            <span className="text-gray-500 text-xs block">Monto</span>
                                                                            <span className={`font-bold ${mov.cargos > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                                {fmtMoney(mov.cargos || mov.abonos)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <Link className="h-4 w-4 text-gray-400" />
                                                                            <span className="text-gray-500">Tipo de conciliación:</span>
                                                                        </div>
                                                                        <Badge variant="outline" className="text-sm">
                                                                            {mov.tipo_conciliacion === 'venta' ? '📈 Venta' :
                                                                                mov.tipo_conciliacion === 'compra' ? '📦 Compra' :
                                                                                    mov.tipo_conciliacion === 'manual' ? '✏️ Manual' :
                                                                                        '🔄 Automático'}
                                                                        </Badge>
                                                                    </div>
                                                                    {mov.conciliado_id && (
                                                                        <div className="flex items-center justify-between text-sm">
                                                                            <span className="text-gray-500">Folio:</span>
                                                                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-indigo-600 dark:text-indigo-400">
                                                                                {getFolioFromCache(mov)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {mov.tipo_gasto && (
                                                                        <div className="flex items-center justify-between text-sm">
                                                                            <span className="text-gray-500">Categoría:</span>
                                                                            <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                                                                {mov.tipo_gasto}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Botón Deshacer */}
                                                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-900/20"
                                                                        onClick={() => deshacerConciliacion(mov)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        Deshacer Conciliación
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Paginación */}
            {!loading && totalRecords > ITEMS_PER_PAGE && (
                <div className="px-6 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Página <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> de <span className="font-semibold text-gray-900 dark:text-white">{Math.ceil(totalRecords / ITEMS_PER_PAGE)}</span>
                        <span className="ml-2">({totalRecords} movimientos)</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage === 1}
                            className="text-gray-600 dark:text-gray-300"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentPage(prev => Math.min(Math.ceil(totalRecords / ITEMS_PER_PAGE), prev + 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage >= Math.ceil(totalRecords / ITEMS_PER_PAGE)}
                            className="text-gray-600 dark:text-gray-300"
                        >
                            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

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

                            {/* Tabs para tipo de conciliación */}
                            <Tabs value={matchTab} onValueChange={(val) => {
                                setMatchTab(val);
                                if (val === "multiple" && allUnreconciledDocs.length === 0) {
                                    cargarTodosLosDocumentosPendientes(selectedMovimiento);
                                }
                            }} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-4">
                                    <TabsTrigger value="sugerencias" className="text-sm">
                                        📄 Sugerencias
                                    </TabsTrigger>
                                    <TabsTrigger value="multiple" className="text-sm">
                                        ✅ Selección Múltiple
                                    </TabsTrigger>
                                    <TabsTrigger value="manual" className="text-sm">
                                        ✏️ Conciliar Manual
                                    </TabsTrigger>
                                </TabsList>

                                {/* Tab: Buscar Documento (existente) */}
                                <TabsContent value="sugerencias" className="space-y-4">
                                    {searchingMatch ? (
                                        <div className="text-center py-6">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Buscando documentos relacionados...</p>
                                        </div>
                                    ) : coincidencias.length > 0 ? (
                                        <div className="space-y-2">
                                            {multipleSelectedDocs.length > 0 && (
                                                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 mb-2">
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Selección para conciliación múltiple</p>
                                                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                                            {fmtMoney(totalSelectedAmount)} • {multipleSelectedDocs.length} docs
                                                        </p>
                                                    </div>
                                                    <Button size="sm" onClick={ejecutarConciliacionMultiple}>
                                                        Conciliar Selección
                                                    </Button>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium pb-1 border-b border-gray-100 dark:border-gray-800">
                                                Ordenado por relevancia • {coincidencias.length} resultado{coincidencias.length !== 1 ? 's' : ''}
                                            </p>

                                            {/* Scrollable Container */}
                                            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                                {coincidencias.map((item) => {
                                                    const isSelected = multipleSelectedDocs.some(d => d.id === item.id && d.tipo === item.tipo);
                                                    return (
                                                        <div
                                                            key={`${item.tipo}-${item.id}`}
                                                            className={`flex items-center justify-between p-3 border rounded-md transition-colors cursor-pointer border-l-4 shadow-sm ${isSelected
                                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40'
                                                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-indigo-400'
                                                                }`}
                                                            onClick={(e) => {
                                                                // Si hacen clic en el botón de Conciliar, no togglee la selección
                                                                if ((e.target as HTMLElement).closest('button')) return;
                                                                toggleDocSelection(item);
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => toggleDocSelection(item)}
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <Badge variant="secondary" className="uppercase text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-none">{item.tipo}</Badge>
                                                                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Folio {item.folio}</span>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={`text-[10px] ${item.estado === 'Pagada' ? 'text-green-600 border-green-200 bg-green-50' : 'text-yellow-600 border-yellow-200 bg-yellow-50'}`}
                                                                        >
                                                                            {item.estado}
                                                                        </Badge>
                                                                        {item.score !== undefined && (
                                                                            <Badge
                                                                                className={`text-[9px] px-1.5 py-0.5 ${item.score >= 70
                                                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                                    : item.score >= 40
                                                                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                                    }`}
                                                                            >
                                                                                {item.score}% match
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.entidad}</p>
                                                                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.fecha}</p>
                                                                    {item.matchReason && (
                                                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 italic">
                                                                            📌 {item.matchReason}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex items-center gap-3 ml-4">
                                                                <div className="flex flex-col items-end">
                                                                    <div className="font-bold text-gray-900 dark:text-gray-100">{fmtMoney(item.monto)}</div>
                                                                    {item.monto_total > item.monto + 10 && (
                                                                        <div className="text-[10px] text-gray-400">de {fmtMoney(item.monto_total)}</div>
                                                                    )}
                                                                </div>
                                                                {!isSelected && (
                                                                    <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => ejecutarConciliacion(item)}>
                                                                        Conciliar
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-md bg-gray-50/50 dark:bg-gray-900/20">
                                            <Search className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                                            <p>No se encontraron coincidencias automáticas.</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                Prueba con <button onClick={() => setMatchTab("manual")} className="text-indigo-500 hover:underline font-medium">Conciliar Manual</button> si no es una factura.
                                            </p>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Tab: Selección Múltiple (NUEVO) */}
                                <TabsContent value="multiple" className="space-y-4">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                            <div>
                                                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Total Seleccionado</p>
                                                <p className={`text-xl font-bold ${Math.abs(totalSelectedAmount - Math.abs(selectedMovimiento.cargos || selectedMovimiento.abonos)) < 5 ? 'text-green-600' : 'text-indigo-600'}`}>
                                                    {fmtMoney(totalSelectedAmount)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-indigo-600 dark:text-indigo-400">Seleccionados: {multipleSelectedDocs.length}</p>
                                                <Button
                                                    size="sm"
                                                    disabled={multipleSelectedDocs.length === 0 || loading}
                                                    onClick={ejecutarConciliacionMultiple}
                                                    className="mt-1"
                                                >
                                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                                    Conciliar Selección
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por folio o entidad..."
                                                className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                                                value={multiSearchQuery}
                                                onChange={(e) => setMultiSearchQuery(e.target.value)}
                                            />
                                        </div>

                                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {loadingAllDocs ? (
                                                <div className="text-center py-10">
                                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                                                    <p className="text-sm text-gray-500 mt-2">Cargando documentos pendientes...</p>
                                                </div>
                                            ) : allUnreconciledDocs.length === 0 ? (
                                                <div className="text-center py-10 text-gray-500 text-sm border border-dashed rounded-lg bg-gray-50/50">
                                                    <AlertCircle className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                                    <p>No se encontraron otros documentos pendientes.</p>
                                                    <p className="text-xs text-gray-400 mt-1">Busca manualmente arriba o verifica si las facturas ya están conciliadas.</p>
                                                    <Button variant="link" size="sm" onClick={() => cargarTodosLosDocumentosPendientes(selectedMovimiento)} className="mt-2 text-indigo-500">
                                                        Recargar Lista
                                                    </Button>
                                                </div>
                                            ) : (
                                                allUnreconciledDocs
                                                    .filter(d =>
                                                        d.entidad.toLowerCase().includes(multiSearchQuery.toLowerCase()) ||
                                                        String(d.folio).includes(multiSearchQuery)
                                                    )
                                                    .map(doc => {
                                                        const isSelected = multipleSelectedDocs.some(d => d.id === doc.id && d.tipo === doc.tipo);
                                                        return (
                                                            <div
                                                                key={`${doc.tipo}-${doc.id}`}
                                                                className={`flex items-center gap-3 p-3 border rounded-md transition-colors cursor-pointer ${isSelected
                                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40'
                                                                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                                    }`}
                                                                onClick={() => toggleDocSelection(doc)}
                                                            >
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    // No necesitamos handler aquí porque el padre div ya tiene onClick
                                                                    onCheckedChange={() => { }}
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-sm">Folio {doc.folio}</span>
                                                                        <Badge variant="outline" className="text-[10px] uppercase py-0">{doc.tipo}</Badge>
                                                                        {doc.conciliado ? (
                                                                            <Badge variant="default" className="bg-emerald-500 text-white border-none text-[9px] px-1.5 py-0">
                                                                                <Check className="w-2 h-2 mr-1" /> CONCILIADA
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge variant="destructive" className="bg-rose-500 text-white border-none text-[9px] px-1.5 py-0">
                                                                                SIN BANCARIZAR
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{doc.entidad}</p>
                                                                    <p className="text-[10px] text-gray-400">{doc.fecha}</p>
                                                                </div>
                                                                <div className="font-bold text-sm">
                                                                    {fmtMoney(doc.monto)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Tab: Conciliar Manual (NUEVO) */}
                                <TabsContent value="manual" className="space-y-4">
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                        <p className="text-sm text-amber-800 dark:text-amber-300">
                                            💡 Usa esta opción para movimientos que <strong>no tienen factura</strong>: comisiones bancarias, impuestos, sueldos, servicios, etc.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Categoría */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Categoría <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                                                value={manualCategoria}
                                                onChange={(e) => setManualCategoria(e.target.value)}
                                            >
                                                <option value="">Selecciona una categoría...</option>
                                                {categorias.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Detalle */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Detalle / Justificación
                                            </label>
                                            <textarea
                                                className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none"
                                                rows={3}
                                                placeholder="Describe brevemente el motivo de este gasto o ingreso..."
                                                value={manualDetalle}
                                                onChange={(e) => setManualDetalle(e.target.value)}
                                            />
                                        </div>

                                        {/* Referencia */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Referencia externa (opcional)
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                                                placeholder="Nº boleta, voucher, recibo..."
                                                value={manualReferencia}
                                                onChange={(e) => setManualReferencia(e.target.value)}
                                            />
                                        </div>

                                        {/* Botón de acción */}
                                        <Button
                                            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                            onClick={handleConciliacionManual}
                                            disabled={!manualCategoria || conciliandoManual}
                                        >
                                            {conciliandoManual ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Procesando...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Conciliar Manualmente
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
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
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <p className={`text-sm font-bold ${item.mov.cargos > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {fmtMoney(item.mov.cargos || item.mov.abonos)}
                                            </p>
                                            {/* Score de Confianza */}
                                            {item.match.score !== undefined && (
                                                <Badge
                                                    className={`text-[9px] px-1.5 py-0.5 ${item.match.score >= 90
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : item.match.score >= 70
                                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                        }`}
                                                >
                                                    {item.match.score}% confianza
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded border border-indigo-100 dark:border-indigo-900/30">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">{item.match.tipo}</Badge>
                                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Folio {item.match.folio}</span>
                                        </div>
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">{item.match.entidad}</p>
                                    </div>
                                    {/* Motivo del Match */}
                                    {item.match.matchReason && (
                                        <p className="text-[10px] text-gray-400 mt-1 italic">
                                            📌 {item.match.matchReason}
                                        </p>
                                    )}
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
                            onClick={ejecutarPreconciliacionesEnLote}
                            disabled={loading || preconciliacionesEncontradas.length === 0}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Conciliar {preconciliacionesEncontradas.length} Movimientos
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* FLOATING VOICE AGENT UI */}
            <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-3">
                {agentResponse && (
                    <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 p-4 rounded-2xl shadow-2xl max-w-[280px] animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-indigo-500" />
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Ecomoving Agent</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">{agentResponse}</p>
                        {agentProcessing && (
                            <div className="mt-2 flex gap-1">
                                <div className="h-1 w-1 bg-indigo-500 rounded-full animate-bounce" />
                                <div className="h-1 w-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="h-1 w-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={toggleVoiceAgent}
                    className={`h-16 w-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isListening
                        ? 'bg-red-500 animate-pulse text-white'
                        : 'bg-indigo-600 text-white'
                        }`}
                >
                    {isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                    {isListening && (
                        <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-25" />
                    )}
                </button>
            </div>
        </div>
    );
}
