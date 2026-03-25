import { useState, useEffect } from "react";
import { 
  BarChart3, 
  RefreshCcw, 
  AlertCircle, 
  CheckCircle2, 
  Mail, 
  Eye, 
  Trash2, 
  Search 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ContactoLog {
  id: string;
  nombre: string;
  correo: string;
  ultimo_estado_brevo?: string;
  es_bloqueado?: boolean;
  etapa_envio: number;
}

export default function TrazabilidadBrevo() {
  const [contactos, setContactos] = useState<ContactoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [soloBloqueados, setSoloBloqueados] = useState(false);

  useEffect(() => {
    fetchContactos();
  }, []);

  async function fetchContactos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contactos")
      .select("id, nombre, correo, ultimo_estado_brevo, es_bloqueado, etapa_envio")
      .order("nombre");
    
    if (error) toast.error("Error al cargar trazabilidad");
    else setContactos(data || []);
    setLoading(false);
  }

  const stats = {
    enviados: contactos.length,
    abiertos: contactos.filter(c => c.ultimo_estado_brevo === 'opened').length,
    bloqueados: contactos.filter(c => c.es_bloqueado).length
  };

  const filtrados = contactos.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
                         c.correo.toLowerCase().includes(filtro.toLowerCase());
    const matchesBloqueado = soloBloqueados ? c.es_bloqueado : true;
    return matchesSearch && matchesBloqueado;
  });

  return (
    <div className="space-y-6">
      {/* Resumen de Salud */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl"><Mail className="text-blue-500" /></div>
            <div>
              <p className="text-sm text-gray-500">Enviados (Total hoy)</p>
              <h3 className="text-2xl font-bold">{stats.enviados}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl"><Eye className="text-emerald-500" /></div>
            <div>
              <p className="text-sm text-gray-500">Tasa de Apertura</p>
              <h3 className="text-2xl font-bold">
                {stats.enviados > 0 ? ((stats.abiertos / stats.enviados) * 100).toFixed(1) : 0}%
              </h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm border-l-4 border-l-red-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-xl"><AlertCircle className="text-red-500" /></div>
            <div>
              <p className="text-sm text-gray-500">Bloqueados / Bounces</p>
              <h3 className="text-2xl font-bold text-red-500">{stats.bloqueados}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Gestión */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-500"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSoloBloqueados(!soloBloqueados)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                soloBloqueados ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              Ver Bloqueados
            </button>
            <button 
              onClick={fetchContactos}
              className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
            >
              <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Último Estado (Brevo)</th>
                <th className="px-6 py-4">Salud</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{c.nombre}</div>
                    <div className="text-xs text-gray-500">{c.correo}</div>
                  </td>
                  <td className="px-6 py-4 text-sm capitalize">
                    {c.ultimo_estado_brevo || 'Pendiente'}
                  </td>
                  <td className="px-6 py-4">
                    {c.es_bloqueado ? (
                      <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-full w-fit">
                        <AlertCircle className="h-3 w-3" /> BLOQUEADO
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full w-fit">
                        <CheckCircle2 className="h-3 w-3" /> SALUDABLE
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toast.info("Funcionalidad en desarrollo")}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Archivar contacto inválido"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
