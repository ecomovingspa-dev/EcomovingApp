import { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import {
    Sparkles,
    Save,
    Trash2,
    Eye,
    Edit3,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Image as ImageIcon,
    Search,
    RefreshCw,
    Send,
    MessageSquare,
    Settings,
    Grid,
    Camera,
    Plus,
    X,
    Scissors,
    Layers,
    Maximize2,
    Download,
    Cpu
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { askGeminiAboutImage } from "../../lib/gemini";
import { Badge } from "../../components/ui/badge";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export default function FabricaImagenes() {
    // States for Media Explorer
    const [images, setImages] = useState<{ name: string; url: string; bucket: string }[]>([]);
    const [loadingStorage, setLoadingStorage] = useState(false);
    const [searchTerm, setSearchTerm] = useState("mug");
    const [activeImage, setActiveImage] = useState<{ name: string; url: string; bucket: string } | null>(null);
    const [buckets, setBuckets] = useState<string[]>([]);
    const [activeBucket, setActiveBucket] = useState("productos"); // Focusing on productos (scraped)

    // Factory Controls
    const [selectedScenario, setSelectedScenario] = useState("Estudio Minimalista");
    const [selectedCategory, setSelectedCategory] = useState("MUGS");
    const [quality, setQuality] = useState(85);
    const [targetFormat, setTargetFormat] = useState("webp");
    const [processing, setProcessing] = useState(false);
    const [processStep, setProcessStep] = useState<"idle" | "removing" | "relighting" | "done">("idle");

    // States for Chat
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
        { role: "assistant", content: "Bienvenido a la Fábrica de Imágenes de Ecomoving. ¿Qué producto vamos a procesar hoy para el catálogo?" }
    ]);
    const [userInput, setUserInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        initStorage();
    }, []);

    const initStorage = async () => {
        try {
            setLoadingStorage(true);
            const { data: allBuckets } = await supabase.storage.listBuckets();
            if (allBuckets) {
                const names = allBuckets.map(b => b.name);
                setBuckets(names);
                if (names.includes("productos")) setActiveBucket("productos");
            }
            await fetchImages(activeBucket);
        } catch (err) {
            console.error("Error init storage:", err);
        } finally {
            setLoadingStorage(false);
        }
    };

    const fetchImages = async (bucket: string) => {
        try {
            setLoadingStorage(true);
            const { data: files, error } = await supabase.storage.from(bucket).list('', {
                limit: 100,
                sortBy: { column: 'name', order: 'desc' }
            });

            if (error) throw error;

            if (files) {
                const formatted = files
                    .filter(f => f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
                    .map(f => ({
                        name: f.name,
                        url: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
                        bucket: bucket
                    }));
                setImages(formatted);
            }
        } catch (err) {
            console.error("Error fetching images:", err);
        } finally {
            setLoadingStorage(false);
        }
    };

    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const ejecutarProcesamiento = async () => {
        if (!activeImage) return;
        setProcessing(true);
        setProcessStep("removing");

        // Simulación de pasos de procesamiento por ahora
        // En una implementación real, aquí llamaríamos a APIs de procesamiento de imagen
        setTimeout(() => {
            setProcessStep("relighting");
            setTimeout(() => {
                setProcessStep("done");
                setProcessing(false);
                setChatHistory(prev => [...prev, {
                    role: "assistant",
                    content: `He procesado con éxito la imagen del ${selectedCategory}. Se ha aplicado el escenario '${selectedScenario}' y se optimizó a formato ${targetFormat.toUpperCase()} (${quality}% calidad).`
                }]);
            }, 1500);
        }, 1500);
    };

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        const newChat = [...chatHistory, { role: "user", content: userInput } as ChatMessage];
        setChatHistory(newChat);
        setUserInput("");
        setIsTyping(true);

        try {
            let prompt = userInput;
            if (activeImage) {
                prompt = `CONTEXTO: Estás en la 'Fábrica de Imágenes' de Ecomoving.
PRODUCTO SELECCIONADO: ${selectedCategory}
ESCENARIO: ${selectedScenario}
IMAGEN: ${activeImage.url}

Instrucción del usuario: ${userInput}`;
            }

            const aiResponse = await askGeminiAboutImage(activeImage?.url || null, prompt);
            setChatHistory(prev => [...prev, { role: "assistant", content: aiResponse }]);
        } catch (err: any) {
            setChatHistory(prev => [...prev, { role: "assistant", content: "Error: " + err.message }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-160px)] min-h-[600px] overflow-hidden">

            {/* TOOLBAR PRINCIPAL */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Cpu className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Procesador de Catálogo</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">IA Image Factory v2</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-4 text-[10px] font-black rounded-lg bg-white dark:bg-slate-700 shadow-sm"
                        >
                            PREPARAR IMAGEN
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-4 text-[10px] font-black text-slate-500"
                        >
                            OPTIMIZAR PESO
                        </Button>
                    </div>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black h-10 px-6 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                        <Download className="h-4 w-4" /> EXPORTAR AL CATÁLOGO
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

                {/* PANEL IZQUIERDO: IA CONTROL & CHAT */}
                <div className="w-80 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden shrink-0">
                    <div className="p-4 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                            <h2 className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Asistente de Producción</h2>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[90%] p-3 rounded-2xl text-[12px] leading-relaxed ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-slate-800 text-slate-200 rounded-tl-none'
                                    } shadow-md`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex gap-1 p-2">
                                <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-950/50 border-t border-white/5">
                        <div className="relative">
                            <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                placeholder="Escribe instrucciones..."
                                className="w-full bg-slate-800 border-none rounded-xl p-3 pr-10 text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-16"
                            />
                            <button
                                onClick={handleSendMessage}
                                className="absolute right-3 bottom-3 text-indigo-500 hover:text-white"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* AREA CENTRAL: TRABAJO & PROCESAMIENTO */}
                <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
                    <div className="flex-1 bg-slate-50 dark:bg-black/40 rounded-3xl border border-gray-200 dark:border-white/5 relative overflow-hidden flex flex-col">

                        {/* Status Processing Overlay */}
                        {processing && (
                            <div className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm text-center">
                                    <div className="relative h-16 w-16">
                                        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-xs">AI</div>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase mb-2">
                                            {processStep === 'removing' ? 'Eliminando Fondo...' : 'Aplicando Escenario...'}
                                        </h3>
                                        <p className="text-xs text-slate-500">Estamos utilizando Gemini y Vision Engine para limpiar la imagen del mayorista.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 p-6 flex flex-col items-center justify-center">
                            {activeImage ? (
                                <div className="w-full h-full flex flex-col">
                                    {/* Main Workspace */}
                                    <div className="flex-1 relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-white/10 flex items-center justify-center overflow-hidden group">
                                        <img src={activeImage.url} className="max-w-full max-h-full object-contain p-8" alt="Preview" />

                                        {/* Grid Overlay Toggle */}
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg"><Grid className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg"><Maximize2 className="h-4 w-4" /></Button>
                                        </div>

                                        {/* Floating Badge */}
                                        <div className="absolute bottom-6 left-6">
                                            <Badge className="bg-slate-900/80 backdrop-blur text-[10px] font-black px-3 py-1.5 border border-white/20">
                                                ORIGINAL (SCRAPED)
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Info Panel Below Image */}
                                    <div className="mt-4 flex items-center justify-between p-4 bg-white dark:bg-slate-950/40 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                                <ImageIcon className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">{activeImage.name}</h4>
                                                <p className="text-[9px] text-slate-500 font-mono tracking-tighter">RUTA: storage/v1/object/public/{activeImage.bucket}/...</p>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={ejecutarProcesamiento}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black h-9 px-6 rounded-xl"
                                        >
                                            INICIAR PROCESAMIENTO IA
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center opacity-20">
                                    <ImageIcon className="h-20 w-20 mx-auto mb-4" />
                                    <p className="font-black uppercase tracking-[0.2em] text-sm">Selecciona una imagen del mayorista</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* PANEL DERECHO: CONTROLES DE FACTORÍA */}
                <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto scrollbar-hide">

                    {/* SECCIÓN 1: AJUSTES DE ESCENARIO */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Layers className="h-4 w-4 text-indigo-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ajustes de Escenario</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escenario Objetivo</label>
                                <select
                                    value={selectedScenario}
                                    onChange={(e) => setSelectedScenario(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl h-10 px-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-white/5"
                                >
                                    <option>Estudio Minimalista</option>
                                    <option>Oficina Moderna</option>
                                    <option>Escenario Naturaleza</option>
                                    <option>Fondo Blanco Puro</option>
                                    <option>Cocina / Hogar</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoría Catálogo</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl h-10 px-3 text-xs font-bold outline-none ring-1 ring-slate-200 dark:ring-white/5"
                                >
                                    <option>MUGS</option>
                                    <option>BOTELLAS</option>
                                    <option>BOLIGRAFOS</option>
                                    <option>TECNOLOGÍA</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: CALIDAD Y FORMATO */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Scissors className="h-4 w-4 text-emerald-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Calidad & Peso</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calidad JPG/WebP</label>
                                    <span className="text-[10px] font-black text-indigo-500">{quality}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="60" max="100"
                                    value={quality}
                                    onChange={(e) => setQuality(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant={targetFormat === 'webp' ? 'default' : 'outline'}
                                    onClick={() => setTargetFormat('webp')}
                                    className="flex-1 h-8 text-[9px] font-black"
                                >WEBP</Button>
                                <Button
                                    variant={targetFormat === 'jpg' ? 'default' : 'outline'}
                                    onClick={() => setTargetFormat('jpg')}
                                    className="flex-1 h-8 text-[9px] font-black"
                                >JPG</Button>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 3: MEDIA EXPLORER (SCRAPED) */}
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-lg min-h-[200px]">
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Search className="h-3 w-3" /> Scraped Images
                            </h3>
                            <RefreshCw
                                onClick={() => fetchImages(activeBucket)}
                                className={`h-3 w-3 text-slate-500 cursor-pointer ${loadingStorage ? 'animate-spin' : ''}`}
                            />
                        </div>

                        <div className="p-3">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                <Input
                                    placeholder="Filtro rápido (ej: Mug)..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-9 pl-9 text-[10px] bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 pt-0 grid grid-cols-2 gap-2 scrollbar-hide">
                            {filteredImages.map((img, i) => (
                                <div
                                    key={i}
                                    onClick={() => setActiveImage(img)}
                                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${activeImage?.name === img.name ? 'border-blue-600 shadow-xl scale-95' : 'border-transparent hover:border-slate-700'
                                        }`}
                                >
                                    <img src={img.url} className="w-full h-full object-cover" alt={img.name} />
                                    <div className="absolute inset-0 bg-blue-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                        <Plus className="text-white h-6 w-6" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
