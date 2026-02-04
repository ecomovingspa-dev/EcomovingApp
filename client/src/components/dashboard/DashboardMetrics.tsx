import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Line,
    ComposedChart,
    Area,
    AreaChart,
    Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DollarSign,
    TrendingUp,
    AlertCircle,
    Megaphone,
    Wallet,
    ShoppingBag,
    ArrowUpRight,
    ArrowDownRight,
    Receipt,
    Calendar
} from "lucide-react";

interface DashboardData {
    key: string; // "2024-01"
    period: string; // "Jan"
    fullName: string; // "Jan 2024"
    sales: number;
    expenses: number;
    profit: number;
    trend: number;
}

interface KPI {
    totalSales: number;
    totalExpenses: number;
    totalProfit: number;
    pendingCollection: number;
    overdueCollection: number;
    activeCampaigns: number;
    monthlyGrowth: number;
}

export default function DashboardMetrics() {
    const [data, setData] = useState<DashboardData[]>([]);
    const [kpi, setKpi] = useState<KPI>({
        totalSales: 0,
        totalExpenses: 0,
        totalProfit: 0,
        pendingCollection: 0,
        overdueCollection: 0,
        activeCampaigns: 0,
        monthlyGrowth: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // Define the range: last 12 months
                const months: DashboardData[] = [];
                const now = new Date();
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const monthName = d.toLocaleString('es-CL', { month: 'short' });
                    months.push({
                        key: monthKey,
                        period: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                        fullName: `${monthName} ${d.getFullYear()}`,
                        sales: 0,
                        expenses: 0,
                        profit: 0,
                        trend: 0
                    });
                }

                // 1. Fetch Cotizaciones (Sales & Profit) - For Projected/Revenue
                const { data: cotizaciones, error: cotError } = await supabase
                    .from("cotizaciones")
                    .select("total_neto, ganancias, created_at, estado_cotizacion")
                    .in("estado_cotizacion", ["Aprobada", "Cerrada", "Facturada", "Pagada"]);

                if (cotError) throw cotError;

                // 2. Fetch Compras (Real Expenses)
                const { data: compras, error: comError } = await supabase
                    .from("compras")
                    .select("monto_total, fecha_emision")
                    .not("fecha_emision", "is", null);

                if (comError) throw comError;

                // 3. Fetch Ventas (Current Collections Status)
                const { data: ventas, error: venError } = await supabase
                    .from("ventas")
                    .select("saldo, fch_venc, anulada, mnt_total");

                if (venError) throw venError;

                // 4. Fetch Campaigns (Marketing Context)
                const { count: campaignsCount } = await supabase
                    .from("marketing")
                    .select("*", { count: 'exact', head: true });

                // Process Monthly Data
                let totalSales = 0;
                let totalExpenses = 0;
                let totalProfit = 0;

                cotizaciones?.forEach((c) => {
                    if (!c.created_at) return;
                    const date = new Date(c.created_at);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const month = months.find(m => m.key === key);
                    if (month) {
                        const s = c.total_neto || 0;
                        const p = c.ganancias || 0;
                        month.sales += s;
                        month.profit += p;
                        totalSales += s;
                        totalProfit += p;
                    }
                });

                compras?.forEach((c) => {
                    if (!c.fecha_emision) return;
                    const date = new Date(c.fecha_emision);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const month = months.find(m => m.key === key);
                    if (month) {
                        const e = c.monto_total || 0;
                        month.expenses += e;
                        totalExpenses += e;
                    }
                });

                // Calculate Trend
                const n = months.length;
                let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                months.forEach((d, i) => {
                    sumX += i;
                    sumY += d.sales;
                    sumXY += i * d.sales;
                    sumXX += i * i;
                });
                const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                const intercept = (sumY - slope * sumX) / n;

                months.forEach((d, i) => {
                    d.trend = Math.max(0, slope * i + intercept);
                });

                // Collections Logic
                let pending = 0;
                let overdue = 0;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                ventas?.forEach((v) => {
                    if (v.anulada) return;
                    if (v.saldo && v.saldo > 0) {
                        pending += v.saldo;
                        if (v.fch_venc) {
                            const fch = new Date(v.fch_venc);
                            fch.setHours(0, 0, 0, 0);
                            if (fch < today) overdue += v.saldo;
                        }
                    }
                });

                // Monthly Growth (vs previous month)
                let growth = 0;
                if (months.length >= 2) {
                    const current = months[n - 1].sales;
                    const previous = months[n - 2].sales;
                    if (previous > 0) growth = ((current - previous) / previous) * 100;
                }

                setData(months);
                setKpi({
                    totalSales,
                    totalExpenses,
                    totalProfit,
                    pendingCollection: pending,
                    overdueCollection: overdue,
                    activeCampaigns: campaignsCount || 0,
                    monthlyGrowth: growth
                });

            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando dashboard...</div>;
    }

    return (
        <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        Centro de Arquitectura Financiera
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] uppercase px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 tracking-wider font-bold">
                            Rendimiento en Vivo
                        </div>
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Reporte de inteligencia - últimos 12 meses (Caja y Devengado)
                    </p>
                </div>
            </div>

            {/* Premium KPI Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-lg border-none bg-white dark:bg-gray-800 overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="h-1 w-full bg-emerald-500"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Ingresos Netos</CardTitle>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                            <ArrowUpRight className="h-4 w-4 text-emerald-500 group-hover:text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(kpi.totalSales)}</div>
                        <div className="flex items-center mt-1 gap-1">
                            <div className={`flex items-center text-xs font-bold ${kpi.monthlyGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {kpi.monthlyGrowth >= 0 ? '+' : ''}{kpi.monthlyGrowth.toFixed(1)}%
                            </div>
                            <span className="text-[10px] text-gray-400">vs periodo anterior</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-none bg-white dark:bg-gray-800 overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="h-1 w-full bg-rose-500"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Gastos Op.</CardTitle>
                        <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg group-hover:bg-rose-500 group-hover:text-white transition-colors duration-300">
                            <ShoppingBag className="h-4 w-4 text-rose-500 group-hover:text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(kpi.totalExpenses)}</div>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Basado en Libro de Compras</p>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-none bg-white dark:bg-gray-800 overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="h-1 w-full bg-indigo-500"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Utilidad Bruta</CardTitle>
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                            <TrendingUp className="h-4 w-4 text-indigo-500 group-hover:text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(kpi.totalProfit)}</div>
                        <div className="text-xs font-bold text-indigo-500 mt-1">
                            Margen: {kpi.totalSales > 0 ? ((kpi.totalProfit / kpi.totalSales) * 100).toFixed(1) : 0}%
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-none bg-white dark:bg-gray-800 overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="h-1 w-full bg-amber-500"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Riesgo Cobranza</CardTitle>
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                            <AlertCircle className="h-4 w-4 text-amber-500 group-hover:text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-500">{formatCurrency(kpi.pendingCollection)}</div>
                        <div className="flex items-center mt-1 text-xs text-rose-500 font-bold gap-1">
                            <span>{formatCurrency(kpi.overdueCollection)}</span>
                            <span className="text-[10px] uppercase opacity-70">Vencido</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
                {/* Main Trend Chart */}
                <Card className="col-span-4 shadow-xl border-none bg-white dark:bg-gray-800 p-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Flujo Mensual: Ventas vs Gastos</CardTitle>
                            <p className="text-xs text-gray-400">Comparativa de base devengada en el tiempo</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-tighter">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Ventas</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div> Gastos</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                                    <XAxis
                                        dataKey="period"
                                        stroke="#94a3b8"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'K'}`}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white dark:bg-gray-900 p-4 border-none shadow-2xl rounded-xl">
                                                        <p className="font-black text-gray-900 dark:text-white mb-2">{payload[0].payload.fullName}</p>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-[10px] uppercase font-bold text-emerald-600">Ingresos</span>
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payload[0].value as number)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-[10px] uppercase font-bold text-rose-500">Gastos</span>
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payload[1].value as number)}</span>
                                                            </div>
                                                            <div className="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-[10px] uppercase font-bold text-indigo-500">Diferencia</span>
                                                                <span className="font-black text-indigo-600">
                                                                    {formatCurrency((payload[0].value as number) - (payload[1].value as number))}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={0} />
                                    <Bar dataKey="sales" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                    <Bar dataKey="expenses" stackId="b" fill="#f43f5e" fillOpacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={30} />
                                    <Line type="monotone" dataKey="trend" name="Tendencia Mercado" stroke="#6366f1" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Side Stats */}
                <Card className="col-span-3 shadow-xl border-none bg-indigo-600 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Síntesis Financiera
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8 relative z-10">
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                            <p className="text-xs uppercase font-bold tracking-widest opacity-80 mb-1">Factor de Gasto Operativo</p>
                            <div className="flex items-end justify-between">
                                <span className="text-3xl font-black">
                                    {(kpi.totalSales > 0 ? (kpi.totalExpenses / kpi.totalSales) * 100 : 0).toFixed(1)}%
                                </span>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-medium opacity-70">Puntaje Eficiencia</p>
                                    <p className="text-xs font-bold text-emerald-300">Muy Optimizado</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between items-center group">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-medium opacity-80">Liquidez de Cobranza</p>
                                    <p className="text-xl font-black">
                                        {Math.max(0, 100 - (kpi.pendingCollection / (kpi.totalSales || 1)) * 100).toFixed(0)}%
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-full border-4 border-white/20 flex items-center justify-center text-[10px] font-bold">
                                    {Math.max(0, 100 - (kpi.pendingCollection / (kpi.totalSales || 1)) * 100).toFixed(0)}%
                                </div>
                            </div>

                            <div className="h-px bg-white/20"></div>

                            <div className="flex justify-between items-center group">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-medium opacity-80">Perfil Flujo Caja Neto</p>
                                    <p className="text-xl font-black">{formatCurrency(kpi.totalProfit)}</p>
                                </div>
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button className="w-full bg-white text-indigo-600 font-bold hover:bg-indigo-50 transition-all rounded-xl py-6 group">
                                Ver Log de Auditoría Completo
                                <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
