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

const STAGES = [
  { id: 1, name: "General", icon: Mail, label: "E1" },
  { id: 2, name: "Servicio Técnico", icon: Wrench, label: "E2" },
  { id: 3, name: "Flotas", icon: Truck, label: "E3" },
  { id: 4, name: "Accesorios", icon: Settings, label: "E4" },
  { id: 5, name: "Inmobiliaria", icon: Building2, label: "E5" },
];

export default function TrazabilidadBrevo() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);

  async function fetchContactos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contactos")
      .select("*")
      .eq("estado", "activo")
      .order("nombre", { ascending: true });

    if (error) toast.error("Error al cargar contactos");
    else setContactos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchContactos();
  }, []);

  async function syncWithBrevo() {
    setLoading(true);
    try {
      const resp = await fetch("/api/sync-brevo", { method: "POST" });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Sincronización exitosa: ${data.processed} eventos`);
        await fetchContactos();
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

  const getStatusIcon = (contacto: any, stageId: number) => {
    const currentStage = contacto.etapa_envio || 0;
    
    // Si ya pasó esta etapa (o es la actual)
    if (currentStage >= stageId) {
      if (currentStage === stageId) {
        const lastStatus = (contacto.ultimo_estado_brevo || "").toLowerCase();
        if (contacto.es_bloqueado) return <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" title="Bloqueado/Rebote" />;
        if (lastStatus === "opened") return <Eye className="h-5 w-5 text-purple-400" title="Abierto" />;
        if (lastStatus === "delivered" || lastStatus === "request") return <CheckCircle2 className="h-5 w-5 text-emerald-400" title="Entregado" />;
        return <Mail className="h-5 w-5 text-blue-400" title="Enviado" />;
      }
      // Etapas anteriores las marcamos como completadas (histórico simplificado)
      return <CheckCircle2 className="h-4 w-4 text-emerald-600/50" title="Completado" />;
    }
    
    return <Circle className="h-3 w-3 text-gray-700" title="Pendiente" />;
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-[10px] font-black tracking-widest text-gray-500 uppercase">
                <th className="px-6 py-4 min-w-[200px]">IDENTIDAD DEL CONTACTO</th>
                {STAGES.map(s => (
                  <th key={s.id} className="px-4 py-4 text-center border-l border-gray-800/50">
                    <div className="flex flex-col items-center gap-1">
                      <s.icon className="h-3 w-3 opacity-50" />
                      <span>{s.label}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-4 border-l border-gray-800/50">ESTADO FINAL</th>
                <th className="px-4 py-4 text-center">⚙️</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filtered.map((c) => (
                <tr key={c.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors uppercase truncate max-w-[180px]">
                      {c.nombre}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono lower">{c.correo}</div>
                  </td>

                  {STAGES.map(s => (
                    <td key={s.id} className="px-4 py-4 text-center border-l border-gray-900/50">
                      <div className="flex justify-center items-center">
                        {getStatusIcon(c, s.id)}
                      </div>
                    </td>
                  ))}

                  <td className="px-6 py-4 border-l border-gray-900/50">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${c.es_bloqueado ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className={`text-[10px] font-black uppercase ${c.es_bloqueado ? 'text-red-500' : 'text-emerald-500'}`}>
                        {c.es_bloqueado ? 'CRITICAL BOUNCE' : (c.ultimo_estado_brevo || 'IDLE')}
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
