import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import {
    Plus,
    Trash2,
    Download,
    Layout,
    Image as ImageIcon,
    FileText,
    ChevronRight,
    Loader2,
    Check
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
    const [loading, setLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    // Brochure State
    const [brochureData, setBrochureData] = useState({
        numero_cotizacion: "B-2026",
        cuenta: { cliente: "CLIENTE PREMIUM" },
        items: [] as BrochureItem[]
    });

    useEffect(() => {
        fetchStorageImages();
    }, []);

    const fetchStorageImages = async () => {
        try {
            setLoading(true);
            // Intentamos listar de varios buckets comunes
            const { data: files, error } = await supabase.storage.from('productos').list('', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'desc' }
            });

            if (error) throw error;

            const formattedImages = files.map(file => ({
                name: file.name,
                url: supabase.storage.from('productos').getPublicUrl(file.name).data.publicUrl
            }));

            setImages(formattedImages);
        } catch (err) {
            console.error("Error fetching images:", err);
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
            subcostos: [{ valor: 10000 }] // Valor base ficticio
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
        return <BrochureView cotizacion={brochureData as any} onBack={() => setPreviewMode(false)} />;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
            {/* Sidebar: Storage Explorer */}
            <div className="w-full lg:w-80 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" /> Media Storage
                    </h3>
                    <Button variant="ghost" size="sm" onClick={fetchStorageImages}>
                        <Loader2 className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
                    {images.length === 0 && !loading && (
                        <div className="text-center py-8 text-gray-400 text-xs italic">
                            No hay imágenes en el bucket 'productos'.
                        </div>
                    )}
                    {images.map((img, idx) => (
                        <div
                            key={idx}
                            className="group relative aspect-square lg:aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-transparent hover:border-indigo-500 cursor-pointer transition-all"
                            onClick={() => addItem(img.url, img.name)}
                        >
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Plus className="text-white h-6 w-6" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-[10px] text-white truncate font-medium">{img.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Canvas: Brochure Builder */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col shadow-sm overflow-hidden">
                <header className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                            <Layout className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Fábrica de Brochures</h2>
                            <p className="text-xs text-gray-500">Diseña presentaciones premium arrastrando imágenes.</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="gap-2"
                            disabled={brochureData.items.length === 0}
                            onClick={() => setPreviewMode(true)}
                        >
                            <FileText className="h-4 w-4" /> Vista Previa
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                            disabled={brochureData.items.length === 0}
                        >
                            <Download className="h-4 w-4" /> Exportar
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30 dark:bg-gray-900/10">
                    {/* Header Editor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black text-gray-400">Título de la Campaña</label>
                            <Input
                                value={brochureData.numero_cotizacion}
                                onChange={(e) => setBrochureData(prev => ({ ...prev, numero_cotizacion: e.target.value }))}
                                className="bg-white dark:bg-gray-800"
                                placeholder="Ej: Colección Verano 2026"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black text-gray-400">Nombre del Cliente</label>
                            <Input
                                value={brochureData.cuenta.cliente}
                                onChange={(e) => setBrochureData(prev => ({ ...prev, cuenta: { cliente: e.target.value } }))}
                                className="bg-white dark:bg-gray-800"
                                placeholder="Ej: Empresa de Logística SpA"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-700"></div>

                    {/* Selected Items Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {brochureData.items.length === 0 && (
                            <div className="col-span-full py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <ImageIcon className="h-12 w-12 opacity-20" />
                                <p className="text-sm">Agrega imágenes desde la galería lateral para comenzar</p>
                            </div>
                        )}
                        {brochureData.items.map((item, idx) => (
                            <div key={item.id} className="group relative bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8 rounded-full shadow-lg"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4">
                                    <img src={item.imagen} alt="" className="w-full h-full object-cover" />
                                </div>

                                <Input
                                    value={item.descripcion}
                                    onChange={(e) => {
                                        const newItems = [...brochureData.items];
                                        newItems[idx].descripcion = e.target.value;
                                        setBrochureData(prev => ({ ...prev, items: newItems }));
                                    }}
                                    className="border-transparent bg-transparent focus:bg-white dark:focus:bg-gray-800 text-sm font-bold p-0 px-2 h-8"
                                    placeholder="Descripción del producto..."
                                />

                                <div className="flex items-center gap-2 mt-2 px-2">
                                    <label className="text-[10px] font-bold text-gray-400">ORDEN: {idx + 1}</label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
