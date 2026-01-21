
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Loader2,
    Save,
    Wand2,
    AlertTriangle,
    CheckCircle2,
    AlertOctagon,
    Info,
    Clock,
    ChevronRight,
    LayoutDashboard,
    Mail,
    Zap,
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

    const guardarCambios = async (regla: ReglaCobranza) => {
        setGuardando(true);
        try {
            const { error } = await supabase
                .from("configuracion_cobranza")
                .update({
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
            default: return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden bg-white dark:bg-[#0f1117] border-gray-200 dark:border-gray-800 flex flex-col md:flex-row [&>button]:hidden">

                {/* SIDEBAR */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-[#161b22] border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                        <div className="h-8 w-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-900/20">
                            <LayoutDashboard className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Reglas de Cobro</h2>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Automatización</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {cargando ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-gray-400" /></div>
                        ) : reglas.map((regla) => (
                            <button
                                key={regla.id}
                                onClick={() => setSelectedReglaId(regla.id)}
                                className={cn(
                                    "w-full text-left px-3 py-3 rounded-md text-xs font-medium transition-all flex items-center justify-between group outline-none focus:ring-2 focus:ring-purple-500/20",
                                    selectedReglaId === regla.id
                                        ? "bg-white dark:bg-[#1f2937] text-purple-600 dark:text-purple-400 shadow-sm border border-gray-200 dark:border-gray-700 select-none"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {getUrgenciaIcon(regla.urgencia)}
                                    <span>{regla.etiqueta}</span>
                                </div>
                                {selectedReglaId === regla.id && <ChevronRight className="h-3 w-3 opacity-50" />}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161b22]">
                        <div className="flex items-center gap-2 justify-center opacity-40">
                            <Zap className="h-3 w-3" />
                            <span className="text-[10px] font-medium">Powered by Gemini AI</span>
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0f1117]">
                    {selectedRegla ? (
                        <>
                            {/* Header Area */}
                            <div className="h-16 px-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-[#0f1117]/50 backdrop-blur-sm">
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {selectedRegla.etiqueta}
                                        <span className={cn(
                                            "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold",
                                            selectedRegla.urgencia === 'critica' ? "border-red-800/30 text-red-500 bg-red-900/10" :
                                                selectedRegla.urgencia === 'alta' ? "border-orange-800/30 text-orange-500 bg-orange-900/10" :
                                                    selectedRegla.urgencia === 'media' ? "border-yellow-800/30 text-yellow-500 bg-yellow-900/10" :
                                                        "border-blue-800/30 text-blue-500 bg-blue-900/10"
                                        )}>
                                            {selectedRegla.urgencia}
                                        </span>
                                    </h1>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-8 text-xs font-medium text-purple-600 border-purple-200 dark:border-purple-800 dark:bg-purple-900/10 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                >
                                    <Wand2 className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Mejorar con IA</span>
                                </Button>
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
                                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asunto</Label>
                                                <Input
                                                    className="bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 text-sm h-10 shadow-sm"
                                                    value={selectedRegla.asunto_template}
                                                    onChange={(e) => handleUpdateRegla(selectedRegla.id, "asunto_template", e.target.value)}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Introducción</Label>
                                                    </div>
                                                    <Textarea
                                                        className="min-h-[140px] bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 resize-none text-sm leading-relaxed p-3 shadow-sm focus:ring-1 focus:ring-purple-500"
                                                        placeholder="Mensaje inicial..."
                                                        value={selectedRegla.mensaje_intro}
                                                        onChange={(e) => handleUpdateRegla(selectedRegla.id, "mensaje_intro", e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cierre</Label>
                                                    </div>
                                                    <Textarea
                                                        className="min-h-[140px] bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 resize-none text-sm leading-relaxed p-3 shadow-sm focus:ring-1 focus:ring-purple-500"
                                                        placeholder="Mensaje final..."
                                                        value={selectedRegla.mensaje_cierre}
                                                        onChange={(e) => handleUpdateRegla(selectedRegla.id, "mensaje_cierre", e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f1117] flex justify-between items-center gap-3 z-10">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-9 border-dashed border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800"
                                        onClick={async () => {
                                            const email = window.prompt("Ingresa el correo para enviar la prueba:", "mario@ecomoving.cl");
                                            if (email && email.includes("@")) {
                                                try {
                                                    // Assuming the API is deployed at /api/send-test-cobranza
                                                    // For local dev, we might need full URL, but relative usually works with Vite proxy or Vercel
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
                                        <Mail className="h-3.5 w-3.5 mr-2" />
                                        Enviar Prueba
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={() => guardarCambios(selectedRegla)}
                                        disabled={guardando}
                                        className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px] shadow-lg shadow-purple-900/20"
                                    >
                                        {guardando ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Guardar Cambios
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
