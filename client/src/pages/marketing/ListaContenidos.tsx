import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
    Mail,
    Trash2,
    Eye,
    Plus,
    ChevronRight,
    Library,
    Loader2,
    AlertCircle,
    Send,
    Edit3,
    Wand2,
    Sparkles,
    Check,
    Image as ImageIcon
} from "lucide-react";
import { Button } from "../../components/ui/button";

import { generateMarketingContent } from "../../lib/gemini";

interface MarketingMessage {
    id: string;
    asunto: string;
    cuerpo_html: string;
    cuerpo: string;
    nombre_envio: number;
    nombre_imagen?: string;
    imagen_url?: string;
    estado?: string;
    activo?: boolean;
    created_at?: string;
}

export default function ListaContenidos() {
    const [mensajes, setMensajes] = useState<MarketingMessage[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [editandoUrl, setEditandoUrl] = useState<string | null>(null);
    const [urlTemporal, setUrlTemporal] = useState("");
    const [mostrarNuevo, setMostrarNuevo] = useState(false);
    const [mostrarIA, setMostrarIA] = useState(false);
    const [nuevoAsunto, setNuevoAsunto] = useState("");
    const [nuevoContenido, setNuevoContenido] = useState("");
    const [promptIA, setPromptIA] = useState("");
    const [creando, setCreando] = useState(false);
    const [generandoIA, setGenerandoIA] = useState(false);

    useEffect(() => {
        cargarMensajes();
    }, []);

    const cargarMensajes = async () => {
        try {
            setCargando(true);
            const { data, error: dbError } = await supabase
                .from("marketing")
                .select("*")
                .order("nombre_envio", { ascending: true }); // Ordenar por secuencia

            if (dbError) throw dbError;
            setMensajes(data || []);
        } catch (err: any) {
            console.error("Error cargando mensajes:", err);
            setError("No se pudo cargar la biblioteca de contenidos.");
        } finally {
            setCargando(false);
        }
    };

    const crearContenido = async () => {
        if (!nuevoAsunto || !nuevoContenido) {
            alert("⚠️ Por favor completa el asunto y el contenido.");
            return;
        }

        try {
            setCreando(true);
            const timestamp = Date.now();
            const nombreImagen = `MKT-${timestamp}.jpg`;
            const imagenUrl = `https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/imagenes-marketing/${nombreImagen}`;
            const siguienteEnvio = mensajes.length > 0
                ? Math.max(...mensajes.map(m => m.nombre_envio)) + 1
                : 1;

            // Extraer título y párrafo para el HTML
            const lineas = nuevoContenido.split('\n').filter(l => l.trim() !== '');
            const titulo = lineas[0] || "ECOMOVING";
            const resto = lineas.slice(1).join('<br><br>');

            const { data, error: dbError } = await supabase
                .from("marketing")
                .insert([{
                    asunto: nuevoAsunto,
                    cuerpo: nuevoContenido,
                    nombre_envio: siguienteEnvio,
                    nombre_imagen: nombreImagen,
                    imagen_url: imagenUrl,
                    cuerpo_html: `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;700;900&display=swap');
        body { margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Outfit', sans-serif; color: #1a1a1a; }
        .wrapper { width: 100%; background-color: #f9f9f9; padding: 40px 0; }
        .main-container { width: 900px; background-color: #ffffff; border: 1px solid #eeeeee; border-radius: 8px; margin: 0 auto; }
        .h1 { font-size: 26px; font-weight: 800; line-height: 1.2; text-align: center; color: #000000; text-transform: uppercase; margin: 50px 0; }
        .p { font-size: 19px; line-height: 1.6; color: #333333; font-weight: 300; text-align: center; margin: 0 80px 50px; }
        .footer { padding: 50px; background-color: #fafafa; border-top: 1px solid #f0f0f0; text-align: center; font-size: 15px; color: #999999; }
    </style>
</head>
<body>
    <center class="wrapper">
        <table class="main-container" width="900" border="0" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding: 50px 0;">
                <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" alt="Ecomoving" width="250" />
            </td></tr>
            <tr><td align="center"><h1 class="h1">${titulo}</h1></td></tr>
            <tr><td align="center" style="padding-bottom: 50px;">
                <img src="${imagenUrl}" alt="Ecomoving" width="650" style="width: 650px; display: block; border-radius: 4px;" />
            </td></tr>
            <tr><td align="center"><p class="p">${resto}</p></td></tr>
            <tr><td align="center" style="padding-bottom: 50px;">
                <table style="background-color: #000000;">
                    <tr><td style="padding: 12px 40px;">
                        <a href="https://www.ecomoving.cl" style="color: #ffffff; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 3px;">EXPLORAR PORTAFOLIO</a>
                    </td></tr>
                </table>
            </td></tr>
            <tr><td class="footer">ECOMOVING SPA &bull; SANTIAGO, CHILE<br><br>ventas@ecomoving.cl</td></tr>
        </table>
    </center>
</body>
</html>`,
                    estado: 'en revisión',
                    activo: true
                }])
                .select();

            if (dbError) throw dbError;

            if (data) {
                setMensajes([...mensajes, data[0]]);
                setMostrarNuevo(false);
                setNuevoAsunto("");
                setNuevoContenido("");
                alert("✅ Contenido creado con éxito.");
            }
        } catch (err: any) {
            alert("❌ Error: " + err.message);
        } finally {
            setCreando(false);
        }
    };

    const pruebaEnvio = async (msg: MarketingMessage) => {
        if (!msg.imagen_url) {
            alert("⚠️ Debes agregar una URL de imagen primero.");
            return;
        }

        const emailDestino = prompt("Ingresa el correo para recibir la prueba:", "ventas@ecomoving.cl");
        if (!emailDestino) return;

        try {
            // Feedback simple pero efectivo
            const btn = document.activeElement as HTMLButtonElement;
            const originalIcon = btn.innerHTML;
            btn.innerHTML = "⏳";
            btn.disabled = true;

            const response = await fetch('/api/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: msg.id,
                    targetEmail: emailDestino
                })
            });

            const result = await response.json();

            if (!response.ok) {
                let errorMsg = result.error || "Error al enviar";
                if (result.details) {
                    errorMsg += `\nDetalles: ${JSON.stringify(result.details, null, 2)}`;
                }
                throw new Error(errorMsg);
            }

            alert("✅ ¡Correo de prueba enviado con éxito!");
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        } catch (err: any) {
            console.error("Error envío prueba:", err);
            alert("❌ Error: " + err.message);
            // Restaurar botón si falla
            const btn = document.activeElement as HTMLButtonElement;
            if (btn) {
                btn.innerHTML = "<svg...>"; // Simplificado, mejor refrescar o dejar como estaba
                window.location.reload();
            }
        }
    };

    const eliminarMensaje = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este mensaje de la secuencia?")) return;

        try {
            const { error: dbError } = await supabase
                .from("marketing")
                .delete()
                .eq("id", id);

            if (dbError) throw dbError;
            setMensajes(mensajes.filter(m => m.id !== id));
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    const guardarUrl = async (id: string) => {
        try {
            const { error: dbError } = await supabase
                .from("marketing")
                .update({ imagen_url: urlTemporal })
                .eq("id", id);

            if (dbError) throw dbError;

            setMensajes(mensajes.map(m =>
                m.id === id ? { ...m, imagen_url: urlTemporal } : m
            ));
            setEditandoUrl(null);
            setUrlTemporal("");
        } catch (err: any) {
            alert("Error al guardar URL: " + err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Library className="h-5 w-5 text-indigo-500" />
                        Biblioteca de Contenidos
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Secuencia programada de correos automatizados.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setMostrarIA(!mostrarIA);
                            setMostrarNuevo(false);
                        }}
                        className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2 shadow-lg shadow-violet-500/20 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95"
                    >
                        <Wand2 className="h-5 w-5" />
                        Generación Mágica
                    </button>
                    <button
                        onClick={() => {
                            setMostrarNuevo(!mostrarNuevo);
                            setMostrarIA(false);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-lg shadow-emerald-500/20 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95"
                    >
                        <Plus className="h-5 w-5" />
                        Nuevo Contenido
                    </button>
                </div>
            </div>

            {/* Modal de IA (Generación Mágica) */}
            {mostrarIA && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border-2 border-violet-100 dark:border-violet-900/50 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-violet-900 dark:text-violet-100 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-violet-500" />
                                Inteligencia Artificial Ecomoving
                            </h3>
                            <button onClick={() => setMostrarIA(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Describe el tema o producto y la IA creará el contenido completo por ti.</p>
                        <div className="relative">
                            <textarea
                                value={promptIA}
                                onChange={(e) => setPromptIA(e.target.value)}
                                placeholder="Ej: Crea un correo elegante sobre nuestras nuevas soluciones de mobiliario sostenible para oficinas modernas..."
                                className="w-full h-32 px-4 py-3 rounded-lg bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none transition-all resize-none"
                            />
                        </div>
                        <button
                            onClick={async () => {
                                if (!promptIA.trim()) return;
                                setGenerandoIA(true);
                                try {
                                    // Usar la librería gemini.ts para generar
                                    // Pasamos una imagen dummy o vacía ya que ListaContenidos no maneja imagen de entrada ahora
                                    const result = await generateMarketingContent("", promptIA);
                                    
                                    // Guardar directamente en la base de datos
                                    const siguienteEnvio = mensajes.length > 0
                                        ? Math.max(...mensajes.map(m => m.nombre_envio)) + 1
                                        : 1;

                                    const { data, error: dbError } = await supabase
                                        .from("marketing")
                                        .insert([{
                                            asunto: result.subject,
                                            cuerpo: `${result.part1}\n\n${result.part2}`,
                                            cuerpo_html: result.html,
                                            nombre_envio: siguienteEnvio,
                                            estado: 'en revisión',
                                            activo: true
                                        }])
                                        .select();

                                    if (dbError) throw dbError;
                                    if (data) {
                                        setMensajes([...mensajes, data[0]]);
                                        setMostrarIA(false);
                                        setPromptIA("");
                                        alert("✨ ¡Contenido generado y guardado!");
                                    }
                                } catch (err: any) {
                                    alert("❌ Error IA: " + err.message);
                                } finally {
                                    setGenerandoIA(false);
                                }
                            }}
                            disabled={generandoIA}
                            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold h-12 shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2 rounded-xl"
                        >
                            {generandoIA ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    Generar y Guardar a la Biblioteca
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {mostrarNuevo && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-indigo-100 dark:border-indigo-900/50 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Plus className="h-5 w-5 text-indigo-500" />
                                Crear Nuevo Contenido
                            </h3>
                            <button onClick={() => setMostrarNuevo(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>

                        <div className="grid gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Asunto del Correo</label>
                                <input
                                    type="text"
                                    value={nuevoAsunto}
                                    onChange={(e) => setNuevoAsunto(e.target.value)}
                                    placeholder="Ej: Hidratación Sostenible Corporativa"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contenido (Título y Párrafo)</label>
                                <textarea
                                    value={nuevoContenido}
                                    onChange={(e) => setNuevoContenido(e.target.value)}
                                    placeholder="Primera línea: Título Principal&#10;Siguientes líneas: Cuerpo del mensaje"
                                    className="w-full h-40 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 pt-4">
                            <Button
                                onClick={crearContenido}
                                disabled={creando}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 shadow-lg shadow-emerald-500/20"
                            >
                                {creando ? (
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                ) : (
                                    "Guardar en la Biblioteca"
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setMostrarNuevo(false)}
                                className="h-12 px-8 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-2 border border-red-100 dark:border-red-800">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {cargando ? (
                    <div className="py-20 text-center">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-500 opacity-50 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Sincronizando biblioteca...</p>
                    </div>
                ) : mensajes.length === 0 ? (
                    <div className="py-20 text-center">
                        <Mail className="h-16 w-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">La secuencia está vacía.</p>

                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20 text-center">ID</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">Asunto</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Archivo</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">Imagen Supabase (URL)</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contenido</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-24">Vista</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right w-36">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {mensajes.map((msg) => (
                                    <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                        <td className="px-4 py-4">
                                            <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
                                                {msg.nombre_envio}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {msg.asunto}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4">
                                            {msg.nombre_imagen ? (
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                                    <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span className="font-mono text-xs truncate">{msg.nombre_imagen}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 min-w-[240px]">
                                            {editandoUrl === msg.id ? (
                                                <div className="flex flex-col gap-2 animate-in slide-in-from-top-1">
                                                    <textarea
                                                        value={urlTemporal}
                                                        onChange={(e) => setUrlTemporal(e.target.value)}
                                                        placeholder="Pega la URL pública de Supabase..."
                                                        className="w-full px-3 py-2 text-[11px] font-mono border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none shadow-inner"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => guardarUrl(msg.id)}
                                                            className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-sm active:scale-95"
                                                        >
                                                            Guardar URL
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditandoUrl(null);
                                                                setUrlTemporal("");
                                                            }}
                                                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs font-bold transition-all"
                                                        >
                                                            X
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditandoUrl(msg.id);
                                                        setUrlTemporal(msg.imagen_url || "");
                                                    }}
                                                    className="group relative w-full h-auto min-h-[48px] flex items-center px-3 bg-gray-50/50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-left transition-all hover:border-indigo-400/50 hover:bg-indigo-50/30 overflow-hidden py-2"
                                                >
                                                    <div className="w-full pr-6 break-all whitespace-normal">
                                                        {msg.imagen_url ? (
                                                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{msg.imagen_url}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-2">
                                                                <Plus className="h-3 w-3" /> Configurar Imagen
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Edit3 className="absolute right-3 h-3 w-3 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                                {msg.cuerpo || "(Sin contenido)"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => setVistaPrevia(msg.cuerpo_html)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Ver
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => pruebaEnvio(msg)}
                                                    className="h-10 w-10 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 transition-all active:scale-90"
                                                    title="Enviar correo de prueba"
                                                >
                                                    <Send className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => eliminarMensaje(msg.id)}
                                                    className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-all active:scale-90"
                                                    title="Eliminar de la secuencia"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
                }
            </div>

            {/* Modal de Vista Previa HTML */}
            {
                vistaPrevia && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-indigo-500" />
                                    Vista Previa del Email
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => setVistaPrevia(null)} className="h-8 w-8 p-0">
                                    ✕
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                <div
                                    className="bg-white rounded shadow-sm overflow-hidden mx-auto max-w-full border border-gray-200"
                                    dangerouslySetInnerHTML={{ __html: vistaPrevia }}
                                />
                            </div>
                            <div className="p-4 border-t border-gray-100 dark:border-gray-800 text-center">
                                <Button onClick={() => setVistaPrevia(null)} className="bg-gray-900 dark:bg-white dark:text-gray-900">
                                    Cerrar Vista
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
