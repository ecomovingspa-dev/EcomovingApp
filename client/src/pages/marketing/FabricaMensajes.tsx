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
import {
    generateMarketingContent,
    improveProductImage,
    GeneratedContent,
    ImageEnhancementOptions
} from "../../lib/gemini";

// Definición de las categorías y sus opciones (Smart Chips)
const CATEGORIES = {
    environment: {
        label: "Ambiente",
        options: [
            { id: "studio", label: "Estudio", desc: "Fondo limpio y profesional" },
            { id: "nature", label: "Naturaleza", desc: "Bosque o jardín verde" },
            { id: "beach", label: "Playa", desc: "Arena y mar de fondo" },
            { id: "office", label: "Oficina", desc: "Entorno corporativo moderno" },
            { id: "urban", label: "Ciudad", desc: "Entorno urbano elegante" },
        ]
    },
    humanElement: {
        label: "Personas",
        options: [
            { id: "none", label: "Ninguno", desc: "Solo el producto" },
            { id: "using", label: "Usándolo", desc: "Persona usando el producto" },
            { id: "nearby", label: "Cerca", desc: "Persona cerca del producto" },
        ]
    },
    lighting: {
        label: "Iluminación",
        options: [
            { id: "soft", label: "Suave", desc: "Luz de estudio difuminada" },
            { id: "sunlight", label: "Sol", desc: "Luz natural de día" },
            { id: "golden", label: "Atardecer", desc: "Tonos cálidos y dorados" },
            { id: "cinematic", label: "Cine", desc: "Contrastes dramáticos" },
        ]
    },
    surface: {
        label: "Superficie",
        options: [
            { id: "marble", label: "Mármol", desc: "Superficie blanca lujosa" },
            { id: "wood", label: "Madera", desc: "Textura natural y cálida" },
            { id: "stone", label: "Piedra", desc: "Base sólida y rústica" },
            { id: "floor", label: "Piso", desc: "Piso de diseño moderno" },
        ]
    }
};

export default function FabricaMensajes({ onSave }: { onSave: () => void }) {
    const [imagenOriginal, setImagenOriginal] = useState<string | null>(null);
    const [imagenMejorada, setImagenMejorada] = useState<string | null>(null);
    const [procesando, setProcesando] = useState(false);
    const [mejorandoImagen, setMejorandoImagen] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [contenido, setContenido] = useState<GeneratedContent | null>(null);
    const [opcionesMejora, setOpcionesMejora] = useState<ImageEnhancementOptions>({
        environment: "studio",
        humanElement: "none",
        lighting: "soft",
        surface: "marble",
        aesthetic: "premium"
    });
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
                setImagenMejorada(null); // Reset mejorada al subir nueva
                setProcesando(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            setMensaje("Error al procesar la imagen");
            setProcesando(false);
        }
    };

    const mejorarImagen = async () => {
        if (!imagenOriginal) return;
        try {
            setMejorandoImagen(true);
            setMensaje("🎨 La IA está aplicando tu configuración personalizada...");
            const mejorada = await improveProductImage(imagenOriginal, opcionesMejora);
            setImagenMejorada(mejorada);
            setMensaje("✨ ¡Imagen mejorada con éxito!");
            setTimeout(() => setMensaje(""), 3000);
        } catch (err: any) {
            console.error(err);
            setMensaje("❌ Error al mejorar imagen: " + err.message);
        } finally {
            setMejorandoImagen(false);
        }
    };

    const generarConIA = async () => {
        if (!imagenOriginal) return;
        try {
            setProcesando(true);
            setMensaje("🤖 Gemini está analizando tu producto...");
            // Usar la imagen mejorada si existe para el análisis y copia
            const result = await generateMarketingContent(imagenMejorada || imagenOriginal);
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

            // Usar la imagen mejorada si existe, sino la original
            const imagenAGuardar = imagenMejorada || imagenOriginal;

            // Obtener el último numero_secuencia para autoincrementar
            const { data: lastMsg } = await supabase
                .from("marketing")
                .select("numero_secuencia")
                .order("numero_secuencia", { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextSeq = (lastMsg?.numero_secuencia || 0) + 1;

            const { error } = await supabase
                .from("marketing")
                .insert([{
                    asunto: contenido.subject,
                    cuerpo_html: contenido.html.replace("IMAGE_PLACEHOLDER", imagenAGuardar),
                    cuerpo: `${contenido.part1}\n\n${contenido.part2}`, // Texto plano para respaldo
                    numero_secuencia: nextSeq,
                    imagen_url: imagenAGuardar,
                    estado: 'Activo'
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
                        {imagenMejorada || imagenOriginal ? (
                            <>
                                <img src={imagenMejorada || imagenOriginal || ""} className="w-full h-full object-contain p-4 transition-all duration-500" alt="Vista previa" />
                                {imagenMejorada && (
                                    <div className="absolute top-4 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg animate-bounce">
                                        IA MEJORADA
                                    </div>
                                )}
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

                    {/* Consola de Parámetros (Smart Chips) */}
                    {imagenOriginal && !imagenMejorada && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <ImageIcon className="h-4 w-4 text-indigo-500" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Consola de Control Creativo</h3>
                            </div>

                            {Object.entries(CATEGORIES).map(([catId, category]) => (
                                <div key={catId} className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{category.label}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {category.options.map((opt) => {
                                            const isSelected = (opcionesMejora as any)[catId] === opt.id;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setOpcionesMejora(prev => ({ ...prev, [catId]: opt.id }))}
                                                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${isSelected
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105'
                                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Muestra descripción de la opción seleccionada */}
                                    <p className="text-[10px] text-gray-400 italic">
                                        {category.options.find(o => (opcionesMejora as any)[catId] === o.id)?.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        {!imagenMejorada && imagenOriginal && (
                            <Button
                                className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold flex items-center justify-center gap-3 shadow-lg transition-transform active:scale-95"
                                disabled={mejorandoImagen}
                                onClick={mejorarImagen}
                            >
                                {mejorandoImagen ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                                Mejorar con IA Pro
                            </Button>
                        )}

                        <Button
                            className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none transition-transform active:scale-95"
                            disabled={!imagenOriginal || procesando}
                            onClick={generarConIA}
                        >
                            {procesando ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    <Edit3 className="h-6 w-6" />
                                    Generar Contenido IA
                                </>
                            )}
                        </Button>
                    </div>
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
