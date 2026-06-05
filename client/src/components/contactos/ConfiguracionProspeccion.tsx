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
import {
    ChevronRight,
    LayoutDashboard,
    Mail,
    Trash2,
    PlusCircle,
    Loader2,
    Search,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EtapaProspeccion {
    id: number;
    nombre: string;
    etiqueta: string;
    orden: number;
    dias_espera: number;
    asunto_template: string;
    mensaje_intro: string;
    mensaje_cierre: string;
    activo: boolean;
    imagen_url?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ConfiguracionProspeccion({ open, onOpenChange }: Props) {
    const [etapas, setEtapas] = useState<EtapaProspeccion[]>([]);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [enviandoPrueba, setEnviandoPrueba] = useState(false);

    useEffect(() => {
        if (open) cargarEtapas();
    }, [open]);

    const cargarEtapas = async () => {
        setCargando(true);
        try {
            const { data, error } = await supabase
                .from("configuracion_prospeccion")
                .select("*")
                .order("orden", { ascending: true });
            if (error) throw error;
            setEtapas(data || []);
            if (data && data.length > 0) setSelectedId(data[0].id);
        } catch (err) {
            console.error("Error cargando etapas:", err);
        } finally {
            setCargando(false);
        }
    };

    const handleUpdate = (id: number, field: keyof EtapaProspeccion, value: any) => {
        setEtapas(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const handleCrear = async () => {
        const maxOrden = etapas.length > 0 ? Math.max(...etapas.map(e => e.orden)) : 0;
        const nuevaEtapa = {
            nombre: `etapa_${maxOrden + 1}`,
            etiqueta: `Etapa ${maxOrden + 1}`,
            orden: maxOrden + 1,
            dias_espera: 5,
            asunto_template: "Consulta para {empresa}",
            mensaje_intro: "Estimado equipo de {empresa}, nos comunicamos desde Ecomoving SpA.",
            mensaje_cierre: "Quedamos atentos a su respuesta. Saludos cordiales.",
            activo: true,
        };
        try {
            const { data, error } = await supabase
                .from("configuracion_prospeccion")
                .insert(nuevaEtapa)
                .select()
                .single();
            if (error) throw error;
            if (data) {
                setEtapas([...etapas, data]);
                setSelectedId(data.id);
            }
        } catch (err: any) {
            alert("Error al crear etapa: " + err.message);
        }
    };

    const handleEliminar = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("¿Estás seguro de eliminar esta etapa?")) return;
        try {
            const { error } = await supabase
                .from("configuracion_prospeccion")
                .delete()
                .eq("id", id);
            if (error) throw error;

            const restantes = etapas.filter(e => e.id !== id);
            // Re-index remaining stages sequentially
            const reindexed = restantes.map((etapa, idx) => ({
                ...etapa,
                orden: idx + 1
            }));

            // Save updated orders
            await Promise.all(reindexed.map(etapa =>
                supabase
                    .from("configuracion_prospeccion")
                    .update({ orden: etapa.orden })
                    .eq("id", etapa.id)
            ));

            setEtapas(reindexed);
            setSelectedId(reindexed[0]?.id || null);
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    const handleReorder = async (id: number, direction: 'up' | 'down') => {
        const index = etapas.findIndex(e => e.id === id);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === etapas.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const newEtapas = [...etapas];

        // Swap their orders in the state
        const temp = newEtapas[index].orden;
        newEtapas[index].orden = newEtapas[targetIndex].orden;
        newEtapas[targetIndex].orden = temp;

        // Sort by order
        newEtapas.sort((a, b) => a.orden - b.orden);

        // Update sequential orden values to ensure they are 1, 2, 3...
        const updatedEtapas = newEtapas.map((etapa, idx) => ({
            ...etapa,
            orden: idx + 1
        }));

        setEtapas(updatedEtapas);

        // Save new order to database for all affected stages
        try {
            await Promise.all(updatedEtapas.map(etapa => 
                supabase
                    .from("configuracion_prospeccion")
                    .update({ orden: etapa.orden })
                    .eq("id", etapa.id)
            ));
        } catch (err) {
            console.error("Error saving new order:", err);
        }
    };

    const insertVariable = (field: 'asunto_template' | 'mensaje_intro' | 'mensaje_cierre', variable: string) => {
        if (!selectedId || !selectedEtapa) return;
        const currentText = selectedEtapa[field] || '';
        const element = document.getElementById(field) as HTMLInputElement | HTMLTextAreaElement;
        if (element) {
            const start = element.selectionStart || 0;
            const end = element.selectionEnd || 0;
            const newText = currentText.substring(0, start) + variable + currentText.substring(end);
            handleUpdate(selectedId, field, newText);
            
            // Set focus back and selection
            setTimeout(() => {
                element.focus();
                element.setSelectionRange(start + variable.length, start + variable.length);
            }, 10);
        } else {
            // Fallback: append
            handleUpdate(selectedId, field, currentText + variable);
        }
    };

    const guardarCambios = async (etapa: EtapaProspeccion) => {
        setGuardando(true);
        try {
            const { error } = await supabase
                .from("configuracion_prospeccion")
                .update({
                    etiqueta: etapa.etiqueta,
                    orden: etapa.orden,
                    dias_espera: etapa.dias_espera,
                    activo: etapa.activo,
                    asunto_template: etapa.asunto_template,
                    mensaje_intro: etapa.mensaje_intro,
                    mensaje_cierre: etapa.mensaje_cierre,
                    imagen_url: etapa.imagen_url || "",
                })
                .eq("id", etapa.id);
            if (error) throw error;
            alert("✅ Plantilla guardada correctamente");
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setGuardando(false);
        }
    };

    const enviarPrueba = async (etapa: EtapaProspeccion) => {
        const email = window.prompt("Ingresa el correo para recibir la prueba:", "mario@ecomoving.cl");
        if (!email?.includes("@")) return;
        setEnviandoPrueba(true);
        try {
            const res = await fetch("/api/send-test-prospeccion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, etapaId: etapa.id }),
            });
            if (res.ok) alert(`✅ Correo de prueba enviado a ${email}`);
            else alert("❌ Error enviando prueba");
        } catch {
            alert("Error de conexión");
        } finally {
            setEnviandoPrueba(false);
        }
    };

    const selectedEtapa = etapas.find(e => e.id === selectedId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden bg-white dark:bg-[#0f1117] border-gray-200 dark:border-gray-800 flex flex-col md:flex-row [&>button]:hidden">

                {/* SIDEBAR */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-[#161b22] border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-violet-900 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/30">
                                <Search className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Prospección</h2>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">Plantillas de Correo</p>
                            </div>
                        </div>
                        <Button
                            onClick={handleCrear}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 rounded-full"
                            title="Agregar nueva etapa"
                        >
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>
 
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {cargando ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                            </div>
                        ) : etapas.map((etapa) => (
                            <div
                                key={etapa.id}
                                onClick={() => setSelectedId(etapa.id)}
                                className={cn(
                                    "w-full text-left px-2 py-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-between group outline-none cursor-pointer",
                                    selectedId === etapa.id
                                        ? "bg-white dark:bg-[#1f2937] text-violet-700 dark:text-violet-300 shadow-sm border border-violet-200 dark:border-violet-800"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                                )}
                            >
                                <div className="flex items-center gap-2 max-w-[55%] truncate">
                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-black shrink-0">
                                        {etapa.orden}
                                    </span>
                                    <span className="truncate">{etapa.etiqueta}</span>
                                    {!etapa.activo && (
                                        <span className="text-[9px] text-gray-400 italic shrink-0">off</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleReorder(etapa.id, 'up'); }}
                                        disabled={etapa.orden === 1}
                                        className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-20 rounded transition-colors"
                                        title="Subir etapa"
                                    >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleReorder(etapa.id, 'down'); }}
                                        disabled={etapa.orden === etapas.length}
                                        className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-20 rounded transition-colors"
                                        title="Bajar etapa"
                                    >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleEliminar(etapa.id, e)}
                                        className="h-6 w-6 flex items-center justify-center text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                        title="Eliminar etapa"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    {selectedId === etapa.id && <ChevronRight className="h-3 w-3 opacity-50 ml-0.5" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0f1117]">
                    {selectedEtapa ? (
                        <>
                            {/* Header */}
                            <div className="h-20 px-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-[#0f1117]/50 backdrop-blur-sm">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex flex-col gap-1 w-full max-w-[320px]">
                                        <Input
                                            value={selectedEtapa.etiqueta}
                                            onChange={(e) => handleUpdate(selectedEtapa.id, "etiqueta", e.target.value)}
                                            className="h-9 font-bold text-lg bg-transparent border-none focus-visible:ring-1 focus-visible:ring-violet-500/30 p-0"
                                        />
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                            <span>Espera:</span>
                                            <Input
                                                type="number"
                                                value={selectedEtapa.dias_espera}
                                                onChange={(e) => handleUpdate(selectedEtapa.id, "dias_espera", parseInt(e.target.value))}
                                                className="h-5 w-14 text-[10px] p-1 border-gray-200 dark:border-gray-700 bg-transparent"
                                            />
                                            <span>días laborales</span>
                                            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3">
                                                <span>Estado:</span>
                                                <Switch
                                                    checked={selectedEtapa.activo}
                                                    onCheckedChange={(val) => handleUpdate(selectedEtapa.id, "activo", val)}
                                                    className="scale-75"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-4xl mx-auto space-y-6">

                                    {/* Asunto */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="asunto_template" className="text-xs font-semibold text-gray-700 dark:text-gray-300">Asunto</Label>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-gray-400 font-medium">Insertar:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('asunto_template', '{empresa}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{empresa}"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('asunto_template', '{correo}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{correo}"}
                                                </button>
                                            </div>
                                        </div>
                                        <Input
                                            id="asunto_template"
                                            className="bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 text-sm h-10 shadow-sm focus:border-violet-400 focus:ring-violet-400/20"
                                            value={selectedEtapa.asunto_template}
                                            onChange={(e) => handleUpdate(selectedEtapa.id, "asunto_template", e.target.value)}
                                        />
                                    </div>

                                    {/* Introducción */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="mensaje_intro" className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cuerpo del Mensaje</Label>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-gray-400 font-medium">Insertar:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('mensaje_intro', '{empresa}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{empresa}"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('mensaje_intro', '{correo}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{correo}"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('mensaje_intro', '{dominio}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{dominio}"}
                                                </button>
                                            </div>
                                        </div>
                                        <Textarea
                                            id="mensaje_intro"
                                            className="min-h-[160px] bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 resize-none text-sm leading-relaxed p-3 shadow-sm focus:border-violet-400 focus:ring-violet-400/20"
                                            placeholder="Escribe el cuerpo principal del correo..."
                                            value={selectedEtapa.mensaje_intro}
                                            onChange={(e) => handleUpdate(selectedEtapa.id, "mensaje_intro", e.target.value)}
                                        />
                                    </div>

                                    {/* Separador visual */}
                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-dashed border-gray-200 dark:border-gray-800" />
                                        </div>
                                        <div className="relative flex justify-center">
                                            <span className="bg-white dark:bg-[#0f1117] px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cierre</span>
                                        </div>
                                    </div>

                                    {/* Cierre */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="mensaje_cierre" className="text-xs font-semibold text-gray-700 dark:text-gray-300">Mensaje de Cierre / CTA</Label>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-gray-400 font-medium">Insertar:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('mensaje_cierre', '{empresa}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{empresa}"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('mensaje_cierre', '{correo}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{correo}"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('mensaje_cierre', '{dominio}')}
                                                    className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all font-mono font-bold active:scale-95"
                                                >
                                                    {"{dominio}"}
                                                </button>
                                            </div>
                                        </div>
                                        <Textarea
                                            id="mensaje_cierre"
                                            className="min-h-[100px] bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 resize-none text-sm leading-relaxed p-3 shadow-sm focus:border-violet-400 focus:ring-violet-400/20"
                                            placeholder="Escribe el cierre y la llamada a la acción..."
                                            value={selectedEtapa.mensaje_cierre}
                                            onChange={(e) => handleUpdate(selectedEtapa.id, "mensaje_cierre", e.target.value)}
                                        />
                                    </div>

                                    {/* Imagen Promocional */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">URL de la Imagen Promocional</Label>
                                        <Input
                                            className="bg-white dark:bg-[#161b22] border-gray-200 dark:border-gray-800 text-sm h-10 shadow-sm focus:border-violet-400 focus:ring-violet-400/20"
                                            placeholder="https://ejemplo.com/imagen.jpg (opcional)"
                                            value={selectedEtapa.imagen_url || ""}
                                            onChange={(e) => handleUpdate(selectedEtapa.id, "imagen_url", e.target.value)}
                                        />
                                    </div>

                                    {/* Preview */}
                                    <div className="bg-gray-50 dark:bg-[#161b22]/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-xs text-gray-500 dark:text-gray-400 space-y-2">
                                        <p className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Vista previa del correo</p>
                                        <p className="font-semibold text-gray-700 dark:text-gray-300">
                                            Asunto: {selectedEtapa.asunto_template.replace("{empresa}", "Empresa Ejemplo S.A.")}
                                        </p>
                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-2 leading-relaxed">
                                            <p>{selectedEtapa.mensaje_intro.replace("{empresa}", "Empresa Ejemplo S.A.").replace("{correo}", "contacto@ejemplo.cl").replace("{dominio}", "ejemplo.cl")}</p>
                                            
                                            {selectedEtapa.imagen_url && (
                                                <div className="my-3 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900">
                                                    <p className="text-[9px] text-gray-400 mb-1">Imagen promocional:</p>
                                                    <img 
                                                        src={selectedEtapa.imagen_url} 
                                                        alt="Vista previa" 
                                                        className="max-h-40 mx-auto rounded"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            <p className="italic text-gray-400">{selectedEtapa.mensaje_cierre}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#0f1117]/50 backdrop-blur-md flex justify-between items-center gap-4">
                                <Button
                                    onClick={() => enviarPrueba(selectedEtapa)}
                                    disabled={enviandoPrueba}
                                    variant="outline"
                                    className="h-10 px-4 text-xs font-bold text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all active:scale-95"
                                >
                                    {enviandoPrueba ? (
                                        <>
                                            <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />
                                            Enviando...
                                        </>
                                    ) : "Enviar Correo de Prueba"}
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
                                        onClick={() => guardarCambios(selectedEtapa)}
                                        disabled={guardando}
                                        className="h-10 px-8 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white shadow-xl shadow-violet-900/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {guardando ? (
                                            <>
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : "Guardar Cambios"}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                                <LayoutDashboard className="h-8 w-8 opacity-40" />
                            </div>
                            <p className="text-sm font-medium">Selecciona una etapa para comenzar</p>
                            <Button onClick={handleCrear} variant="ghost" className="mt-4 text-violet-600 text-xs">
                                <PlusCircle className="h-4 w-4 mr-2" /> Crear primera etapa
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
