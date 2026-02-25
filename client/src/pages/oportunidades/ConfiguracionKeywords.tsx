import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Plus,
    Trash2,
    ArrowLeft,
    Tag,
    Loader2,
    AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ConfiguracionKeywords() {
    const [keywords, setKeywords] = useState<{ id: string; keyword: string }[]>([]);
    const [nuevaKeyword, setNuevaKeyword] = useState("");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchKeywords();
    }, []);

    const fetchKeywords = async () => {
        try {
            setCargando(true);
            const { data, error } = await supabase
                .from("config_oportunidades")
                .select("*")
                .order("keyword", { ascending: true });

            if (error) throw error;
            setKeywords(data || []);
        } catch (error: any) {
            console.error("Error fetching keywords:", error);
            setMensaje("❌ Error al cargar palabras clave");
        } finally {
            setCargando(false);
        }
    };

    const agregarKeyword = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanKeyword = nuevaKeyword.trim().toLowerCase();

        if (!cleanKeyword) return;
        if (keywords.some(k => k.keyword === cleanKeyword)) {
            setMensaje("⚠️ Esta palabra ya existe");
            setTimeout(() => setMensaje(""), 3000);
            return;
        }

        try {
            setGuardando(true);
            const { data, error } = await supabase
                .from("config_oportunidades")
                .insert([{ keyword: cleanKeyword }])
                .select();

            if (error) throw error;

            if (data && data.length > 0) {
                setKeywords(prev => [...prev, data[0]].sort((a, b) => (a.keyword || "").localeCompare(b.keyword || "")));
            }
            setNuevaKeyword("");
            setMensaje("✅ Palabra agregada");
            setTimeout(() => setMensaje(""), 3000);
        } catch (error: any) {
            console.error("Error adding keyword:", error);
            setMensaje("❌ Error al guardar");
        } finally {
            setGuardando(false);
        }
    };

    const eliminarKeyword = async (id: string) => {
        try {
            const { error } = await supabase
                .from("config_oportunidades")
                .delete()
                .eq("id", id);

            if (error) throw error;

            setKeywords(prev => prev.filter(k => k.id !== id));
            setMensaje("✅ Palabra eliminada");
            setTimeout(() => setMensaje(""), 3000);
        } catch (error: any) {
            console.error("Error deleting keyword:", error);
            setMensaje("❌ Error al eliminar");
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/oportunidades")}
                        className="hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 italic">
                            Configuración de Palabras Clave
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Gestiona los términos que activan el filtrado en la importación de Excel.
                        </p>
                    </div>
                </div>
            </div>

            {mensaje && (
                <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-2 border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="h-5 w-5" />
                    {mensaje}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                <form onSubmit={agregarKeyword} className="flex gap-4">
                    <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={nuevaKeyword}
                            onChange={(e) => setNuevaKeyword(e.target.value)}
                            placeholder="Ej: agendas, mochilas, personalizado..."
                            className="pl-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-emerald-500"
                            disabled={guardando}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={guardando || !nuevaKeyword.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-2"
                    >
                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Agregar
                    </Button>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Palabras Clave Activas ({keywords.length})
                    </h2>
                </div>

                {cargando ? (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 opacity-50" />
                        Cargando configuración...
                    </div>
                ) : keywords.length === 0 ? (
                    <div className="p-12 text-center">
                        <Tag className="h-12 w-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No hay palabras clave configuradas.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-6">
                        {keywords.map((k) => (
                            <div
                                key={k.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors"
                            >
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                    {k.keyword}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => eliminarKeyword(k.id)}
                                    className="h-8 w-8 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
