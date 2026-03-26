import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function FinanceAlertBanner() {
    const [stats, setStats] = useState<{ count: number; total: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOverdue() {
            try {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const hoyStr = hoy.toISOString().split('T')[0];

                const { data, error } = await supabase
                    .from("compras")
                    .select("saldo")
                    .gt("saldo", 0)
                    .lt("fecha_vencimiento", hoyStr);

                if (error) throw error;

                if (data && data.length > 0) {
                    const total = data.reduce((acc, c) => acc + (c.saldo || 0), 0);
                    setStats({ count: data.length, total });
                } else {
                    setStats(null);
                }
            } catch (error) {
                console.error("Error fetching overdue purchases:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchOverdue();

        // Escuchar cambios en la tabla compras para actualizar el banner en tiempo real
        const channel = supabase
            .channel("public:compras")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "compras" },
                () => {
                    fetchOverdue();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (loading || !stats || stats.count === 0) return null;

    return (
        <div className="bg-red-600 dark:bg-red-700 text-white animate-in slide-in-from-top-full duration-500 overflow-hidden relative group">
            <div className="absolute inset-0 bg-red-500/20 group-hover:bg-red-500/30 transition-colors pointer-events-none"></div>
            <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-white/20 p-1.5 rounded-lg border border-white/20 animate-pulse">
                        <AlertTriangle className="h-5 w-5 fill-white text-red-600" />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                        <span className="text-sm font-black uppercase tracking-tighter">
                            Atención Crítica: Finanzas en Mora
                        </span>
                        <div className="h-3 w-px bg-white/30 hidden md:block"></div>
                        <p className="text-xs md:text-sm font-medium opacity-90 truncate">
                            Existen <span className="font-black underline underline-offset-2">{stats.count}</span> documentos de compra vencidos equivalentes a <span className="font-black font-mono">${stats.total.toLocaleString('es-CL')}</span>.
                        </p>
                    </div>
                </div>

                <Link 
                    to="/compras" 
                    className="flex items-center gap-2 bg-white text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-gray-50 transition-all shadow-lg active:scale-95 group/btn whitespace-nowrap"
                >
                    Gestionar Pagos
                    <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
}
