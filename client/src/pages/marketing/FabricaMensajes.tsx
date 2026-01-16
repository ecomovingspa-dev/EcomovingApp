import { useState, useRef } from "react";
import { supabase } from "../../supabase";
import {
    Sparkles,
    Upload,
    Save,
    Trash2,
    Eye,
    Edit3,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Image as ImageIcon
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { optimizeImage } from "../../utils/image";
import { generateMarketingContent, GeneratedContent } from "../../lib/gemini";

export default function FabricaMensajes({ onSave }: { onSave: () => void }) {
    const [imagenOriginal, setImagenOriginal] = useState<string | null>(null);
    const [procesando, setProcesando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [contenido, setContenido] = useState<GeneratedContent | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setProcesando(true);
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target?.result as string;
                const optimized = await optimizeImage(base64);
                setImagenOriginal(optimized);
                setProcesando(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            setMensaje("Error al procesar la imagen");
            setProcesando(false);
        }
    };

    const generarConIA = async () => {
        if (!imagenOriginal) return;
        try {
            setProcesando(true);
            setMensaje("🤖 Gemini está analizando tu producto...");
            const result = await generateMarketingContent(imagenOriginal);
            setContenido(result);
            setMensaje("✨ ¡Contenido generado con éxito!");
            setTimeout(() => setMensaje(""), 3000);
        } catch (err: any) {
            console.error(err);
            setMensaje("❌ Error de IA: " + err.message);
        } finally {
            setProcesando(false);
        }
    };

    const guardarMensaje = async () => {
        if (!contenido || !imagenOriginal) return;

        try {
            setGuardando(true);

            // 1. (Opcional) Subir imagen a Supabase Storage
            // Por ahora guardaremos el HTML con el marcador IMAGE_PLACEHOLDER 
            // y la imagen base64 como referencia temporal o URL si estuviera disponible.

            const { error } = await supabase
                .from("marketing")
                .insert([{
                    asunto: contenido.subject,
                    html: contenido.html.replace("IMAGE_PLACEHOLDER", imagenOriginal),
                }]);

            if (error) throw error;

            setMensaje("✅ Mensaje guardado en la biblioteca");
            setTimeout(() => {
                setMensaje("");
                onSave(); // Volver a la lista
            }, 2000);
        } catch (err: any) {
            console.error(err);
            setMensaje("Error al guardar: " + err.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Acción */}
            <div className="flex items-center justify-between bg-indigo-900/10 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white italic">Fábrica de Contenido IA</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Transforma una foto en un email profesional en segundos.</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    {contenido && (
                        <Button
                            onClick={guardarMensaje}
                            disabled={guardando}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                        >
                            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar en Biblioteca
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => {
                            setImagenOriginal(null);
                            setContenido(null);
                        }}
                        className="text-gray-500 border-gray-200 dark:border-gray-700"
                    >
                        Limpiar
                    </Button>
                </div>
            </div>

            {mensaje && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-2 border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
                    {mensaje.includes("❌") ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    {mensaje}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Columna Izquierda: Imagen y Control */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm aspect-square flex flex-col items-center justify-center relative group">
                        {imagenOriginal ? (
                            <>
                                <img src={imagenOriginal} className="w-full h-full object-contain p-4" alt="Original" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} size="sm">
                                        Cambiar Imagen
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div
                                className="flex flex-col items-center gap-4 cursor-pointer p-12 w-full h-full justify-center"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="h-20 w-20 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                                    <Upload className="h-8 w-8 text-gray-400" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-gray-700 dark:text-gray-300">Cargar Foto de Producto</p>
                                    <p className="text-xs text-gray-500">Formato JPG, PNG (máx 5MB)</p>
                                </div>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                        />
                    </div>

                    <Button
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none transition-transform active:scale-95"
                        disabled={!imagenOriginal || procesando}
                        onClick={generarConIA}
                    >
                        {procesando ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <>
                                <Sparkles className="h-6 w-6" />
                                Generar Contenido con Gemini
                            </>
                        )}
                    </Button>
                </div>

                {/* Columna Derecha: Resultado */}
                <div className="space-y-6">
                    {contenido ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm h-full animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[600px]">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Asunto del Email</label>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-gray-100 font-medium border border-gray-100 dark:border-gray-800">
                                    {contenido.subject}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contenido Sugerido</label>
                                <div className="space-y-4 p-4 border border-indigo-50 dark:border-indigo-900/30 rounded-xl bg-indigo-50/20 dark:bg-indigo-900/10">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">{contenido.part1}</p>
                                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs">
                                        [ Imagen del Producto ]
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{contenido.part2}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <ImageIcon className="h-3 w-3" />
                                    Caption Redes Sociales
                                </label>
                                <div className="p-3 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                                    {contenido.social}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 h-full flex flex-col items-center justify-center p-12 text-center opacity-50">
                            <Edit3 className="h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-400">Sube una imagen y presiona generar para ver la magia de la IA aquí.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
