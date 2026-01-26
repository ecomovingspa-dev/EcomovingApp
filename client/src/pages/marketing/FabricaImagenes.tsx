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
    X
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { askGeminiAboutImage } from "../../lib/gemini";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export default function FabricaImagenes() {
    // States for Media Explorer
    const [images, setImages] = useState<{ name: string; url: string; bucket: string }[]>([]);
    const [loadingStorage, setLoadingStorage] = useState(false);
    const [searchTerm, setSearchTerm] = useState("mug"); // Default to "mug" as requested
    const [activeImage, setActiveImage] = useState<{ name: string; url: string; bucket: string } | null>(null);
    const [buckets, setBuckets] = useState<string[]>([]);
    const [activeBucket, setActiveBucket] = useState("imagenes-marketing");

    // States for Chat / AI Assistant
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
        { role: "assistant", content: "Hola, soy tu asistente de imágenes de Ecomoving. ¿En qué puedo ayudarte a mejorar tus fotos para Supabase hoy?" }
    ]);
    const [userInput, setUserInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    // Categories / Management
    const [categories, setCategories] = useState(["MUGS", "BOTELLAS", "BOLSAS", "TECNOLOGIA"]);
    const [showManagement, setShowManagement] = useState(false);

    useEffect(() => {
        initStorage();
    }, []);

    const initStorage = async () => {
        try {
            setLoadingStorage(true);
            const { data: allBuckets } = await supabase.storage.listBuckets();
            if (allBuckets) {
                setBuckets(allBuckets.map(b => b.name));
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

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        const newChat = [...chatHistory, { role: "user", content: userInput } as ChatMessage];
        setChatHistory(newChat);
        setUserInput("");
        setIsTyping(true);

        try {
            // Context from the active image if exists
            let prompt = userInput;
            if (activeImage) {
                prompt = `Tengo seleccionada la imagen: ${activeImage.url}. \n\nInstrucción del usuario: ${userInput}`;
            }

            // Using the new flexible chat helper
            const aiResponse = await askGeminiAboutImage(activeImage?.url || null, prompt);

            setChatHistory(prev => [...prev, {
                role: "assistant",
                content: aiResponse
            }]);
        } catch (err: any) {
            setChatHistory(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error procesando tu solicitud: " + err.message }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-160px)] min-h-[600px] overflow-hidden">

            {/* PANEL IZQUIERDO: ASISTENTE IA (Estilo AI Studio) */}
            <div className="w-full lg:w-[400px] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-indigo-500 flex items-center justify-center">
                            <Sparkles className="h-3 w-3 text-white" />
                        </div>
                        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Asistente IA</h2>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Gemini 3.0 Flash</div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-[13px] leading-relaxed ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                                }`}>
                                {msg.content}
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                                {msg.role === 'user' ? 'Tú' : 'Gemini'}
                            </span>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex flex-col items-start animate-pulse">
                            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-white/5 text-[10px] text-slate-400">
                                Pensando...
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                    <div className="relative">
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Pregunta algo sobre la imagen..."
                            className="w-full bg-slate-800 border-white/5 rounded-xl p-3 pr-12 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!userInput.trim() || isTyping}
                            className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-all"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* PANEL CENTRAL/DERECHO: EXPLORADOR Y PREVIEW */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">

                {/* TOOLBAR SUPERIOR */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-700 shadow-sm"
                            >
                                <Eye className="h-3 w-3 mr-2 text-indigo-500" /> VISTA PREVIA
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-[10px] font-bold rounded-lg text-slate-500"
                            >
                                <Settings className="h-3 w-3 mr-2" /> AJUSTES
                            </Button>
                        </div>

                        <div className="h-4 w-px bg-gray-200 dark:bg-white/10 mx-2" />

                        <div className="flex items-center gap-2">
                            <select
                                value={activeBucket}
                                onChange={(e) => setActiveBucket(e.target.value)}
                                className="h-8 bg-transparent text-[10px] font-bold uppercase tracking-wider text-slate-500 outline-none"
                            >
                                {buckets.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-48 lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                            <Input
                                placeholder="Filtrar por categoría (ej: Mug)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-8 pl-9 text-[10px] bg-gray-100 dark:bg-slate-800 border-none rounded-xl"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-indigo-500/20 text-indigo-500 text-[10px] font-bold"
                            onClick={() => setShowManagement(!showManagement)}
                        >
                            <Settings className="h-3.5 w-3.5 mr-2" /> GESTIÓN
                        </Button>
                    </div>
                </div>

                <div className="flex-1 flex gap-4 min-h-0">

                    {/* EXPLORADOR DE IMÁGENES */}
                    <div className="w-64 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-gray-200 dark:border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-xl">
                        <div className="p-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Grid className="h-3 w-3" /> Explorador
                            </h3>
                            <RefreshCw
                                onClick={() => fetchImages(activeBucket)}
                                className={`h-3 w-3 text-slate-500 cursor-pointer ${loadingStorage ? 'animate-spin' : ''}`}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 scrollbar-hide">
                            {filteredImages.length > 0 ? (
                                filteredImages.map((img, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setActiveImage(img)}
                                        className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${activeImage?.name === img.name ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-transparent hover:border-slate-700'
                                            }`}
                                    >
                                        <img src={img.url} className="w-full h-full object-cover" alt={img.name} />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center p-2">
                                            <p className="text-[8px] text-white font-bold truncate">{img.name}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-2 flex flex-col items-center justify-center py-20 opacity-20">
                                    <ImageIcon className="h-8 w-8 mb-2" />
                                    <p className="text-[10px] font-bold">Sin fotos</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LIENZO DE TRABAJO */}
                    <div className="flex-1 bg-slate-50 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5 relative overflow-hidden flex items-center justify-center">
                        {activeImage ? (
                            <div className="w-full h-full p-8 flex flex-col">
                                <div className="flex-1 relative rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border border-white/10 group">
                                    <img src={activeImage.url} className={`w-full h-full object-contain`} alt="Preview" />

                                    {/* Categoría Badge */}
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest shadow-lg">
                                            {searchTerm.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Action Buttons Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <Button variant="secondary" className="rounded-full shadow-2xl h-12 w-12 p-0">
                                            <Camera className="h-5 w-5" />
                                        </Button>
                                        <Button variant="secondary" className="rounded-full shadow-2xl h-12 w-12 p-0">
                                            <Grid className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-lg">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{activeImage.name}</h4>
                                        <p className="text-[10px] text-slate-500 font-mono mt-1">{activeImage.url.substring(0, 60)}...</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold h-9 px-4">
                                            <Save className="h-3.5 w-3.5 mr-2" /> ACTUALIZAR EN SUPABASE
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 opacity-20">
                                <Camera className="h-16 w-16" />
                                <p className="text-sm font-bold uppercase tracking-widest">Selecciona una imagen para trabajar</p>
                            </div>
                        )}

                        {/* PANEL DE GESTIÓN (OVERLAY) */}
                        {showManagement && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-300">
                                <div className="w-[450px] bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-white/10 relative">
                                    <button
                                        onClick={() => setShowManagement(false)}
                                        className="absolute top-4 right-4 text-slate-500 hover:text-white"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>

                                    <div className="flex items-center gap-3 mb-6">
                                        <Settings className="h-5 w-5 text-indigo-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">Gestión de Categorías</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex gap-2">
                                            <Input placeholder="Nueva categoría..." className="bg-gray-100 dark:bg-slate-800 border-none" />
                                            <Button className="bg-indigo-600 text-white"><Plus className="h-4 w-4" /></Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            {categories.map(cat => (
                                                <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-white/5">
                                                    <span className="text-xs font-bold text-slate-400">{cat}</span>
                                                    <Trash2 className="h-3.5 w-3.5 text-rose-500 cursor-pointer" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/5">
                                        <Button
                                            onClick={() => setShowManagement(false)}
                                            className="w-full bg-slate-900 border border-white/10 text-white"
                                        >
                                            Cerrar Panel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
