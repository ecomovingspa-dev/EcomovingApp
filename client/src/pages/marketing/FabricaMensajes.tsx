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
            setMensaje("📤 Subiendo imagen a la nube...");

            // 1. Obtener el último nombre_envio para generar el siguiente número
            const { data: lastMsg } = await supabase
                .from("marketing")
                .select("nombre_envio")
                .order("nombre_envio", { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextNumber = (lastMsg?.nombre_envio || 0) + 1;
            const fileName = `diseno_${nextNumber}_${Date.now()}.jpg`;

            // 2. Convertir Base64 a Blob para subirlo como archivo real
            const base64Data = imagenOriginal.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            // 3. Subir al Bucket 'imagenes-marketing'
            const { error: uploadError } = await supabase.storage
                .from('imagenes-marketing')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 4. Obtener la URL Pública real
            const { data: { publicUrl } } = supabase.storage
                .from('imagenes-marketing')
                .getPublicUrl(fileName);

            setMensaje("💾 Guardando en biblioteca...");

            // 5. Reconstruir el HTML con diseño PREMIUM (Adiós efecto Excel)
            const finalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f9; padding-bottom: 40px; padding-top: 40px; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; color: #1a1a1b; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { padding: 40px 40px 20px; text-align: center; }
    .content { padding: 0 40px 40px; }
    .title { font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 24px; line-height: 1.2; letter-spacing: -0.02em; }
    .text-p { font-size: 17px; line-height: 1.7; color: #4b5563; margin-bottom: 30px; white-space: pre-line; }
    .product-image { width: 100%; max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 30px 0; }
    .footer { background-color: #ffffff; padding: 30px 40px; text-align: center; border-top: 1px solid #f3f4f6; }
    .brand { color: #4f46e5; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; display: block; }
    .tagline { color: #9ca3af; font-size: 13px; margin-bottom: 20px; display: block; }
    .legal { font-size: 11px; color: #d1d5db; line-height: 1.5; }
    a { color: #4f46e5; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main">
      <tr>
        <td class="header">
          <span class="brand">Ecomoving</span>
          <h1 class="title">${contenido.subject}</h1>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p class="text-p">${contenido.part1}</p>
          <img src="${publicUrl}" class="product-image" alt="Producto Ecomoving" />
          <p class="text-p">${contenido.part2}</p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <span class="tagline">Regalos Corporativos con Impacto Sustentable</span>
          <div class="legal">
            Recibiste este mensaje porque eres parte de nuestra red de contactos preferenciales.<br>
            <strong>Ecomoving SpA</strong> • Santiago, Chile
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`.trim();

            // 6. Insertar en la tabla con la URL Pública e ID secuencial
            const { error } = await supabase
                .from("marketing")
                .insert([{
                    nombre_envio: nextNumber,
                    asunto: contenido.subject,
                    cuerpo_html: finalHtml,
                    cuerpo: `${contenido.part1}\n\n${contenido.part2}`,
                    nombre_imagen: fileName,
                    imagen_url: publicUrl,
                    estado: "en revisión",
                    activo: true
                }]);

            if (error) throw error;

            setMensaje("✅ ¡Listo! Imagen guardada y vinculada correctamente.");
            setTimeout(() => {
                setMensaje("");
                onSave();
            }, 2000);
        } catch (err: any) {
            console.error(err);
            setMensaje("❌ Error: " + err.message);
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm aspect-square flex flex-col items-center justify-center relative">
                        {imagenOriginal ? (
                            <img src={imagenOriginal} className="w-full h-full object-contain p-4" alt="Vista previa" />
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
                </div>

                {/* Columna Derecha: Resultado Editable */}
                <div className="space-y-6">
                    {contenido ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5 shadow-sm h-full animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[650px] scrollbar-thin">

                            {/* Editor de Asunto */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                    <Edit3 className="h-3 w-3" /> Asunto del Email
                                </label>
                                <Input
                                    value={contenido.subject}
                                    onChange={(e) => setContenido({ ...contenido, subject: e.target.value })}
                                    className="bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-medium"
                                />
                            </div>

                            {/* Editor de Cuerpo (Partes) */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="h-3 w-3" /> Contenido del Correo
                                </label>

                                <div className="space-y-3 p-4 border border-indigo-50 dark:border-indigo-900/30 rounded-xl bg-indigo-50/20 dark:bg-indigo-900/10">
                                    <textarea
                                        value={contenido.part1}
                                        onChange={(e) => setContenido({ ...contenido, part1: e.target.value })}
                                        className="w-full bg-transparent border-none text-sm text-gray-700 dark:text-gray-300 italic resize-none focus:ring-0 p-0 min-h-[80px]"
                                        placeholder="Introducción..."
                                    />

                                    <div className="h-24 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg flex flex-col items-center justify-center text-gray-400 text-[10px] border border-dashed border-gray-300 dark:border-gray-600">
                                        <ImageIcon className="h-5 w-5 mb-1 opacity-20" />
                                        <span>[ LA IMAGEN SE INSERTARÁ AQUÍ ]</span>
                                    </div>

                                    <textarea
                                        value={contenido.part2}
                                        onChange={(e) => setContenido({ ...contenido, part2: e.target.value })}
                                        className="w-full bg-transparent border-none text-sm text-gray-700 dark:text-gray-300 resize-none focus:ring-0 p-0 min-h-[100px]"
                                        placeholder="Cierre y Llamado a la acción..."
                                    />
                                </div>
                            </div>

                            {/* Editor de Redes Sociales */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                    <ImageIcon className="h-3 w-3" /> Caption Redes Sociales
                                </label>
                                <textarea
                                    value={contenido.social}
                                    onChange={(e) => setContenido({ ...contenido, social: e.target.value })}
                                    className="w-full p-3 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/50 rounded-lg text-sm text-gray-600 dark:text-gray-400 min-h-[80px] focus:ring-indigo-500/20"
                                />
                            </div>

                            <p className="text-[10px] text-gray-400 italic text-center pt-2">
                                Puedes editar cualquier campo antes de guardar en la biblioteca.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 h-full flex flex-col items-center justify-center">
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
                    )}
                </div>

            </div>
        </div>
    );
}
