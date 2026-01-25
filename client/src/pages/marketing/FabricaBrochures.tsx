import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import {
    Plus,
    Trash2,
    Download,
    Layout,
    Image as ImageIcon,
    FileText,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrochureView from "../cotizaciones/BrochureView";

interface BrochureItem {
    id: string;
    descripcion: string;
    imagen: string;
    cantidad: number;
    margen: number;
    subcostos: any[];
}

export default function FabricaBrochures() {
    const [images, setImages] = useState<{ name: string; url: string }[]>([]);
    const [buckets, setBuckets] = useState<string[]>([]);
    const [activeBucket, setActiveBucket] = useState("imagenes-marketing");
    const [loading, setLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [layoutMode, setLayoutMode] = useState<"grid" | "collage">("grid");
    const [searchTerm, setSearchTerm] = useState("");

    // Brochure State
    const [brochureData, setBrochureData] = useState({
        numero_cotizacion: "B-2026",
        cuenta: { cliente: "CLIENTE PREMIUM" },
        items: [] as BrochureItem[]
    });

    useEffect(() => {
        initStorage();
    }, []);

    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const initStorage = async () => {
        setLoading(true);
        try {
            const { data: allBuckets, error: bError } = await supabase.storage.listBuckets();
            if (!bError && allBuckets) {
                const names = allBuckets.map(b => b.name);
                setBuckets(names);

                if (names.includes("imagenes-marketing")) {
                    setActiveBucket("imagenes-marketing");
                } else if (names.includes("productos")) {
                    setActiveBucket("productos");
                } else if (names.length > 0) {
                    setActiveBucket(names[0]);
                }
            }
            await fetchStorageImages(activeBucket);
        } catch (err) {
            console.error("Error inicializando storage:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeBucket) {
            fetchStorageImages(activeBucket);
        }
    }, [activeBucket]);

    const fetchStorageImages = async (bucketName: string) => {
        try {
            setLoading(true);
            const { data: files, error } = await supabase.storage.from(bucketName).list('', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'desc' }
            });

            if (error) throw error;

            const formattedImages = files
                .filter(file => file.name !== '.emptyFolderPlaceholder')
                .map(file => ({
                    name: file.name,
                    url: supabase.storage.from(bucketName).getPublicUrl(file.name).data.publicUrl
                }));

            setImages(formattedImages);
        } catch (err) {
            console.error(`Error fetching images from ${bucketName}:`, err);
            setImages([]);
        } finally {
            setLoading(false);
        }
    };

    const addItem = (imgUrl: string, name: string) => {
        const newItem: BrochureItem = {
            id: Math.random().toString(36).substr(2, 9),
            descripcion: name.split('.')[0].replace(/_/g, ' '),
            imagen: imgUrl,
            cantidad: 1,
            margen: 18,
            subcostos: [{ valor: 10000 }]
        };

        setBrochureData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
    };

    const removeItem = (id: string) => {
        setBrochureData(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== id)
        }));
    };

    if (previewMode) {
        return (
            <BrochureView
                cotizacion={brochureData as any}
                onBack={() => setPreviewMode(false)}
                layout={layoutMode}
            />
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
            {/* Sidebar: Storage Explorer */}
            <div className="w-full lg:w-96 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500 flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" /> Media Storage
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => fetchStorageImages(activeBucket)} className="h-8 w-8 p-0">
                            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {buckets.length > 0 && (
                            <select
                                value={activeBucket}
                                onChange={(e) => setActiveBucket(e.target.value)}
                                className="w-full h-10 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none px-3"
                            >
                                {buckets.map(b => (
                                    <option key={b} value={b}>{b.toUpperCase()}</option>
                                ))}
                            </select>
                        )}
                        <div className="relative">
                            <Input
                                placeholder="Buscar imagen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-10 text-xs pl-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
                            />
                            <div className="absolute left-3 top-3 text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                    {filteredImages.length === 0 && !loading && (
                        <div className="text-center py-12 px-4">
                            <ImageIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 text-xs italic">
                                {searchTerm ? "No se encontraron coincidencias" : "No hay imágenes disponibles"}
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {filteredImages.map((img, idx) => (
                            <div
                                key={idx}
                                className="group relative aspect-square bg-gray-50 dark:bg-gray-900/50 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:border-indigo-500 cursor-pointer transition-all shadow-sm"
                                onClick={() => addItem(img.url, img.name)}
                            >
                                <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-[1px]">
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform">
                                        <Plus className="text-indigo-600 dark:text-indigo-400 h-5 w-5" />
                                    </div>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                    <p className="text-[10px] text-white truncate font-medium">{img.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Canvas: Brochure Builder */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col shadow-sm overflow-hidden">
                <header className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                            <Layout className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fábrica de Brochures</h2>
                            <div className="flex items-center gap-4 mt-1">
                                <p className="text-sm text-gray-500">Diseña presentaciones profesionales.</p>
                                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-1 border border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => setLayoutMode("grid")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${layoutMode === "grid" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                                    >
                                        GRILLA
                                    </button>
                                    <button
                                        onClick={() => setLayoutMode("collage")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${layoutMode === "collage" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                                    >
                                        COLLAGE
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="gap-2 h-11 px-5 rounded-xl border-gray-200 dark:border-gray-700"
                            disabled={brochureData.items.length === 0}
                            onClick={() => setPreviewMode(true)}
                        >
                            <FileText className="h-4 w-4 text-indigo-500" /> Vista Previa
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 px-5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                            disabled={brochureData.items.length === 0}
                        >
                            <Download className="h-4 w-4" /> Exportar
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30 dark:bg-gray-900/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest pl-1">Título de la Campaña</label>
                            <Input
                                value={brochureData.numero_cotizacion}
                                onChange={(e) => setBrochureData(prev => ({ ...prev, numero_cotizacion: e.target.value }))}
                                className="bg-white dark:bg-gray-800 h-12 rounded-xl border-gray-200 dark:border-gray-700 shadow-sm"
                                placeholder="Ej: Colección Verano 2026"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest pl-1">Nombre del Cliente</label>
                            <Input
                                value={brochureData.cuenta.cliente}
                                onChange={(e) => setBrochureData(prev => ({ ...prev, cuenta: { cliente: e.target.value } }))}
                                className="bg-white dark:bg-gray-800 h-12 rounded-xl border-gray-200 dark:border-gray-700 shadow-sm"
                                placeholder="Ej: Empresa de Logística SpA"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-gray-700"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {brochureData.items.length === 0 && (
                            <div className="col-span-full py-32 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2rem] flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <div className="h-20 w-20 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                                    <ImageIcon className="h-10 w-10 opacity-20" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-500">Mesa de trabajo vacía</p>
                                    <p className="text-xs">Selecciona imágenes del storage lateral para comenzar</p>
                                </div>
                            </div>
                        )}
                        {brochureData.items.map((item, idx) => (
                            <div key={item.id} className="group relative bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all animate-in zoom-in-95">
                                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-10 w-10 rounded-full shadow-2xl"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>

                                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-5 border border-gray-100 dark:border-gray-800">
                                    <img src={item.imagen} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                                </div>

                                <Input
                                    value={item.descripcion}
                                    onChange={(e) => {
                                        const newItems = [...brochureData.items];
                                        newItems[idx].descripcion = e.target.value;
                                        setBrochureData(prev => ({ ...prev, items: newItems }));
                                    }}
                                    className="border-transparent bg-transparent focus:bg-gray-50 dark:focus:bg-gray-800 text-base font-bold p-0 px-3 h-10 rounded-lg mb-2"
                                    placeholder="Descripción del producto..."
                                />

                                <div className="flex items-center justify-between px-3">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Página {idx + 1}</span>
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
