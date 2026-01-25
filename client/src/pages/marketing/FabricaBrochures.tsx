import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import {
    Plus,
    Trash2,
    Download,
    Layout,
    Image as ImageIcon,
    FileText,
    Loader2,
    Sparkles,
    Maximize,
    Minimize2,
    Save,
    Tags
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
    fitMode?: "cover" | "contain";
    x?: number;
    y?: number;
    w?: number;
    h?: number;
}

export default function FabricaBrochures() {
    const [images, setImages] = useState<{ name: string; url: string }[]>([]);
    const [buckets, setBuckets] = useState<string[]>([]);
    const [activeBucket, setActiveBucket] = useState("imagenes-marketing");
    const [loading, setLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [layoutMode, setLayoutMode] = useState<"structural" | "free">("structural");
    const [rows, setRows] = useState(2);
    const [cols, setCols] = useState(2);
    const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
    const [pageSize, setPageSize] = useState<"a4" | "carta">("carta");
    const [searchTerm, setSearchTerm] = useState("");
    const [categories, setCategories] = useState<string[]>(["BOTELLAS", "MUGS", "BOLIGRAFOS", "BOLSAS", "TECNOLOGIA", "TEXTIL"]);
    const [currentCategory, setCurrentCategory] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [saving, setSaving] = useState(false);

    // Brochure State (Temporary/Local only)
    const [brochureData, setBrochureData] = useState({
        numero_cotizacion: "LIVE-BROCHURE",
        cuenta: { cliente: "" },
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

    const saveTemplate = async () => {
        if (!currentCategory || !templateName || brochureData.items.length === 0) {
            alert("Por favor completa: Categoría, Nombre y añade al menos una imagen.");
            return;
        }

        try {
            setSaving(true);
            const fileName = `templates/${currentCategory.toUpperCase()}_${templateName.replace(/\s+/g, '_')}.json`;

            const templateBlob = new Blob([JSON.stringify({
                category: currentCategory.toUpperCase(),
                name: templateName,
                layoutMode,
                rows,
                cols,
                orientation,
                pageSize,
                items: brochureData.items
            }, null, 2)], { type: 'application/json' });

            const { error } = await supabase.storage
                .from('imagenes-marketing')
                .upload(fileName, templateBlob, {
                    contentType: 'application/json',
                    upsert: true
                });

            if (error) throw error;

            alert("✓ Plantilla guardada exitosamente en el Storage.");
            if (!categories.includes(currentCategory.toUpperCase())) {
                setCategories(prev => [...prev, currentCategory.toUpperCase()]);
            }
        } catch (err) {
            console.error("Error guardando plantilla:", err);
            alert("Error al guardar la plantilla.");
        } finally {
            setSaving(false);
        }
    };

    const fetchStorageImages = async (bucketName: string) => {
        try {
            setLoading(true);
            const { data: files, error } = await supabase.storage.from(bucketName).list('', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'desc' }
            });

            if (error) throw error;

            if (files) {
                setImages(files
                    .filter(f => f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
                    .map(f => ({
                        name: f.name,
                        url: supabase.storage.from(bucketName).getPublicUrl(f.name).data.publicUrl
                    }))
                );

                // Fetch categories from templates/ folder
                const { data: templateFiles } = await supabase.storage.from('imagenes-marketing').list('templates');
                if (templateFiles) {
                    const foundCats = templateFiles
                        .filter(f => f.name.includes('_'))
                        .map(f => f.name.split('_')[0].toUpperCase());

                    const uniqueCats = Array.from(new Set([...categories, ...foundCats]));
                    setCategories(uniqueCats);
                }
            }
        } catch (err) {
            console.error("Error cargando imágenes:", err);
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
            subcostos: [{ valor: 0 }],
            fitMode: "cover",
            x: 20,
            y: 20,
            w: 200,
            h: 200
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

    const toggleFitMode = (id: string) => {
        setBrochureData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === id
                    ? { ...item, fitMode: item.fitMode === "cover" ? "contain" : "cover" }
                    : item
            )
        }));
    };

    if (previewMode) {
        return (
            <BrochureView
                cotizacion={brochureData as any}
                onBack={() => setPreviewMode(false)}
                rows={rows}
                cols={cols}
                layoutMode={layoutMode}
                orientation={orientation}
                pageSize={pageSize}
                onUpdateItems={(items: BrochureItem[]) => setBrochureData(prev => ({ ...prev, items }))}
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
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Canvas: Brochure Builder */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col shadow-sm overflow-hidden">
                <header className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/50">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                Diseñador de Presentaciones
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest ${layoutMode === 'structural' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                                    {layoutMode === 'structural' ? 'Estructural' : 'Libre'}
                                </span>
                            </h2>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-1 border border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => setLayoutMode("structural")}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${layoutMode === "structural" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                                    >ESTRUCTURAL</button>
                                    <button
                                        onClick={() => setLayoutMode("free")}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${layoutMode === "free" ? "bg-white dark:bg-gray-800 shadow-sm text-amber-600" : "text-gray-400 hover:text-gray-600"}`}
                                    >LIENZO LIBRE</button>
                                </div>

                                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                                {layoutMode === "structural" && (
                                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-2 border border-gray-200 dark:border-gray-700 items-center px-2 animate-in slide-in-from-left-2 duration-300">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase ml-1">Grilla:</span>
                                        <input
                                            type="number"
                                            min="1" max="6"
                                            value={rows}
                                            onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-10 h-7 bg-white dark:bg-gray-800 border-none rounded text-xs font-bold text-center focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-[10px] text-gray-400">×</span>
                                        <input
                                            type="number"
                                            min="1" max="6"
                                            value={cols}
                                            onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-10 h-7 bg-white dark:bg-gray-800 border-none rounded text-xs font-bold text-center focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}
                                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                                {/* Template Manager */}
                                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-2 border border-blue-200 dark:border-blue-900/30 items-center px-2">
                                    <div className="flex items-center gap-1.5 min-w-[120px]">
                                        <Tags className="h-3 w-3 text-blue-500" />
                                        <input
                                            list="categories-list"
                                            placeholder="CATEGORÍA"
                                            value={currentCategory}
                                            onChange={(e) => setCurrentCategory(e.target.value.toUpperCase())}
                                            className="w-full h-7 bg-transparent border-none text-[10px] font-bold text-blue-600 placeholder:text-blue-300 focus:ring-0 uppercase"
                                        />
                                        <datalist id="categories-list">
                                            {categories.map(c => <option key={c} value={c} />)}
                                        </datalist>
                                    </div>
                                    <div className="h-4 w-px bg-blue-200 dark:bg-blue-800"></div>
                                    <input
                                        placeholder="NOMBRE DISEÑO"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        className="w-32 h-7 bg-transparent border-none text-[10px] font-bold text-gray-600 dark:text-gray-300 placeholder:text-gray-400 focus:ring-0"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={saveTemplate}
                                        disabled={saving || brochureData.items.length === 0}
                                        className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold rounded-md"
                                    >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                                        GUARDAR
                                    </Button>
                                </div>
                                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-1 border border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => setOrientation("portrait")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${orientation === "portrait" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400"}`}
                                    >VERTICAL</button>
                                    <button
                                        onClick={() => setOrientation("landscape")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${orientation === "landscape" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400"}`}
                                    >HORIZONTAL</button>
                                </div>
                                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-1 border border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => setPageSize("carta")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${pageSize === "carta" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400"}`}
                                    >CARTA</button>
                                    <button
                                        onClick={() => setPageSize("a4")}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${pageSize === "a4" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400"}`}
                                    >A4</button>
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
                            <FileText className="h-4 w-4 text-indigo-500" /> Vista previa
                        </Button>
                        <Button
                            className="bg-black text-white hover:bg-gray-800 gap-2 h-11 px-5 rounded-xl transition-all active:scale-95"
                            disabled={brochureData.items.length === 0}
                            onClick={() => window.print()}
                        >
                            <Download className="h-4 w-4" /> Exportar Mural
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 dark:bg-gray-900/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {brochureData.items.length === 0 && (
                            <div className="col-span-full py-40 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem] flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <ImageIcon className="h-12 w-12 opacity-10" />
                                <p className="text-sm font-medium">Selecciona imágenes para armar tu composición</p>
                            </div>
                        )}
                        {brochureData.items.map((item, idx) => (
                            <div key={item.id} className="group relative bg-white dark:bg-gray-900 p-2 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-xl">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all z-10 flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        className="h-9 w-9 rounded-full shadow-lg bg-white/90 dark:bg-gray-800/90 text-indigo-600"
                                        onClick={() => toggleFitMode(item.id)}
                                        title={item.fitMode === "cover" ? "Ajustar al marco" : "Expandir imagen"}
                                    >
                                        {item.fitMode === "cover" ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-9 w-9 rounded-full shadow-lg"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className={`aspect-square rounded-[1.8rem] overflow-hidden border border-gray-50 dark:border-gray-800 ${item.fitMode === "contain" ? "bg-neutral-50 dark:bg-neutral-900" : ""}`}>
                                    <img
                                        src={item.imagen}
                                        alt=""
                                        className={`w-full h-full transition-all duration-700 ${item.fitMode === "contain" ? "object-contain p-4" : "object-cover group-hover:scale-105"}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
