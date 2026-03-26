// v2.0.0 - Excel-style Sentinel Matrix
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Mail, CheckCircle2, Eye, AlertCircle, Circle, 
  Search, RefreshCcw, Trash2, HelpCircle, 
  Wrench, Truck, Settings, Building2 
} from "lucide-react";
import { toast } from "sonner";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// March 2026 Working Days (Calculated dynamically below)
interface CalendarDay {
  date: string;
  label: string;
  isWorkingDay: boolean;
}

const translateStatus = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'opened' || s === 'unique_opened' || s === 'loadedbyproxy') return 'ABIERTO';
  if (s === 'delivered') return 'ENTREGADO';
  if (s === 'request') return 'ENVIADO';
  if (s === 'hard_bounce' || s === 'soft_bounce' || s === 'invalid_email') return 'REBOTE';
  if (s === 'blocked') return 'BLOQUEADO';
  return s.toUpperCase();
};

export default function TrazabilidadBrevo() {
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);

  const fetchContactos = async (days: CalendarDay[]) => {
    setLoading(true);
    
    // 1. Obtener base de contactos
    const { data: contactsData, error } = await supabase
      .from("contactos")
      .select("*")
      .eq("estado", "activo")
      .not("correo", "is", null)
      .neq("correo", "")
      .order("nombre", { ascending: true });

    if (error) {
      toast.error("Error al cargar contactos");
      setLoading(false);
      return;
    }

    // 2. Obtener historial (trazabilidad_correos) de forma segura
    let historyData: any[] = [];
    try {
      const { data: hData, error: hError } = await supabase
        .from("trazabilidad_correos")
        .select("*")
        .gte("fecha", days[0]?.date || '2026-03-01');
      
      if (!hError) historyData = hData || [];
    } catch (err) {
      console.warn("⚠️ Tabla trazabilidad_correos no detectada. Usando fallback.");
    }

    // 3. Vincular historial a contactos
    const merged = (contactsData || []).map(c => ({
      ...c,
      historial: historyData.filter(h => h.email === c.correo || h.contacto_id === c.id)
    }));

    setContactos(merged);
    setLoading(false);
  };

  useEffect(() => {
    // Generate working days for March 2026
    const days: CalendarDay[] = [];
    const year = 2026;
    const month = 2; // March (0-indexed)
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push({
          date: date.toISOString().split('T')[0],
          label: `${date.getDate()}`,
          isWorkingDay: true
        });
      }
      date.setDate(date.getDate() + 1);
    }
    setCalendarDays(days);
    fetchContactos(days);
  }, []);

  async function syncWithBrevo() {
    setLoading(true);
    try {
      const resp = await fetch("/api/sync-brevo", { method: "POST" });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Sincronización exitosa: ${data.processed} eventos`);
        await fetchContactos(calendarDays);
      } else {
        throw new Error(data.error || "Fallo en API /api/sync-brevo");
      }
    } catch (err: any) {
      toast.error("Error de Sync: Asegúrate de correr 'vercel dev' para la API local.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (contacto: any, day: string) => {
    // 1. PRIORIDAD: Historial Real (soporta múltiples envíos por mes)
    const eventosDelDia = (contacto.historial || []).filter((h: any) => h.fecha === day);
    
    if (eventosDelDia.length > 0) {
      // Jerarquía de estados Sentinel
      const weights: Record<string, number> = { 
        'opened': 100, 'unique_opened': 100, 'clicks': 90, 
        'delivered': 80, 'request': 50 
      };
      
      const topEvent = eventosDelDia.reduce((prev: any, curr: any) => 
        (weights[curr.estado] || 0) > (weights[prev.estado] || 0) ? curr : prev
      );

      const status = topEvent.estado?.toLowerCase();
      if (status === "opened" || status === "unique_opened" || status === "clicks" || status === "loadedbyproxy") 
        return <Eye className="h-4 w-4 text-purple-400" />;
      if (status === "delivered" || status === "request") 
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      return <Mail className="h-4 w-4 text-blue-400" />;
    }

    // 2. FALLBACK: Modelo antiguo (ultimo_envio único) para compatibilidad
    const ultimoEnvio = contacto.ultimo_envio?.split('T')[0];
    if (ultimoEnvio === day) {
      const lastStatus = (contacto.ultimo_estado_brevo || "").toLowerCase();
      if (contacto.es_bloqueado) return <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />;
      if (lastStatus === "opened" || lastStatus === "unique_opened" || lastStatus === "clicks" || lastStatus === "loadedbyproxy") 
        return <Eye className="h-4 w-4 text-purple-400" />;
      if (lastStatus === "delivered" || lastStatus === "request") 
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      return <Mail className="h-4 w-4 text-blue-400" />;
    }
    
    return <div className="h-1 w-1 bg-gray-800 rounded-full" />; // Dot default
  };

  const filtered = contactos.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
                         c.correo.toLowerCase().includes(filtro.toLowerCase());
    const matchesCriticos = soloCriticos ? c.es_bloqueado : true;
    return matchesSearch && matchesCriticos;
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-900/40 p-4 rounded-2xl border border-gray-800 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-xl">
            <RefreshCcw className={`h-5 w-5 text-amber-500 ${loading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">Matrix Sentinel v2.0</h2>
            <p className="text-xs text-gray-500">Trazabilidad histórica por etapa de envío</p>
          </div>
        </div>

        <div className="flex flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar contacto..." 
            className="w-full bg-gray-800/50 border-gray-700 rounded-xl pl-10 text-sm py-2 focus:ring-amber-500/50" 
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setSoloCriticos(!soloCriticos)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              soloCriticos ? "bg-red-500 text-white shadow-lg shadow-red-500/50" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {soloCriticos ? "FILTRANDO CRÍTICOS" : "TODOS"}
          </button>
          <button 
            onClick={syncWithBrevo}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            SYNC BREVO
          </button>
        </div>
      </div>

      {/* The Matrix */}
      <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-[9px] font-black tracking-widest text-gray-500 uppercase">
                <th className="px-4 py-4 w-[180px]">CONTACTO (MARZO 2026)</th>
                {calendarDays.map(d => (
                  <th key={d.date} className="px-1 py-4 text-center border-l border-gray-800/50">
                    {d.label}
                  </th>
                ))}
                <th className="px-4 py-4 w-[120px] border-l border-gray-800/50">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filtered.map((c) => (
                <tr key={c.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-xs font-bold text-white uppercase truncate">
                      {c.nombre?.replace('Contacto Principal - ', '') || 'SIN NOMBRE'}
                    </div>
                  </td>

                  {calendarDays.map(d => (
                    <td key={d.date} className="px-1 py-3 text-center border-l border-gray-900/10">
                      <div className="flex justify-center items-center">
                        {getStatusIcon(c, d.date)}
                      </div>
                    </td>
                  ))}

                  <td className="px-6 py-4 border-l border-gray-900/50">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${c.es_bloqueado ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className={`text-[10px] font-black uppercase ${c.es_bloqueado ? 'text-red-500' : 'text-emerald-500'}`}>
                        {c.es_bloqueado ? 'BLOQUEO CRÍTICO' : translateStatus(c.ultimo_estado_brevo || 'IDLE')}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <button className="p-2 text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda Sentinel */}
      <div className="flex flex-wrap gap-6 p-4 bg-gray-900/20 rounded-xl border border-dotted border-gray-800 justify-center">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
          <Mail className="h-3 w-3 text-blue-400" /> Enviado
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Entregado
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
          <Eye className="h-3 w-3 text-purple-400" /> Abierto
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
          <AlertCircle className="h-3 w-3 text-red-500" /> Error / Bloqueo
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
          <Circle className="h-3 w-3 text-gray-700" /> Pendiente
        </div>
      </div>
    </div>
  );
}
