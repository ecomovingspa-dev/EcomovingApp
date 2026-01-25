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
    Tags,
    ArrowLeft
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
    const [activeTab, setActiveTab] = useState<"storage" | "templates">("storage");
    const [templates, setTemplates] = useState<{ name: string; category: string; fileName: string }[]>([]);
    const [loadingTemplatesArea, setLoadingTemplatesArea] = useState(false);
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

                // Fetch categories and templates list
                const { data: templateFiles } = await supabase.storage.from('imagenes-marketing').list('templates');
                if (templateFiles) {
                    const foundCats = templateFiles
                        .filter(f => f.name.includes('_'))
                        .map(f => f.name.split('_')[0].toUpperCase());

                    const uniqueCats = Array.from(new Set([...categories, ...foundCats]));
                    setCategories(uniqueCats);

                    setTemplates(templateFiles
                        .filter(f => f.name.endsWith('.json'))
                        .map(f => ({
                            fileName: f.name,
                            category: f.name.split('_')[0] || "GENERAL",
                            name: f.name.split('_').slice(1).join(' ').replace('.json', '').replace(/_/g, ' ')
                        }))
                    );
                }
            }
        } catch (err) {
            console.error("Error cargando imágenes:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadTemplateFromFile = async (fileName: string) => {
        try {
            setLoadingTemplatesArea(true);
            const { data, error } = await supabase.storage.from('imagenes-marketing').download(`templates/${fileName}`);
            if (error) throw error;

            const text = await data.text();
            const template = JSON.parse(text);

            setBrochureData(prev => ({
                ...prev,
                items: template.items || []
            }));
            setLayoutMode(template.layoutMode || "structural");
            setRows(template.rows || 2);
            setCols(template.cols || 2);
            setOrientation(template.orientation || "portrait");
            setPageSize(template.pageSize || "carta");
            setCurrentCategory(template.category || "");
            setTemplateName(template.name || "");

            alert(`✓ Diseño "${template.name}" cargado.`);
        } catch (err) {
            console.error("Error cargando plantilla:", err);
            alert("Error al cargar el diseño.");
        } finally {
            setLoadingTemplatesArea(false);
        }
    };

    const addBranding = (type: 'logo' | 'logo-horiz') => {
        const url = type === 'logo'
            ? "https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo.png"
            : "https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png";

        addItem(url, type.toUpperCase());
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
                onUpdateItems={(items: any[]) => setBrochureData(prev => ({ ...prev, items }))}
            />
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)] overflow-hidden">
            {/* Sidebar: Storage Explorer & Templates */}
            <div className="w-full lg:w-72 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm shrink-0">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <button
                        onClick={() => setActiveTab("storage")}
                        className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === "storage" ? "text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        IMÁGENES
                    </button>
                    <button
                        onClick={() => setActiveTab("templates")}
                        className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === "templates" ? "text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        PLANTILLAS
                    </button>
                </div>

                {activeTab === "storage" ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" /> Media Explorer
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => fetchStorageImages(activeBucket)} className="h-8 w-8 p-0">
                                    <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>

                            <div className="flex flex-col gap-2">
                                <select
                                    value={activeBucket}
                                    onChange={(e) => setActiveBucket(e.target.value)}
                                    className="w-full h-8 text-[10px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg outline-none px-2"
                                >
                                    {buckets.map(b => (
                                        <option key={b} value={b}>{b.toUpperCase()}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <Input
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 text-[10px] pl-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg"
                                    />
                                    <div className="absolute left-2.5 top-2 text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Branding Quick Access */}
                            <div className="pt-2 flex gap-2">
                                <Button
                                    variant="outline" size="sm"
                                    className="flex-1 h-8 text-[9px] font-bold border-indigo-100 dark:border-indigo-900/30 text-indigo-600"
                                    onClick={() => addBranding('logo-horiz')}
                                >
                                    + LOGO HORIZONTAL
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
                            <div className="grid grid-cols-2 gap-2">
                                {filteredImages.map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="group relative aspect-square bg-gray-50 dark:bg-gray-900/50 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:border-indigo-500 cursor-pointer transition-all shadow-sm"
                                        onClick={() => addItem(img.url, img.name)}
                                    >
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-[1px]">
                                            <Plus className="text-white h-5 w-5" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-amber-50/30 dark:bg-amber-900/10">
                            <h3 className="font-bold text-[10px] uppercase tracking-wider text-amber-600 flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Diseños Guardados
                            </h3>
                            <p className="text-[9px] text-gray-500 mt-1 uppercase">Carga una base para trabajar</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                            {templates.length === 0 ? (
                                <div className="py-20 text-center opacity-20">
                                    <Layout className="h-10 w-10 mx-auto mb-2" />
                                    <p className="text-[10px] font-bold">Sin plantillas</p>
                                </div>
                            ) : (
                                templates.map((t, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => loadTemplateFromFile(t.fileName)}
                                        className="p-3 bg-white dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-amber-400 cursor-pointer transition-all group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 rounded uppercase tracking-tighter">
                                                {t.category}
                                            </span>
                                            <ArrowLeft className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 -rotate-180" />
                                        </div>
                                        <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-200 mt-2 uppercase truncate">{t.name}</h4>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Canvas: Brochure Builder */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col shadow-sm overflow-hidden min-w-0">
                <header className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/50 shrink-0">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                                Diseñador
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${layoutMode === 'structural' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                                    {layoutMode === 'structural' ? 'Estructural' : 'Libre'}
                                </span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Layout & Grid */}
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-1 border border-gray-200 dark:border-gray-700 items-center">
                            <button
                                onClick={() => setLayoutMode("structural")}
                                className={`px-2.5 py-1 text-[9px] font-bold rounded-md transition-all ${layoutMode === "structural" ? "bg-white dark:bg-gray-800 shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                            >GRILLA</button>
                            <button
                                onClick={() => setLayoutMode("free")}
                                className={`px-2.5 py-1 text-[9px] font-bold rounded-md transition-all ${layoutMode === "free" ? "bg-white dark:bg-gray-800 shadow-sm text-amber-600" : "text-gray-400 hover:text-gray-600"}`}
                            >LIBRE</button>

                            {layoutMode === "structural" && (
                                <>
                                    <div className="h-3 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                    <input
                                        type="number" min="1" max="6" value={rows}
                                        onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-7 h-5 bg-transparent border-none text-[9px] font-bold text-center focus:ring-0 appearance-none"
                                    />
                                    <span className="text-[9px] text-gray-400 font-bold px-0.5">×</span>
                                    <input
                                        type="number" min="1" max="6" value={cols}
                                        onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-7 h-5 bg-transparent border-none text-[9px] font-bold text-center focus:ring-0 appearance-none"
                                    />
                                </>
                            )}
                        </div>

                        {/* 2. Orientation & Size */}
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg gap-1 border border-gray-200 dark:border-gray-700 items-center">
                            <button
                                onClick={() => setOrientation(orientation === "portrait" ? "landscape" : "portrait")}
                                className="px-2.5 py-1 text-[9px] font-bold rounded-md transition-all text-indigo-600 bg-white dark:bg-gray-800 shadow-sm"
                            >
                                {orientation === "portrait" ? "VERTICAL" : "HORIZ"}
                            </button>
                            <div className="h-3 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                            <button
                                onClick={() => setPageSize(pageSize === "carta" ? "a4" : "carta")}
                                className="px-2.5 py-1 text-[9px] font-bold rounded-md transition-all text-neutral-600 dark:text-neutral-300"
                            >
                                {pageSize.toUpperCase()}
                            </button>
                        </div>

                        {/* 3. Template Manager */}
                        <div className="flex bg-blue-50/50 dark:bg-blue-900/10 p-1 rounded-lg gap-2 border border-blue-100 dark:border-blue-900/30 items-center px-2">
                            <input
                                list="categories-list" placeholder="CAT" value={currentCategory}
                                onChange={(e) => setCurrentCategory(e.target.value.toUpperCase())}
                                className="w-16 h-6 bg-transparent border-none text-[9px] font-bold text-blue-600 uppercase focus:ring-0 placeholder:text-blue-300"
                            />
                            <div className="h-3 w-px bg-blue-200 dark:bg-blue-800"></div>
                            <input
                                placeholder="NOMBRE" value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                className="w-24 h-6 bg-transparent border-none text-[9px] font-bold text-gray-600 dark:text-gray-300 focus:ring-0 placeholder:text-gray-400"
                            />
                            <Button
                                size="sm" onClick={saveTemplate}
                                disabled={saving || brochureData.items.length === 0}
                                className="h-6 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-bold rounded shadow-sm"
                            >
                                {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5 mr-1" />}
                                GUARDAR
                            </Button>
                        </div>

                        <Button
                            onClick={() => setPreviewMode(true)}
                            disabled={brochureData.items.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 text-[10px] font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105 ml-2"
                        >
                            Vista Previa
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30 dark:bg-gray-900/10 scrollbar-hide">
                    {brochureData.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 opacity-30">
                            <Layout className="h-12 w-12" />
                            <p className="text-sm font-medium uppercase tracking-widest">Lienzo Vacío</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
                            {brochureData.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative aspect-[4/5] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-indigo-500/50"
                                >
                                    <img src={item.imagen} className={`w-full h-full transition-transform duration-700 group-hover:scale-105 ${item.fitMode === 'contain' ? 'object-contain p-4' : 'object-cover'}`} alt="" />

                                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-90 translate-x-2 group-hover:translate-x-0">
                                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg bg-white/95 shadow-sm border border-gray-100" onClick={() => toggleFitMode(item.id)}>
                                            {item.fitMode === 'cover' ? <Maximize className="h-3.5 w-3.5 text-blue-600" /> : <Minimize2 className="h-3.5 w-3.5 text-blue-600" />}
                                        </Button>
                                        <Button variant="destructive" size="icon" className="h-7 w-7 rounded-lg bg-rose-500 shadow-sm text-white" onClick={() => removeItem(item.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <div className="absolute bottom-0 inset-x-0 p-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-700 translate-y-full group-hover:translate-y-0 transition-transform">
                                        <p className="text-[9px] font-bold text-gray-700 dark:text-gray-300 truncate uppercase tracking-tighter">{item.descripcion}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <datalist id="categories-list">
                {categories.map(c => <option key={c} value={c} />)}
            </datalist>
        </div>
    );
}
