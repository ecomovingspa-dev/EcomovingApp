
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle2,
    AlertOctagon,
    AlertTriangle,
    Info,
    Clock,
    ChevronRight,
    LayoutDashboard,
    Mail,
    Trash2,
    PlusCircle,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReglaCobranza {
    id: number;
    nombre: string;
    etiqueta: string;
    dias_min: number;
    dias_max: number;
    asunto_template: string;
    mensaje_intro: string;
    mensaje_cierre: string;
    urgencia: string;
    activo: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ConfiguracionCobranza({ open, onOpenChange }: Props) {
    const [reglas, setReglas] = useState<ReglaCobranza[]>([]);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [selectedReglaId, setSelectedReglaId] = useState<number | null>(null);

    useEffect(() => {
        if (open) {
            cargarReglas();
        }
    }, [open]);

    const cargarReglas = async () => {
        setCargando(true);
        try {
            const { data, error } = await supabase
                .from("configuracion_cobranza")
                .select("*")
                .order("dias_min", { ascending: true });

            if (error) throw error;
            setReglas(data || []);
            if (data && data.length > 0) {
                setSelectedReglaId(data[0].id);
            }
        } catch (error) {
            console.error("Error cargando reglas:", error);
        } finally {
            setCargando(false);
        }
    };

    const handleUpdateRegla = (
        id: number,
        field: keyof ReglaCobranza,
        value: any
    ) => {
        setReglas((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleCrearRegla = async () => {
        const nuevaRegla = {
            nombre: `Nueva Regla ${reglas.length + 1}`,
            etiqueta: "Nueva Etapa",
            dias_min: 0,
            dias_max: 0,
            asunto_template: "Recordatorio de Pago {folio}",
            mensaje_intro: "Estimado cliente, le recordamos que su factura {folio} está pendiente.",
            mensaje_cierre: "Favor realizar el pago a la brevedad.",
            urgencia: "normal",
            activo: true
        };

        try {
            const { data, error } = await supabase
                .from("configuracion_cobranza")
                .insert(nuevaRegla)
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setReglas([...reglas, data]);
                setSelectedReglaId(data.id);
            }
        } catch (error: any) {
            console.error("Error creando regla:", error);
            alert("Error al crear regla: " + error.message);
        }
    };

    const handleEliminarRegla = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("¿Estás seguro de eliminar esta regla?")) return;

        try {
            const { error } = await supabase
                .from("configuracion_cobranza")
                .delete()
                .eq("id", id);

            if (error) throw error;

            const nuevasReglas = reglas.filter(r => r.id !== id);
            setReglas(nuevasReglas);
            if (selectedReglaId === id) {
                setSelectedReglaId(nuevasReglas[0]?.id || null);
            }
        } catch (error: any) {
            console.error("Error eliminando regla:", error);
            alert("Error al eliminar: " + error.message);
        }
    };

    const guardarCambios = async (regla: ReglaCobranza) => {
        setGuardando(true);
        try {
            const { error } = await supabase
                .from("configuracion_cobranza")
                .update({
                    etiqueta: regla.etiqueta,
                    urgencia: regla.urgencia,
                    activo: regla.activo,
                    asunto_template: regla.asunto_template,
                    mensaje_intro: regla.mensaje_intro,
                    mensaje_cierre: regla.mensaje_cierre,
                    dias_min: regla.dias_min,
                    dias_max: regla.dias_max,
                })
                .eq("id", regla.id);

            if (error) throw error;
            alert("Configuración guardada correctamente");
        } catch (error: any) {
            console.error("Error guardando:", error);
            alert("Error al guardar: " + error.message);
        } finally {
            setGuardando(false);
        }
    };

    const selectedRegla = reglas.find((r) => r.id === selectedReglaId);

    const getUrgenciaIcon = (urgencia: string) => {
        switch (urgencia) {
            case "normal": return <Info className="h-4 w-4 text-blue-400" />;
            case "media": return <Clock className="h-4 w-4 text-yellow-400" />;
            case "alta": return <AlertTriangle className="h-4 w-4 text-orange-400" />;
            case "critica": return <AlertOctagon className="h-4 w-4 text-red-500" />;
            default: return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden bg-white dark:bg-[#0f1117] border-gray-200 dark:border-gray-800 flex flex-col md:flex-row [&>button]:hidden">

                {/* SIDEBAR */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-[#161b22] border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-slate-900/20">
                            <LayoutDashboard className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Reglas de Cobro</h2>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Automatización</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCrearRegla}
                            className="ml-auto h-7 w-7 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                        >
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {cargando ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-gray-400" /></div>
                        ) : reglas.map((regla) => (
                            <div
                                key={regla.id}
                                onClick={() => setSelectedReglaId(regla.id)}
                                className={cn(
                                    "w-full text-left px-3 py-3 rounded-md text-xs font-medium transition-all flex items-center justify-between group outline-none focus:ring-2 focus:ring-slate-500/20 cursor-pointer",
                                    selectedReglaId === regla.id
                                        ? "bg-white dark:bg-[#1f2937] text-slate-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700 select-none"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {getUrgenciaIcon(regla.urgencia)}
                                    <span>{regla.etiqueta}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleEliminarRegla(regla.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                    {selectedReglaId === regla.id && <ChevronRight className="h-3 w-3 opacity-50" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0f1117]">
                    {selectedRegla ? (
                        <>
                            {/* Header Area */}
                            <div className="h-20 px-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-[#0f1117]/50 backdrop-blur-sm">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex flex-col gap-1 w-full max-w-[300px]">
                                        <Input
                                            value={selectedRegla.etiqueta}
                                            onChange={(e) => handleUpdateRegla(selectedRegla.id, "etiqueta", e.target.value)}
                                            className="h-9 font-bold text-lg bg-transparent border-none focus-visible:ring-1 focus-visible:ring-slate-500/30 p-0"
                                        />
                                        <div className="flex items-center gap-3">
                                            <Select
                                                value={selectedRegla.urgencia}
                                                onValueChange={(val) => handleUpdateRegla(selectedRegla.id, "urgencia", val)}
                                            >
                                                <SelectTrigger className="h-6 w-auto text-[10px] uppercase tracking-wider font-semibold border-none bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 p-0 pr-2 gap-2">
                                                    <SelectValue placeholder="Urgencia" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="normal">Normal</SelectItem>
                                                    <SelectItem value="media">Media</SelectItem>
                                                    <SelectItem value="alta">Alta</SelectItem>
                                                    <SelectItem value="critica">Crítica</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-800 pl-3">
                                                <span className="text-[10px] text-gray-400 font-medium">Estado:</span>
                                                <Switch
                                                    checked={selectedRegla.activo}
                                                    onCheckedChange={(val) => handleUpdateRegla(selectedRegla.id, "activo", val)}
                                                    className="scale-75"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form Content Scrollable */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-4xl mx-auto space-y-8">

                                    {/* Section 1: Triggers */}
                                    <div className="bg-gray-50/50 dark:bg-[#161b22]/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800/50">
                                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4 flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5" /> Configuracion de Plazos
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Día Inicio (Desde)</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        className="bg-white dark:bg-[#0d1117] border-gray-200 dark:border-gray-700 pl-3 h-9 text-sm"
                                                        value={selectedRegla.dias_min}
                                                        onChange={(e) => handleUpdateRegla(selectedRegla.id, "dias_min", parseInt(e.target.value))}
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400 pointer-events-none">días</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Día Fin (Hasta)</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        className="bg-white dark:bg-[#0d1117] border-gray-200 dark:border-gray-700 pl-3 h-9 text-sm"
                                                        value={selectedRegla.dias_max}
                                                        onChange={(e) => handleUpdateRegla(selectedRegla.id, "dias_max", parseInt(e.target.value))}
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400 pointer-events-none">días</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Email Content */}
                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4 flex items-center gap-2">
                                            <Mail className="h-3.5 w-3.5" /> Contenido del Correo
                                        </h3>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asunto</Label>
                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 bg-gray-50 dark:bg-gray-800/50 text-gray-400 font-normal border-gray-200 dark:border-gray-700">
                                                        Variables: {"{folio}"}, {"{dias}"}
                                                    </Badge>
                                                </div>
                                                <Input
                                                    className="bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 text-sm h-10 shadow-sm focus:border-slate-400 focus:ring-slate-400/20"
                                                    value={selectedRegla.asunto_template}
                                                    onChange={(e) => handleUpdateRegla(selectedRegla.id, "asunto_template", e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Parte 1: Introducción</Label>
                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 bg-gray-50 dark:bg-gray-800/50 text-gray-400 font-normal border-gray-200 dark:border-gray-700">
                                                        Variables: {"{folio}"}, {"{cliente}"}, {"{monto}"}, {"{dias}"}
                                                    </Badge>
                                                </div>
                                                <Textarea
                                                    className="min-h-[120px] bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 resize-none text-sm leading-relaxed p-3 shadow-sm focus:border-slate-400 focus:ring-slate-400/20"
                                                    placeholder="Escribe el saludo y el motivo del contacto..."
                                                    value={selectedRegla.mensaje_intro}
                                                    onChange={(e) => handleUpdateRegla(selectedRegla.id, "mensaje_intro", e.target.value)}
                                                />
                                            </div>

                                            {/* PREVIEW BLOCK (AUTOMATIC CONTENT) */}
                                            <div className="relative py-4">
                                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                    <div className="w-full border-t border-dashed border-gray-200 dark:border-gray-800"></div>
                                                </div>
                                                <div className="relative flex justify-center">
                                                    <span className="bg-gray-50 dark:bg-[#0f1117] px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contenido Automático</span>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                                                <div className="bg-[#0f172a] p-6 text-left border-b-4 border-blue-500">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-bold">Estado de Cuenta</p>
                                                    <p className="text-[9px] text-gray-500 font-medium mt-1 italic">Ecomoving SpA • Cobranzas</p>
                                                </div>
                                                <div className="p-6 space-y-6">
                                                    {/* Bloque Resumen Documento */}
                                                    <div className="bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-lg p-5">
                                                        <div className="border-l-4 border-blue-500 pl-3 mb-4">
                                                            <p className="text-[10px] text-slate-800 dark:text-slate-200 font-black uppercase tracking-wider">Resumen del Documento</p>
                                                        </div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                                                            <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-2">
                                                                <span>N° de Factura:</span>
                                                                <span className="font-bold text-slate-900 dark:text-slate-200">{selectedRegla.id}</span>
                                                            </div>
                                                            <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-2 pt-1">
                                                                <span>Emisión:</span>
                                                                <span className="font-bold text-slate-900 dark:text-slate-200">DD-MM-AAAA</span>
                                                            </div>
                                                            <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-2 pt-1">
                                                                <span>Vencimiento:</span>
                                                                <span className="font-bold text-red-500">DD-MM-AAAA</span>
                                                            </div>
                                                            <div className="flex justify-between pt-3">
                                                                <span className="font-medium">Monto Pendiente:</span>
                                                                <span className="text-lg font-black text-slate-900 dark:text-white">$ X.XXX.XXX</span>
                                                            </div>
                                                            <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="text-orange-600 dark:text-orange-400 font-bold uppercase">Situación:</span>
                                                                    <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded font-bold italic">Atraso de X días</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bloque Instrucciones de Pago */}
                                                    <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                                                        <div className="border-l-4 border-slate-800 dark:border-slate-400 pl-3 mb-4">
                                                            <p className="text-[10px] text-slate-800 dark:text-slate-200 font-black uppercase tracking-wider">Instrucciones de Pago</p>
                                                        </div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                                                            <div className="flex justify-between"><span>Banco:</span> <span className="font-bold text-slate-900 dark:text-slate-200">BCI</span></div>
                                                            <div className="flex justify-between"><span>Cuenta:</span> <span className="font-bold text-slate-900 dark:text-slate-200">13750780</span></div>
                                                            <div className="flex justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-2"><span>RUT:</span> <span className="font-bold text-slate-900 dark:text-slate-200">76.812.285-K</span></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative py-4">
                                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                    <div className="w-full border-t border-dashed border-gray-200 dark:border-gray-800"></div>
                                                </div>
                                                <div className="relative flex justify-center">
                                                    <span className="bg-gray-50 dark:bg-[#0f1117] px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fin de Contenido Automático</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Parte 2: Cierre</Label>
                                                <Textarea
                                                    className="min-h-[120px] bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 resize-none text-sm leading-relaxed p-3 shadow-sm focus:border-slate-400 focus:ring-slate-400/20"
                                                    placeholder="Escribe la despedida y llamado a la acción..."
                                                    value={selectedRegla.mensaje_cierre}
                                                    onChange={(e) => handleUpdateRegla(selectedRegla.id, "mensaje_cierre", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#0f1117]/50 backdrop-blur-md flex justify-between items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 px-4 text-xs font-bold border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-95"
                                    onClick={async () => {
                                        const email = window.prompt("Ingresa el correo para enviar la prueba:", "mario@ecomoving.cl");
                                        if (email && email.includes("@")) {
                                            try {
                                                const res = await fetch('/api/send-test-cobranza', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email, ruleId: selectedRegla.id })
                                                });
                                                if (res.ok) alert("✅ Correo de prueba enviado a " + email);
                                                else alert("❌ Error enviando prueba");
                                            } catch (e) {
                                                alert("Error de conexión");
                                            }
                                        }
                                    }}
                                >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Enviar Prueba
                                </Button>

                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={() => onOpenChange(false)}
                                        className="h-10 px-6 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={() => guardarCambios(selectedRegla)}
                                        disabled={guardando}
                                        className="h-10 px-8 text-xs font-bold bg-[#0f172a] hover:bg-[#1e293b] text-white border border-slate-800 shadow-xl shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {guardando ? (
                                            <>
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar Cambios"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                                <LayoutDashboard className="h-8 w-8 opacity-40" />
                            </div>
                            <p className="text-sm font-medium">Selecciona una regla para comenzar</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
