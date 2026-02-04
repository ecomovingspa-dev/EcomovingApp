import { useState } from "react";
import {
    Palette,
    Sparkles,
    Download,
    Save,
    Send,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Image as ImageIcon,
    RefreshCw,
    Maximize2
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { generateImage } from "../../lib/gemini";
import { supabase } from "../../lib/supabase";

export default function FabricaImagenes({ onGenerateContent }: { onGenerateContent: () => void }) {
    const [prompt, setPrompt] = useState("");
    const [generando, setGenerando] = useState(false);
    const [imageRes, setImageRes] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [guardando, setGuardando] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        try {
            setGenerando(true);
            setStatus(null);
            setImageRes(null);
            const base64 = await generateImage(prompt);
            setImageRes(base64);
            setStatus({ type: 'success', msg: "✨ Imagen generada con éxito" });
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message });
        } finally {
            setGenerando(false);
        }
    };

    const saveToMarketing = async () => {
        if (!imageRes) return;
        try {
            setGuardando(true);
            setStatus({ type: 'success', msg: "💾 Guardando en biblioteca Ecomoving..." });

            // Convertir base64 a blob
            const base64Data = imageRes.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            const fileName = `ai_gen_${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('imagenes-marketing')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            setStatus({ type: 'success', msg: "✅ Guardada correctamente en Supabase" });
            setTimeout(() => setStatus(null), 3000);
        } catch (err: any) {
            setStatus({ type: 'error', msg: "Error al guardar: " + err.message });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-250px)]">

                {/* PANEL IZQUIERDO: CONTROLES */}
                <div className="bg-white dark:bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/5 p-8 flex flex-col shadow-2xl overflow-hidden self-start">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-500">
                            <Palette className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generador Visual</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Crea activos de marketing únicos con Imagen 3</p>
                        </div>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-purple-400" /> Descripción de la Imagen
                            </label>
                            <Textarea
                                placeholder="Ej: Una botella de agua sustentable en un escritorio minimalista con luz natural suave, estilo profesional y premium..."
                                className="min-h-[160px] bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/5 focus:ring-purple-500/20 rounded-2xl text-base p-4"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>

                        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                            <p className="text-[11px] text-gray-500 leading-relaxed italic">
                                💡 Tip: Menciona el estilo (fotografía realista, ilustración 3D), la iluminación y el entorno para obtener mejores resultados.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 space-y-4">
                        {status && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${status.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                }`}>
                                {status.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                <span className="text-xs font-medium">{status.msg}</span>
                            </div>
                        )}

                        <Button
                            onClick={handleGenerate}
                            disabled={generando || !prompt}
                            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-base shadow-lg shadow-purple-500/20 gap-3 transition-all active:scale-95"
                        >
                            {generando ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    IMAGINANDO...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    GENERAR IMAGEN PREMIUM
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* PANEL DERECHO: RESULTADO */}
                <div className="bg-gray-100 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/5 relative overflow-hidden flex items-center justify-center min-h-[400px]">
                    {imageRes ? (
                        <div className="relative group w-full h-full animate-in zoom-in duration-500">
                            <img
                                src={imageRes}
                                className="w-full h-full object-cover"
                                alt="AI Generated"
                            />

                            {/* Overlay de acciones */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-8 gap-4 backdrop-blur-sm">
                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => window.open(imageRes, '_blank')}
                                        className="h-12 w-12 bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl"
                                    >
                                        <Maximize2 className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = imageRes;
                                            link.download = `ecomoving_ai_${Date.now()}.jpg`;
                                            link.click();
                                        }}
                                        className="h-12 w-12 bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl"
                                    >
                                        <Download className="h-5 w-5" />
                                    </Button>
                                </div>
                                <div className="flex flex-col w-full max-w-xs gap-2">
                                    <Button
                                        onClick={saveToMarketing}
                                        disabled={guardando}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl gap-2 shadow-xl shadow-emerald-500/20"
                                    >
                                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        GUARDAR EN BIBLIOTECA
                                    </Button>
                                    <Button
                                        onClick={onGenerateContent}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 rounded-xl gap-2 shadow-xl shadow-purple-500/20"
                                    >
                                        <Send className="h-4 w-4" />
                                        USAR EN FÁBRICA DE MENSAJES
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 p-12 text-center opacity-30">
                            <div className="h-24 w-24 rounded-full bg-gray-200 dark:bg-white/5 flex items-center justify-center">
                                {generando ? <RefreshCw className="h-10 w-10 text-purple-500 animate-spin" /> : <ImageIcon className="h-12 w-12 text-gray-400" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Esperando instrucciones</h3>
                                <p className="text-sm text-gray-400 mt-2">La imagen de marketing de alta calidad aparecerá aquí</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
