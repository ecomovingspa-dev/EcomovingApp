import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import {
    Mail,
    Trash2,
    Eye,
    Plus,
    ChevronRight,
    Library,
    Loader2,
    AlertCircle,
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

export default function ListaContenidos({ onNew }: { onNew: () => void }) {
    const [mensajes, setMensajes] = useState<MarketingMessage[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

    useEffect(() => {
        cargarMensajes();
    }, []);

    const cargarMensajes = async () => {
        try {
            setCargando(true);
            const { data, error: dbError } = await supabase
                .from("marketing")
                .select("*")
                .order("created_at", { ascending: true });

            if (dbError) throw dbError;
            setMensajes(data || []);
        } catch (err: any) {
            console.error("Error cargando mensajes:", err);
            setError("No se pudo cargar la biblioteca de contenidos.");
        } finally {
            setCargando(false);
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
                <Button
                    onClick={onNew}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nuevo Mensaje (IA)
                </Button>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-2 border border-red-100 dark:border-red-800">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {cargando ? (
                    <div className="py-20 text-center">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-500 opacity-50 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase text-xs">Sincronizando biblioteca...</p>
                    </div>
                ) : mensajes.length === 0 ? (
                    <div className="py-20 text-center">
                        <Mail className="h-16 w-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">La secuencia está vacía.</p>
                        <Button variant="link" onClick={onNew} className="text-indigo-600 mt-2">
                            Crear tu primer contenido con IA
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest w-16">#</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Asunto</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest max-w-xs">Contenido</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">HTML</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {mensajes.map((msg) => (
                                    <tr key={msg.id} className="group hover:bg-indigo-50/5 dark:hover:bg-indigo-900/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-900 text-xs font-bold text-gray-500 dark:text-gray-400">
                                                {msg.nombre_envio}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                                    {msg.asunto}
                                                </p>
                                            </div>
                                            {msg.nombre_imagen && (
                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                    <ImageIcon className="h-3 w-3" />
                                                    {msg.nombre_imagen}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 italic">
                                                {msg.cuerpo || "(Sin texto plano)"}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setVistaPrevia(msg.cuerpo_html)}
                                                className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-900/30"
                                            >
                                                <Eye className="h-3 w-3" />
                                                VER HTML
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => eliminarMensaje(msg.id)}
                                                    className="h-8 w-8 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                )}
            </div>

            {/* Modal de Vista Previa HTML */}
            {vistaPrevia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
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
                                className="bg-white rounded shadow-sm overflow-hidden mx-auto max-w-[600px] border border-gray-200"
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
            )}
        </div>
    );
}
