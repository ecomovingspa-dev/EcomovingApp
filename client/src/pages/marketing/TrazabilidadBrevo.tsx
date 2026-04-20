// v2.0.0 - Excel-style Sentinel Matrix
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Mail, CheckCircle2, Eye, AlertCircle, Circle, 
  Search, RefreshCcw, Trash2, HelpCircle, 
  Wrench, Truck, Settings, Building2 
} from "lucide-react";
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const [vendedor, setVendedor] = useState("Ejecutivo de Ventas A");
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const [draftData, setDraftData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchContactos = async (days: CalendarDay[]) => {
    setLoading(true);
    
    // 1. Obtener base de contactos (Nutrición y Marketing únicamente)
    const { data: contactsData, error } = await supabase
      .from("contactos")
      .select("*")
      .in("etapa", ["nutricion", "marketing"])
      .eq("estado", "activo")
      .not("correo", "is", null)
      .neq("correo", "")
      .order("nombre", { ascending: true });

    if (error) {
      toast.error("Error al cargar contactos");
      setLoading(false);
      return;
    }

    // 1.5 Resolver manualmente los nombres de cuenta para eludir error FK de Supabase "ambiguous relationship"
    const validContacts = contactsData || [];
    const accountIdsToFetch = [...new Set(validContacts.map(c => c.cuenta_id).filter(Boolean))];
    
    let accountsMap: Record<string, string> = {};
    if (accountIdsToFetch.length > 0) {
      const { data: cuentasData } = await supabase
        .from("cuentas")
        .select("id, cliente")
        .in("id", accountIdsToFetch);
        
      if (cuentasData) {
        cuentasData.forEach((acc: any) => {
          accountsMap[acc.id] = acc.cliente;
        });
      }
    }

    // Embed the account name string directly in the contact object mapping for the template fallback:
    validContacts.forEach((c: any) => {
      if (c.cuenta_id && accountsMap[c.cuenta_id]) {
        c.empresa_rel_name = accountsMap[c.cuenta_id];
      }
    });

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
    // Generate working days for current month (April 2026 as per user requirement)
    const days: CalendarDay[] = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // Current month (April = 3)
    
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
      toast.error("Error de Sincronización: Asegúrate de correr 'vercel dev' para la API local.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (contacto: any, day: string) => {
    // 1. PRIORIDAD: Historial Real (soporta múltiples envíos por mes)
    const eventosDelDia = (contacto.historial || []).filter((h: any) => h.fecha === day);
    
    if (eventosDelDia.length > 0) {
      // Jerarquía de importancia para el negocio
      const weights: Record<string, number> = { 
        'hard_bounce': 1000,
        'hardbounces': 1000, 
        'spam': 1000, 
        'soft_bounce': 900,
        'softbounces': 900,
        'invalid': 900,
        'invalid_email': 900,
        'opened': 800, 
        'unique_opened': 800, 
        'loadedbyproxy': 800,
        'clicks': 700, 
        'delivered': 500, 
        'request': 300,
        'requests': 300,
        'deferred': 100
      };
      
      const topEvent = eventosDelDia.reduce((prev: any, curr: any) => 
        (weights[curr.estado?.toLowerCase()] || 0) > (weights[prev.estado?.toLowerCase()] || 0) ? curr : prev
      );

      const status = topEvent.estado?.toLowerCase() || "";

      // REBOTES / BLOQUEOS
      if (status.includes('bounce') || status === 'spam' || status.includes('invalid')) {
        return <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" title={status.toUpperCase()} />;
      }

      // APERTURAS
      if (status === "opened" || status === "unique_opened" || status === "clicks" || status === "loadedbyproxy") 
        return (
          <div className="flex flex-col items-center gap-1.5">
            <Eye className="h-5 w-5 text-purple-400" />
            <button onClick={() => generateDraft(contacto)} className="p-0.5 bg-indigo-500 rounded-md hover:scale-110 transition-transform">
              <Wrench className="h-3 w-3 text-white" />
            </button>
          </div>
        );

      // ENTREGAS
      if (status === "delivered" || status === "request" || status === "requests") 
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      
      return <Mail className="h-5 w-5 text-blue-400" />;
    }

    // 2. FALLBACK: Modelo antiguo (ultimo_envio único)
    const ultimoEnvio = contacto.ultimo_envio?.split('T')[0];
    if (ultimoEnvio === day) {
      if (contacto.es_bloqueado) return <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />;
      const lastStatus = (contacto.ultimo_estado_brevo || "").toLowerCase();

      if (lastStatus.includes('bounce') || lastStatus === 'spam' || lastStatus.includes('invalid')) 
        return <AlertCircle className="h-5 w-5 text-red-500" />;

      if (lastStatus === "opened" || lastStatus === "unique_opened" || lastStatus === "clicks" || lastStatus === "loadedbyproxy") 
        return (
          <div className="flex flex-col items-center gap-1.5">
            <Eye className="h-5 w-5 text-purple-400" />
            <button onClick={() => generateDraft(contacto)} className="p-0.5 bg-indigo-500 rounded-md hover:scale-110 transition-transform">
              <Wrench className="h-3 w-3 text-white" />
            </button>
          </div>
        );
      if (lastStatus === "delivered" || lastStatus.includes("request")) 
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      return <Mail className="h-5 w-5 text-blue-400" />;
    }
    
    return <div className="h-1.5 w-1.5 bg-gray-800 rounded-full" />; // Dot default
  };

  const generateDraft = (c: any) => {
    const company = c.nombre?.replace('Contacto Principal - ', '') || 'su empresa';
    const email = c.correo;
    
    // Asunto según el último estado
    const subject = `Sobre tu consulta de hidratación eficiente - Ecomoving`;
    
    const body = `Hola ${c.nombre?.split(' ')[0] || ''},\n\nTe escribo porque vi que estuvieron revisando nuestra propuesta de sostenibilidad y eficiencia operativa para ${company} hoy.\n\nNo quería que se quedaran con dudas tácticas sobre cómo el cambio a purificadores puede reducir sus costos logísticos de inmediato.\n\n¿Tendrían 10 minutos la próxima semana para una llamada rápida?\n\nSaludos,\n\n${vendedor}\nEcomoving SpA`;

    setDraftData({ email, subject, body });
    setIsModalOpen(true);
  };

  const filtered = contactos.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
                         c.correo.toLowerCase().includes(filtro.toLowerCase());
    const matchesCriticos = soloCriticos ? c.es_bloqueado : true;
    const matchesEtapa = filtroEtapa === "todos" ? true : (c.etapa === filtroEtapa);
    
    return matchesSearch && matchesCriticos && matchesEtapa;
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

          <Select onValueChange={(val) => setFiltroEtapa(val)} defaultValue="todos">
            <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
              <SelectValue placeholder="ETAPA" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="todos">TODAS LAS ETAPAS</SelectItem>
              <SelectItem value="marketing">MARKETING</SelectItem>
              <SelectItem value="prospeccion">PROSPECCIÓN</SelectItem>
            </SelectContent>
          </Select>
          <button 
            onClick={syncWithBrevo}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            SINCRONIZAR BREVO
          </button>
        </div>
      </div>

      {/* Mini-Leyenda Superior */}
      <div className="flex flex-wrap gap-4 px-4 py-2 bg-gray-900/40 rounded-xl border border-gray-800 w-fit">
        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
          <Mail className="h-3 w-3 text-blue-400" /> Enviado
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Entregado
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
          <Eye className="h-3 w-3 text-purple-400" /> Abierto
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
          <Wrench className="h-3 w-3 text-indigo-400" /> Seguimiento
        </div>
      </div>

      {/* The Matrix */}
      <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-[9px] font-black tracking-widest text-gray-500 uppercase">
                <th className="px-4 py-4 w-[240px]">CONTACTO ({new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).toUpperCase()})</th>
                {calendarDays.map(d => (
                  <th key={d.date} className="px-1 py-4 text-center border-l border-gray-800/50">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filtered.map((c) => (
                <tr key={c.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-4 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-sm font-bold text-white uppercase truncate max-w-[200px]">
                        {c.nombre?.replace('Contacto Principal - ', '') || 'SIN NOMBRE'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[180px] font-medium flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-gray-500" />
                        {c.empresa_rel_name || c.empresa || 'Empresa No Asignada'}
                      </div>
                      <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm inline-block w-fit ${
                        c.etapa === 'nutricion' ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20' : 'bg-blue-500/10 text-blue-400 border border-blue-400/20'
                      }`}>
                        {c.etapa?.toUpperCase() || 'MARKETING'}
                      </div>
                    </div>
                  </td>

                  {calendarDays.map(d => (
                    <td key={d.date} className="px-1 py-5 text-center border-l border-gray-900/10">
                      <div className="flex justify-center items-center">
                        {getStatusIcon(c, d.date)}
                      </div>
                    </td>
                  ))}

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REDACCION @VENTAS */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-widest text-indigo-400">
              <Mail className="h-5 w-5" /> Redacción @Ventas IA
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Borrador personalizado basado en la última apertura detectada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            <div className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-xl border border-gray-800">
              <span className="text-xs font-black uppercase text-gray-400 w-24">Remitente:</span>
              <div className="flex gap-2">
                {['Vendedor 1', 'Vendedor 2'].map(v => (
                  <button 
                    key={v}
                    onClick={() => setVendedor(v)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                      vendedor === v ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase">Asunto</label>
                <input 
                  type="text" 
                  value={draftData?.subject} 
                  readOnly 
                  className="w-full bg-gray-900 border-none text-white text-sm p-3 rounded-xl" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase">Cuerpo del Correo (Tono Humano)</label>
                <Textarea 
                  value={draftData?.body} 
                  readOnly 
                  rows={8}
                  className="w-full bg-gray-900 border-none text-white text-sm p-3 rounded-xl resize-none" 
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-3 border-t border-gray-800 pt-6">
             <Button 
               variant="outline" 
               className="border-gray-800 text-gray-400 hover:bg-gray-900"
               onClick={() => setIsModalOpen(false)}
             >
              DESCARTAR
             </Button>
             <Button 
               className="bg-indigo-600 hover:bg-indigo-500 text-white font-black"
               onClick={() => {
                 const mailto = `mailto:${draftData.email}?subject=${encodeURIComponent(draftData.subject)}&body=${encodeURIComponent(draftData.body)}`;
                 window.location.href = mailto;
                 setIsModalOpen(false);
                 toast.success("Borrador enviado al gestor de correos");
               }}
             >
              ENVIAR AL GESTOR (Disparar)
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
