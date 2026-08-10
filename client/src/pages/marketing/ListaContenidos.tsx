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
    Check,
    Image as ImageIcon
} from "lucide-react";
import { Button } from "../../components/ui/button";



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



    const pruebaEnvio = async (msg: MarketingMessage) => {
        if (!msg.imagen_url) {
            alert("⚠️ Debes agregar una URL de imagen primero.");
            return;
        }

        const emailDestino = prompt("Ingresa el correo para recibir la prueba:", "");
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


            </div>


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
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-14 text-center">ID</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">Asunto</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Archivo</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">Imagen Supabase (URL)</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contenido</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-20">Vista</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {mensajes.map((msg) => (
                                    <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                                                {msg.nombre_envio}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 line-clamp-2">
                                                {msg.asunto}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3">
                                            {msg.nombre_imagen ? (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 min-w-0">
                                                    <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                                                    <span className="font-mono text-[11px] truncate" title={msg.nombre_imagen}>{msg.nombre_imagen}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            {editandoUrl === msg.id ? (
                                                <div className="flex flex-col gap-2 animate-in slide-in-from-top-1">
                                                    <textarea
                                                        value={urlTemporal}
                                                        onChange={(e) => setUrlTemporal(e.target.value)}
                                                        placeholder="Pega la URL pública de Supabase..."
                                                        className="w-full px-2 py-1 text-[11px] font-mono border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none h-16 resize-none shadow-inner"
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
                                                            className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs font-bold transition-all"
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
                                                    className="group relative w-full h-auto min-h-[36px] flex items-center px-2 py-1 bg-gray-50/50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-left transition-all hover:border-indigo-400/50 hover:bg-indigo-50/30 overflow-hidden"
                                                >
                                                    <div className="w-full pr-5 min-w-0">
                                                        {msg.imagen_url ? (
                                                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate block" title={msg.imagen_url}>{msg.imagen_url}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                <Plus className="h-3 w-3 flex-shrink-0" /> Configurar URL
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Edit3 className="absolute right-2 h-3 w-3 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 min-w-0">
                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 break-words" title={msg.cuerpo || ""}>
                                                {msg.cuerpo || "(Sin contenido)"}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <button
                                                onClick={() => setVistaPrevia(msg.cuerpo_html)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                Ver
                                            </button>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => pruebaEnvio(msg)}
                                                    className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                                                    title="Enviar correo de prueba"
                                                >
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => eliminarMensaje(msg.id)}
                                                    className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                    title="Eliminar de la secuencia"
                                                >
                                                    <Trash2 className="h-4 w-4" />
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
