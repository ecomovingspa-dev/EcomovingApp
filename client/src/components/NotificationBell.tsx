import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    Bell,
    AlertTriangle,
    Info,
    ShieldAlert,
    Check,
    ExternalLink,
    X,
    Trash2,
} from "lucide-react";

interface Notificacion {
    id: number;
    tipo: string;
    titulo: string;
    mensaje: string;
    modulo: string;
    enlace: string;
    icono: string;
    severidad: "info" | "warning" | "critical";
    leida: boolean;
    resuelta: boolean;
    metadata: any;
    created_at: string;
}

export default function NotificationBell({ isCollapsed }: { isCollapsed: boolean }) {
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [panelOpen, setPanelOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const noLeidas = notificaciones.filter((n) => !n.leida).length;

    // Cargar notificaciones
    const fetchNotificaciones = async () => {
        try {
            const { data, error } = await supabase
                .from("notificaciones")
                .select("*")
                .eq("resuelta", false)
                .order("created_at", { ascending: false })
                .limit(20);

            if (error) throw error;
            setNotificaciones(data || []);
        } catch (err) {
            console.error("Error cargando notificaciones:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotificaciones();

        // Escuchar cambios en tiempo real
        const channel = supabase
            .channel("notificaciones-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "notificaciones" },
                () => {
                    fetchNotificaciones();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Cerrar panel al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        }
        if (panelOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [panelOpen]);

    // Marcar como leída
    const marcarLeida = async (id: number) => {
        await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
        setNotificaciones((prev) =>
            prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
        );
    };

    // Marcar como resuelta (elimina del listado)
    const marcarResuelta = async (id: number) => {
        await supabase
            .from("notificaciones")
            .update({ resuelta: true, leida: true })
            .eq("id", id);
        setNotificaciones((prev) => prev.filter((n) => n.id !== id));
    };

    // Marcar todas como leídas
    const marcarTodasLeidas = async () => {
        const ids = notificaciones.filter((n) => !n.leida).map((n) => n.id);
        if (ids.length === 0) return;
        await supabase
            .from("notificaciones")
            .update({ leida: true })
            .in("id", ids);
        setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    };

    // Navegar al enlace
    const handleNavegar = (notif: Notificacion) => {
        marcarLeida(notif.id);
        setPanelOpen(false);
        if (notif.enlace) navigate(notif.enlace);
    };

    const getSeverityIcon = (severidad: string) => {
        switch (severidad) {
            case "critical":
                return <ShieldAlert className="h-4 w-4 text-red-500" />;
            case "warning":
                return <AlertTriangle className="h-4 w-4 text-amber-500" />;
            default:
                return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    const getSeverityBg = (severidad: string, leida: boolean) => {
        if (leida) return "bg-gray-50 dark:bg-gray-800/30";
        switch (severidad) {
            case "critical":
                return "bg-red-50 dark:bg-red-900/10 border-l-2 border-l-red-500";
            case "warning":
                return "bg-amber-50 dark:bg-amber-900/10 border-l-2 border-l-amber-500";
            default:
                return "bg-blue-50 dark:bg-blue-900/10 border-l-2 border-l-blue-500";
        }
    };

    const formatTiempo = (fecha: string) => {
        const diff = Date.now() - new Date(fecha).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Ahora";
        if (mins < 60) return `Hace ${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours}h`;
        const days = Math.floor(hours / 24);
        return `Hace ${days}d`;
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Botón Campanita */}
            <button
                onClick={() => setPanelOpen(!panelOpen)}
                className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full",
                    "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100",
                    panelOpen && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                )}
            >
                <div className="relative shrink-0">
                    <Bell
                        className={cn(
                            "h-5 w-5",
                            noLeidas > 0 && "text-amber-500 animate-[wiggle_1s_ease-in-out]"
                        )}
                    />
                    {noLeidas > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black rounded-full h-4 min-w-[16px] flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-gray-800 animate-pulse">
                            {noLeidas > 9 ? "9+" : noLeidas}
                        </span>
                    )}
                </div>
                {!isCollapsed && <span>Alertas</span>}
                {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        Alertas {noLeidas > 0 ? `(${noLeidas})` : ""}
                    </div>
                )}
            </button>

            {/* Panel de Notificaciones */}
            {panelOpen && (
                <div
                    className={cn(
                        "absolute z-[9999] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden",
                        "animate-in slide-in-from-left-2 fade-in duration-200",
                        isCollapsed
                            ? "left-full ml-2 bottom-0 w-[380px]"
                            : "left-0 bottom-full mb-2 w-[380px]"
                    )}
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-gray-500" />
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                Centro de Alertas
                            </h3>
                            {noLeidas > 0 && (
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    {noLeidas}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {noLeidas > 0 && (
                                <button
                                    onClick={marcarTodasLeidas}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    Leer todas
                                </button>
                            )}
                            <button
                                onClick={() => setPanelOpen(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <X className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notificaciones.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <Bell className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 font-medium">
                                    Sin alertas pendientes
                                </p>
                                <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
                                    El sistema está operando con normalidad
                                </p>
                            </div>
                        ) : (
                            notificaciones.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={cn(
                                        "px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 transition-all hover:bg-gray-50/80 dark:hover:bg-gray-800/30 group cursor-pointer",
                                        getSeverityBg(notif.severidad, notif.leida)
                                    )}
                                    onClick={() => handleNavegar(notif)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 shrink-0">
                                            {getSeverityIcon(notif.severidad)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4
                                                    className={cn(
                                                        "text-xs truncate",
                                                        notif.leida
                                                            ? "font-medium text-gray-500"
                                                            : "font-black text-gray-900 dark:text-white"
                                                    )}
                                                >
                                                    {notif.titulo}
                                                </h4>
                                                <span className="text-[9px] text-gray-400 whitespace-nowrap">
                                                    {formatTiempo(notif.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                                                {notif.mensaje}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                    {notif.modulo}
                                                </span>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            marcarResuelta(notif.id);
                                                        }}
                                                        className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors"
                                                        title="Marcar como resuelta"
                                                    >
                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
