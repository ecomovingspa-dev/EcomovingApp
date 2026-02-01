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
    Type,
    Maximize,
    Minimize,
    Search,
    ExternalLink,
    RefreshCw
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { generateMarketingContent, GeneratedContent } from "../../lib/gemini";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";

export default function FabricaMensajes({ onSave }: { onSave: () => void }) {
    // States for Storage Explorer
    const [images, setImages] = useState<{ name: string; url: string }[]>([]);
    const [loadingStorage, setLoadingStorage] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"images" | "templates">("images");
    const [activeImage, setActiveImage] = useState<{ name: string; url: string } | null>(null);

    // States for Content Generation
    const [procesando, setProcesando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [contenido, setContenido] = useState<GeneratedContent | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
    const [textStyles, setTextStyles] = useState({
        fontFamily: "'Oswald', sans-serif",
        fontSize: "21px",
        textAlign: "center"
    });
    const [tono, setTono] = useState("profesional");
    const [subiendoImagen, setSubiendoImagen] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("productos");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Categorías disponibles para organizar imágenes
    const CATEGORIAS_IMAGEN = [
        { value: "productos", label: "🛍️ Productos" },
        { value: "campañas", label: "📢 Campañas" },
        { value: "branding", label: "🎨 Branding" },
        { value: "redes-sociales", label: "📱 Redes Sociales" },
        { value: "sin-categoria", label: "📁 Sin Categoría" }
    ];

    useEffect(() => {
        fetchStorageImages();
    }, []);

    const fetchStorageImages = async () => {
        try {
            setLoadingStorage(true);
            const { data: files, error } = await supabase.storage.from('imagenes-marketing').list('', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'desc' }
            });

            if (error) throw error;

            if (files) {
                const formatted = files
                    .filter(f => f.name !== '.emptyFolderPlaceholder' && !f.name.endsWith('.json'))
                    .map(f => ({
                        name: f.name,
                        url: supabase.storage.from('imagenes-marketing').getPublicUrl(f.name).data.publicUrl
                    }));
                setImages(formatted);
            }
        } catch (err) {
            console.error("Error cargando imagenes:", err);
            setMensaje("❌ Error al conectar con Storage");
        } finally {
            setLoadingStorage(false);
        }
    };

    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const generarConIA = async () => {
        if (!activeImage) return;
        try {
            setProcesando(true);
            setMensaje("🤖 Gemini está analizando tu producto en tono " + tono + "...");

            // Re-adjuntamos las instrucciones de formato junto con el tono para que la IA no las pierda
            const promptMaestro = `
Analiza el producto en la imagen y genera una copia de marketing profesional en ESPAÑOL usando un TONO ${tono.toUpperCase()}.

${tono === 'creativo' ? 'Instrucciones de tono: Sé audaz, usa metáforas y despierta la imaginación del cliente.' : ''}
${tono === 'elegante' ? 'Instrucciones de tono: Usa un lenguaje refinado, sofisticado, minimalista y exclusivo.' : ''}
${tono === 'agresivo' ? 'Instrucciones de tono: Enfócate mucho en la urgencia, beneficios directos, ganchos comerciales potentes y cierre rápido.' : ''}
${tono === 'profesional' ? 'Instrucciones de tono: Mantén un lenguaje equilibrado, corporativo, basado en la confianza y calidad.' : ''}

Formatea tu respuesta exactamente de esta manera (sin usar Markdown ni asteriscos en las etiquetas):
SUBJECT: [Un asunto corto y enganchador, SIN mencionar marcas específicas]
PART1: [Párrafo introductorio de 2-3 líneas]
PART2: [Párrafo de cierre o llamado a la acción de 2-3 líneas]
SOCIAL: [Caption sugerido para redes sociales con emojis]

Reglas CRÍTICAS:
- NO menciones ninguna MARCA, NOMBRE o LOGO que aparezca en el producto de la imagen (ej: si dice BACH, no digas BACH).
- Los logos en la imagen pertenecen a clientes previos; tu objetivo es vender el PRODUCTO (ej: la mochila, el set, la botella), no la marca que lleva impresa.
- Céntrate en la calidad del producto, su utilidad y el impacto de los regalos corporativos sustentables de Ecomoving.
- No inventes precios.
- Responde solo con las etiquetas mencionadas.
            `;

            const result = await generateMarketingContent(activeImage.url, promptMaestro);
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

    // Paso 1: Cuando el usuario selecciona un archivo, abrir diálogo de categoría
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setUploadDialogOpen(true);
    };

    // Paso 2: Subir con la categoría seleccionada
    const handleFileUpload = async () => {
        if (!pendingFile) return;

        try {
            setSubiendoImagen(true);
            setUploadDialogOpen(false);
            setMensaje("📤 Subiendo imagen a Supabase...");

            // Obtener el siguiente número disponible en la categoría
            const folderPath = selectedCategory === 'sin-categoria' ? '' : `${selectedCategory}/`;
            const { data: existingFiles } = await supabase.storage
                .from('imagenes-marketing')
                .list(folderPath || '', { limit: 500 });

            let maxNumber = 0;
            if (existingFiles) {
                existingFiles.forEach(f => {
                    const match = f.name.match(/^imagen_(\d+)\.(jpg|jpeg|png|webp)$/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNumber) maxNumber = num;
                    }
                });
            }

            const nextNumber = maxNumber + 1;
            const fileName = `imagen_${nextNumber}.jpg`;
            const fullPath = folderPath ? `${folderPath}${fileName}` : fileName;

            const { error: uploadError } = await supabase.storage
                .from('imagenes-marketing')
                .upload(fullPath, pendingFile, {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const categoryLabel = CATEGORIAS_IMAGEN.find(c => c.value === selectedCategory)?.label || selectedCategory;
            setMensaje(`✅ Subida exitosa: ${categoryLabel} / ${fileName}`);
            fetchStorageImages();

            const publicUrl = supabase.storage.from('imagenes-marketing').getPublicUrl(fullPath).data.publicUrl;
            setActiveImage({ name: fileName, url: publicUrl });
            setContenido(null);
            setPendingFile(null);

            setTimeout(() => setMensaje(""), 4000);
        } catch (err: any) {
            console.error("Error al subir:", err);
            setMensaje("❌ Error al subir: " + err.message);
        } finally {
            setSubiendoImagen(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const generarHtmlFinal = () => {
        if (!contenido || !activeImage) return "";

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: ${textStyles.fontFamily}; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f9; padding-bottom: 20px; padding-top: 20px; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; color: #1a1a1b; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { padding: 40px 40px 20px; text-align: center; }
    .content { padding: 0 40px 40px; }
    .title { font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 24px; line-height: 1.2; letter-spacing: -0.02em; text-align: center; }
    .text-p { font-size: ${textStyles.fontSize}; line-height: 1.7; color: #4b5563; margin-bottom: 30px; white-space: pre-line; text-align: center; display: block; width: 100%; }
    .product-image { width: 100%; max-width: 480px; height: auto; border-radius: 12px; display: block; margin: 35px auto; object-fit: ${fitMode}; ${fitMode === 'cover' ? 'height: 400px;' : ''} }
    .footer { background-color: #ffffff; padding: 30px 40px; text-align: center; border-top: 1px solid #f3f4f6; }
    .logo-container { text-align: center; margin-bottom: 25px; }
    .brand-logo { width: 231px; height: auto; display: inline-block; }
    .legal { font-size: 13px; color: #4b5563; line-height: 1.5; font-weight: 400; }
    a { color: #4f46e5; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main">
      <tr>
        <td class="header">
          <div class="logo-container">
            <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" width="231" class="brand-logo" alt="Ecomoving" />
          </div>
          <h1 class="title">${contenido.subject}</h1>
        </td>
      </tr>
      <tr>
        <td class="content" align="center" style="text-align: center;">
          <p class="text-p" align="center" style="text-align: center; margin-left: auto; margin-right: auto;">${contenido.part1.trim()}</p>
          <img src="${activeImage.url}" class="product-image" alt="Producto Ecomoving" />
          <p class="text-p" align="center" style="text-align: center; margin-left: auto; margin-right: auto;">${contenido.part2.trim()}</p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <div class="legal">
            Recibiste este mensaje porque eres parte de nuestra red de contactos preferenciales.<br>
            <strong>Ecomoving SpA</strong> • Santiago, Chile<br><br>
            <span style="font-weight: 600;">www.ecomoving.cl - +56 9 7958 7293 / +56 9 9392 46386</span>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`.trim();
    };

    const guardarMensaje = async () => {
        if (!contenido || !activeImage) return;

        try {
            setGuardando(true);
            setMensaje("💾 Guardando en biblioteca...");

            // Obtenemos el numero correlativo
            const { data: lastMsg } = await supabase
                .from("marketing")
                .select("nombre_envio")
                .order("nombre_envio", { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextNumber = (lastMsg?.nombre_envio || 0) + 1;
            const finalHtml = generarHtmlFinal();

            const { error } = await supabase
                .from("marketing")
                .insert([{
                    nombre_envio: nextNumber,
                    asunto: contenido.subject,
                    cuerpo_html: finalHtml,
                    cuerpo: `${contenido.part1}\n\n${contenido.part2}`,
                    nombre_imagen: activeImage.name,
                    imagen_url: activeImage.url,
                    estado: "en revisión",
                    activo: true
                }]);

            if (error) {
                console.error("DEBUG DB ERROR:", error);
                throw error;
            }

            setMensaje("✅ ¡Listo! Mensaje guardado correctamente.");
            setTimeout(() => {
                setMensaje("");
                onSave();
            }, 2000);
        } catch (err: any) {
            console.error("ERROR DETALLADO:", err);
            setMensaje("❌ Error al guardar: " + err.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-160px)] min-h-[600px] overflow-hidden">

                {/* COLUMNA 1: EXPLORADOR DE MEDIOS (IZQUIERDA) */}
                <div className="w-full lg:w-72 bg-white/40 dark:bg-[#1e293b]/50 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col shadow-xl overflow-hidden">

                    {/* Tabs Estilo Brochures */}
                    <div className="flex border-b border-white/5 p-1 bg-black/20">
                        <button
                            onClick={() => setActiveTab("images")}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'images' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            IMÁGENES
                        </button>
                        <button
                            onClick={() => setActiveTab("templates")}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'templates' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            PLANTILLAS
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon className="h-3 w-3" />
                                Media Explorer
                            </h3>
                            <RefreshCw
                                onClick={fetchStorageImages}
                                className={`h-3 w-3 text-gray-500 cursor-pointer hover:text-white transition-colors ${loadingStorage ? 'animate-spin' : ''}`}
                            />
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                            <Input
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 text-xs bg-black/20 border-white/5 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white placeholder:text-gray-600 rounded-xl"
                            />
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="image/*"
                        />
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={subiendoImagen}
                            className="w-full h-10 border-dashed border-indigo-500/30 bg-indigo-50/5 hover:bg-indigo-50/10 text-indigo-400 text-[10px] font-bold gap-2 rounded-xl transition-all"
                        >
                            {subiendoImagen ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>+ CARGAR IMAGEN</span>}
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 pt-0 scrollbar-thin">
                        {activeTab === 'images' ? (
                            <div className="grid grid-cols-2 gap-2">
                                {loadingStorage ? (
                                    <div className="col-span-2 flex flex-col items-center justify-center py-20 text-gray-400">
                                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                        <span className="text-[10px] uppercase font-bold">Cargando...</span>
                                    </div>
                                ) : filteredImages.length > 0 ? (
                                    filteredImages.map((img) => (
                                        <div
                                            key={img.name}
                                            onClick={() => {
                                                setActiveImage(img);
                                                setContenido(null);
                                            }}
                                            className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-300 ${activeImage?.name === img.name
                                                ? 'border-indigo-500 shadow-lg scale-[0.98]'
                                                : 'border-transparent hover:border-gray-300 dark:hover:border-white/10'
                                                }`}
                                        >
                                            <img src={img.url} className="w-full h-full object-cover" alt={img.name} />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
                                                <p className="text-[8px] text-white font-bold uppercase truncate w-full">{img.name}</p>
                                            </div>
                                            {activeImage?.name === img.name && (
                                                <div className="absolute top-1 right-1">
                                                    <div className="bg-indigo-500 text-white p-0.5 rounded-full shadow-lg">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 text-center py-12 text-gray-400">
                                        <p className="text-xs">No hay imágenes</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center gap-2">
                                <Sparkles className="h-8 w-8 opacity-20" />
                                <span className="text-[10px] uppercase font-bold opacity-50">Plantillas</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMNA 2: VISTA PREVIA Y CONTROLES IA (CENTRO) */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden h-full relative">

                        {/* Status Bar / Mensajes */}
                        {mensaje && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-2 animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
                                {mensaje.includes("❌") ? <AlertCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{mensaje}</span>
                            </div>
                        )}

                        {/* Controles de Generación Superior */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <h2 className="text-xs font-bold text-gray-900 dark:text-white">Generador IA</h2>
                            </div>

                            <div className="flex items-center gap-2">
                                <Select value={tono} onValueChange={setTono}>
                                    <SelectTrigger className="h-8 w-28 text-[10px] bg-white dark:bg-gray-800">
                                        <SelectValue placeholder="Tono" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="profesional">🎩 Profesional</SelectItem>
                                        <SelectItem value="creativo">🎨 Creativo</SelectItem>
                                        <SelectItem value="elegante">💎 Elegante</SelectItem>
                                        <SelectItem value="agresivo">🚀 Comercial</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button
                                    onClick={generarConIA}
                                    disabled={procesando || !activeImage}
                                    size="sm"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 text-[10px] font-bold shadow-sm"
                                >
                                    {procesando ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                                    GENERAR
                                </Button>
                            </div>
                        </div>

                        {/* Area de Imagen */}
                        <div className="flex-1 relative flex items-center justify-center bg-gray-50 dark:bg-gray-900/30 min-h-0">
                            {activeImage ? (
                                <>
                                    <img
                                        src={activeImage.url}
                                        className={`w-full h-full transition-all duration-300 ${fitMode === 'cover' ? 'object-cover' : 'object-contain p-6'}`}
                                        alt="Producto seleccionado"
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-8 w-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full shadow-md border-none text-gray-700 dark:text-white hover:bg-white dark:hover:bg-gray-700"
                                            onClick={() => setFitMode(fitMode === 'cover' ? 'contain' : 'cover')}
                                        >
                                            {fitMode === 'cover' ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md text-[9px] text-white font-medium border border-white/10 truncate max-w-[200px]">
                                        {activeImage.name}
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 p-8 text-center opacity-40">
                                    <ImageIcon className="h-10 w-10 text-gray-400" />
                                    <p className="text-xs font-medium text-gray-500">Selecciona una imagen para comenzar</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMNA 3: PANEL DE EDITOR Y ACCIONES (DERECHA) */}
                <div className="w-full lg:w-[420px] flex flex-col gap-4 overflow-hidden">
                    {contenido ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full shadow-xl animate-in slide-in-from-right-4 duration-300 overflow-hidden">

                            {/* Cabecera Editor */}
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                                        <Save className="h-4 w-4" />
                                    </div>
                                    <h2 className="text-xs font-bold text-gray-900 dark:text-white">Editor</h2>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-[10px] font-bold dark:bg-gray-800"
                                        onClick={() => setPreviewOpen(true)}
                                    >
                                        <Eye className="h-3 w-3 mr-1" /> VISTA PREVIA
                                    </Button>
                                    <Button
                                        onClick={guardarMensaje}
                                        disabled={guardando}
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-[10px] font-bold"
                                    >
                                        {guardando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                        GUARDAR
                                    </Button>
                                </div>
                            </div>

                            {/* Contenido del Editor */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">

                                {/* Asunto */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Edit3 className="h-3 w-3 text-indigo-500" /> Asunto del Email
                                    </label>
                                    <Input
                                        value={contenido.subject}
                                        onChange={(e) => setContenido({ ...contenido, subject: e.target.value })}
                                        className="bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 text-sm font-bold h-9"
                                    />
                                </div>

                                {/* Formato de Texto */}
                                <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <Select value={textStyles.fontFamily} onValueChange={(v) => setTextStyles({ ...textStyles, fontFamily: v })}>
                                        <SelectTrigger className="h-7 flex-1 text-[10px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="'Helvetica Neue', Helvetica, Arial, sans-serif">Sans-Serif</SelectItem>
                                            <SelectItem value="Georgia, serif">Serif Elegante</SelectItem>
                                            <SelectItem value="'Oswald', sans-serif">Moderno</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={textStyles.fontSize} onValueChange={(v) => setTextStyles({ ...textStyles, fontSize: v })}>
                                        <SelectTrigger className="h-7 w-20 text-[10px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="14px">P</SelectItem>
                                            <SelectItem value="17px">M</SelectItem>
                                            <SelectItem value="21px">G</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Cuerpo Email */}
                                <div className="space-y-3 p-3 border border-indigo-50 dark:border-indigo-900/20 rounded-xl bg-indigo-50/10 dark:bg-indigo-900/5">
                                    <textarea
                                        value={contenido.part1}
                                        onChange={(e) => setContenido({ ...contenido, part1: e.target.value })}
                                        className="w-full bg-transparent border-none text-[13px] leading-relaxed text-gray-600 dark:text-gray-300 italic resize-none focus:ring-0 p-0 min-h-[70px]"
                                        placeholder="Párrafo 1..."
                                    />

                                    <div className="py-2 px-3 bg-white/50 dark:bg-black/20 rounded border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 text-[10px] text-gray-400">
                                        <ImageIcon className="h-3 w-3 opacity-50" />
                                        <span>POSICIÓN DE IMAGEN</span>
                                    </div>

                                    <textarea
                                        value={contenido.part2}
                                        onChange={(e) => setContenido({ ...contenido, part2: e.target.value })}
                                        className="w-full bg-transparent border-none text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 resize-none focus:ring-0 p-0 min-h-[80px]"
                                        placeholder="Párrafo 2..."
                                    />
                                </div>

                                {/* Social Caption */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <ImageIcon className="h-3 w-3 text-emerald-500" /> Social Caption
                                    </label>
                                    <textarea
                                        value={contenido.social}
                                        onChange={(e) => setContenido({ ...contenido, social: e.target.value })}
                                        className="w-full p-3 bg-emerald-50/20 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20 rounded-xl text-xs text-gray-600 dark:text-gray-400 min-h-[60px] focus:ring-1 focus:ring-emerald-200 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-3 border-t border-gray-100 dark:border-gray-800 text-center">
                                <p className="text-[10px] text-gray-400 italic">Revisa y ajusta los textos antes de guardar.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50/50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center h-full opacity-60">
                            <Sparkles className="h-10 w-10 text-indigo-300 mb-4" />
                            <h4 className="text-sm font-bold text-gray-400">Panel de Edición</h4>
                            <p className="text-[10px] text-gray-400 mt-2 max-w-[200px]">El contenido generado por la IA aparecerá aquí.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE VISTA PREVIA (DASHBOARD STYLE) */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden bg-gray-100 dark:bg-gray-950 flex flex-col border-none shadow-2xl">
                    <DialogHeader className="p-4 border-b bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 flex flex-row items-center justify-between space-y-0">
                        <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white text-base">
                            <Eye className="h-5 w-5 text-indigo-600" />
                            Vista Previa del Email
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-gray-200/50 dark:bg-black/40 p-4 md:p-8 overflow-y-auto flex justify-center">
                        <div className="w-full max-w-[600px] bg-white shadow-2xl rounded-lg overflow-hidden h-fit">
                            <iframe
                                title="Email Preview"
                                srcDoc={generarHtmlFinal()}
                                className="w-full min-h-[700px] border-none"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                            Cerrar
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={guardarMensaje}>
                            <Save className="h-4 w-4 mr-2" /> Guardar Ahora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL DE SELECCIÓN DE CATEGORÍA PARA SUBIDA */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                            <ImageIcon className="h-5 w-5 text-indigo-600" />
                            Subir Imagen
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {pendingFile && (
                            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg flex items-center gap-3">
                                <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {pendingFile.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {(pendingFile.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Categoría de la imagen
                            </label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                                    <SelectValue placeholder="Selecciona categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS_IMAGEN.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">
                                Se guardará como: {selectedCategory}/imagen_X.jpg
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setUploadDialogOpen(false);
                                setPendingFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={handleFileUpload}
                            disabled={subiendoImagen}
                        >
                            {subiendoImagen ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Subir Imagen
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
