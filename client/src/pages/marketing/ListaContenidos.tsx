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
    AlertCircle
} from "lucide-react";
import { Button } from "../../components/ui/button";

interface MarketingMessage {
    id: string; // Es UUID según la captura
    asunto: string;
    cuerpo_html: string;
    numero_secuencia: number;
    created_at?: string;
}

export default function ListaContenidos({ onNew }: { onNew: () => void }) {
    const [mensajes, setMensajes] = useState<MarketingMessage[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        cargarMensajes();
    }, []);

    const cargarMensajes = async () => {
        try {
            setCargando(true);
            const { data, error: dbError } = await supabase
                .from("marketing")
                .select("*")
                .order("numero_secuencia", { ascending: true });

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

            <div className="grid gap-4">
                {cargando ? (
                    <div className="py-12 text-center text-gray-500">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 opacity-50" />
                        Cargando biblioteca...
                    </div>
                ) : mensajes.length === 0 ? (
                    <div className="py-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <Mail className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No hay mensajes en la secuencia todavía.</p>
                        <Button variant="link" onClick={onNew} className="text-indigo-600 mt-2">
                            Comenzar a crear con IA
                        </Button>
                    </div>
                ) : (
                    mensajes.map((msg, index) => (
                        <div
                            key={msg.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between group hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {msg.numero_secuencia}
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                        {msg.asunto}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-500">
                                        ID de secuencia: {msg.id}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => eliminarMensaje(msg.id)}
                                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-700 ml-2" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
