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
    ComposedChart
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertCircle, Megaphone, Wallet } from "lucide-react";

interface DashboardData {
    year: string;
    sales: number;
    profit: number;
    trend: number;
}

interface KPI {
    totalSales: number;
    totalProfit: number;
    pendingCollection: number;
    overdueCollection: number;
    activeCampaigns: number;
}

export default function DashboardMetrics() {
    const [data, setData] = useState<DashboardData[]>([]);
    const [kpi, setKpi] = useState<KPI>({
        totalSales: 0,
        totalProfit: 0,
        pendingCollection: 0,
        overdueCollection: 0,
        activeCampaigns: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // 1. Fetch Cotizaciones (Sales & Profit)
                // Filter by successful statuses. Adjust these strings based on your actual statuses.
                const { data: cotizaciones, error: cotError } = await supabase
                    .from("cotizaciones")
                    .select("total_neto, ganancias, created_at, estado_cotizacion")
                    .in("estado_cotizacion", ["Aprobada", "Cerrada", "Facturada", "Pagada"]);

                if (cotError) throw cotError;

                // 2. Fetch Ventas (Collections)
                const { data: ventas, error: venError } = await supabase
                    .from("ventas")
                    .select("saldo, fch_venc, anulada, mnt_total, total_nc");

                if (venError) throw venError;

                // 3. Fetch Campaigns (Marketing)
                // Assuming 'marketing' table exists based on previous context
                const { count: campaignsCount, error: campError } = await supabase
                    .from("marketing")
                    .select("*", { count: 'exact', head: true });

                if (campError && campError.code !== 'PGRST116') { // Ignore if table doesn't exist or other minor error
                    console.error("Error fetching campaigns:", campError);
                }

                // Process Cotizaciones for Chart
                const salesByYear: Record<string, { sales: number; profit: number }> = {};
                let totalSales = 0;
                let totalProfit = 0;

                cotizaciones?.forEach((c) => {
                    if (!c.created_at) return;
                    const year = new Date(c.created_at).getFullYear().toString();

                    if (!salesByYear[year]) {
                        salesByYear[year] = { sales: 0, profit: 0 };
                    }

                    const sale = c.total_neto || 0;
                    const profit = c.ganancias || 0;

                    salesByYear[year].sales += sale;
                    salesByYear[year].profit += profit;

                    totalSales += sale;
                    totalProfit += profit;
                });

                // Convert to Array and Sort
                let chartData = Object.keys(salesByYear).map(year => ({
                    year,
                    sales: salesByYear[year].sales,
                    profit: salesByYear[year].profit,
                    trend: 0 // Placeholder
                })).sort((a, b) => parseInt(a.year) - parseInt(b.year));

                // Calculate Trend Line (Linear Regression on Sales)
                // x = index (0, 1, 2...), y = sales
                const n = chartData.length;
                if (n > 1) {
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    chartData.forEach((d, i) => {
                        sumX += i;
                        sumY += d.sales;
                        sumXY += i * d.sales;
                        sumXX += i * i;
                    });

                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;

                    chartData = chartData.map((d, i) => ({
                        ...d,
                        trend: slope * i + intercept
                    }));
                } else if (n === 1) {
                    // If only one point, trend is just that point
                    chartData[0].trend = chartData[0].sales;
                }

                // Process Collections
                let pending = 0;
                let overdue = 0;
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                ventas?.forEach((v) => {
                    if (v.anulada) return;
                    // Check consistency (optional)
                    if (v.saldo && v.saldo > 0) {
                        pending += v.saldo;

                        if (v.fch_venc) {
                            const fch = new Date(v.fch_venc);
                            fch.setHours(0, 0, 0, 0);
                            if (fch < now) {
                                overdue += v.saldo;
                            }
                        }
                    }
                });

                setData(chartData);
                setKpi({
                    totalSales,
                    totalProfit,
                    pendingCollection: pending,
                    overdueCollection: overdue,
                    activeCampaigns: campaignsCount || 0
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
        <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard General</h2>
                <p className="text-gray-500 dark:text-gray-400">Resumen de ventas, utilidades y cobranzas.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales (Aprobadas)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(kpi.totalSales)}</div>
                        <p className="text-xs text-green-600 font-medium">+10% vs año anterior (simulado)</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilidad Total</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(kpi.totalProfit)}</div>
                        <p className="text-xs text-gray-500">
                            Margen: {kpi.totalSales > 0 ? ((kpi.totalProfit / kpi.totalSales) * 100).toFixed(1) : 0}%
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-red-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Por Cobrar</CardTitle>
                        <Wallet className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(kpi.pendingCollection)}</div>
                        <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            <span className="font-bold">{formatCurrency(kpi.overdueCollection)}</span> vencidos
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
                        <Megaphone className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpi.activeCampaigns}</div>
                        <p className="text-xs text-gray-500">Mensajes en secuencia</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
                <Card className="col-span-4 shadow-sm">
                    <CardHeader>
                        <CardTitle>Evolución de Ventas y Utilidades</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="year"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value / 1000000}M`}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value / 1000000}M`}
                                    />
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(Number(value))}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar yAxisId="left" dataKey="sales" name="Ventas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                    <Line yAxisId="left" type="monotone" dataKey="profit" name="Utilidad" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="trend" name="Tendencia" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* You could add another chart here or leave it empty for now, spanning full width or 4/7 */}
                <Card className="col-span-3 shadow-sm">
                    <CardHeader>
                        <CardTitle>Resumen Financiero</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Facturación Anual Proyectada (Aprox)</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {data.length > 0 ? formatCurrency(data[data.length - 1].sales * 1.1) : '$0'}
                                    </p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
                            </div>
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Rentabilidad Global</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {kpi.totalSales > 0 ? ((kpi.totalProfit / kpi.totalSales) * 100).toFixed(1) + '%' : '0%'}
                                    </p>
                                </div>
                                <DollarSign className="h-8 w-8 text-blue-500 opacity-20" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-2">Estado de Cartera</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${Math.max(0, 100 - (kpi.pendingCollection / (kpi.totalSales || 1)) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">
                                        {Math.max(0, 100 - (kpi.pendingCollection / (kpi.totalSales || 1)) * 100).toFixed(0)}% Recaudado
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
