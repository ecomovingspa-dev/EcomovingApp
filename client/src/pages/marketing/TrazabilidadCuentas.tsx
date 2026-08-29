// v2.0.0 - Excel-style Sentinel Matrix
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useVendedores } from "../../hooks/useVendedores";
import { 
  Mail, CheckCircle2, Eye, AlertCircle, Circle, 
  Search, RefreshCcw, Trash2, HelpCircle, 
  Wrench, Truck, Settings, Building2,
  Plus, Pencil, ArrowLeft, Sparkles, Check, Lock
} from "lucide-react";
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Copy, Edit2, Loader2, Image as ImageIcon, Settings2 } from "lucide-react";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ZohoMailModal } from "@/components/modals/ZohoMailModal";

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

const normalizeString = (str: string) => {
  return str
    ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : "";
};

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isBuiltIn?: boolean;
}

export default function TrazabilidadCuentas() {
  const { vendedores } = useVendedores();
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [filtroTipoCuenta, setFiltroTipoCuenta] = useState("foco"); // "todos", "foco", "no_foco"
  const [vendedor, setVendedor] = useState("Vendedor 1");
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const [filtroSector, setFiltroSector] = useState("privado");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState("todos");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
  const [filtroSegmentoComercial, setFiltroSegmentoComercial] = useState<string>("todos");
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (vendedores && vendedores.length > 0 && (vendedor === "Vendedor 1" || vendedor === "")) {
      setVendedor(vendedores[0].nombre);
    }
  }, [vendedores]);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  // --- Estados de Plantillas ---
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [selectedContactoDraft, setSelectedContactoDraft] = useState<any>(null);
  const [selectedCuentaDraft, setSelectedCuentaDraft] = useState<any>(null);

  const cleanCompanyShortName = (companyName: string): string => {
    if (!companyName) return "";
    let clean = companyName;
    const prefixesToRemove = [
      /^(caja de compensación de asignación familiar|caja de compensación|ccaf)\s+/gi,
      /^(compañía de|compañia de|corp\.?|corporación|corporacion)\s+/gi,
      /^(sociedad|asociación|asociacion|federación|federacion|fundación|fundacion)\s+/gi,
      /^(distribuidora|importadora|exportadora|comercializadora)\s+/gi,
      /^(servicios|consultoría|consultoria|asesorías|asesorias)\s+/gi
    ];
    for (const regex of prefixesToRemove) {
      clean = clean.replace(regex, "");
    }
    clean = clean.replace(/,?\s*(s\.?a\.?|spa|limitada|ltda\.?|s\.?a\.?c\.?|e\.?i\.?r\.?l\.?|chile|group|grupo|s\.a\.s\.?)\b/gi, "");
    clean = clean.replace(/^[ ,.\t]+/, "").replace(/[,.\s]+$/, "").trim();
    return clean || companyName;
  };

  

  

  


  // Account states
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
  const [isEditCuentaModalOpen, setIsEditCuentaModalOpen] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [busquedaCuentas, setBusquedaCuentas] = useState("");
  const [isCuentaOpen, setIsCuentaOpen] = useState(false);

  const handleVendedorChange = (newVendedor: string) => {
    setVendedor(newVendedor);
  };

  const toggleTemplateSentStatus = async (templateId: string, contact: any) => {
    if (!contact) return;
    
    const wasSent = contact.historial?.some((h: any) => 
      h.mensaje_id?.startsWith(`manual_template:${templateId}:`)
    );

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });

    if (wasSent) {
      const trace = contact.historial.find((h: any) => 
        h.mensaje_id?.startsWith(`manual_template:${templateId}:`)
      );
      
      if (trace) {
        try {
          const { error } = await supabase
            .from("trazabilidad_correos")
            .delete()
            .eq("mensaje_id", trace.mensaje_id);

          if (error) throw error;
          
          toast.success("Estado de envío removido");

          setContactos(prev => prev.map(c => {
            if (c.id === contact.id) {
              return {
                ...c,
                historial: c.historial.filter((h: any) => h.mensaje_id !== trace.mensaje_id)
              };
            }
            return c;
          }));

        } catch (dbErr) {
          console.error("Error al remover trazabilidad:", dbErr);
          toast.error("Error al actualizar la base de datos");
        }
      }
    } else {
      const uniqueMsgId = `manual_template:${templateId}:${Date.now()}`;
      try {
        const { error: traceErr } = await supabase
          .from("trazabilidad_correos")
          .insert({
            contacto_id: contact.id,
            email: contact.correo,
            fecha: todayStr,
            estado: "delivered",
            mensaje_id: uniqueMsgId
          });

        if (traceErr) throw traceErr;

        toast.success("Marcado como enviado");

        const newTraceItem = {
          id: `temp-${Date.now()}`,
          contacto_id: contact.id,
          email: contact.correo,
          fecha: todayStr,
          estado: "delivered",
          mensaje_id: uniqueMsgId,
          created_at: new Date().toISOString()
        };

        setContactos(prev => prev.map(c => {
          if (c.id === contact.id) {
            return {
              ...c,
              historial: [...(c.historial || []), newTraceItem]
            };
          }
          return c;
        }));

      } catch (dbErr) {
        console.error("Error al agregar trazabilidad:", dbErr);
        toast.error("Error al actualizar la base de datos");
      }
    }
  };

  const fetchContactos = async (days: CalendarDay[]) => {
    setLoading(true);
    
    // 1. Obtener todas las cuentas para selectores e información (soportando paginación de más de 1000 registros)
    let allCuentas: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await supabase
          .from("cuentas")
          .select("id, cliente, sector, segmento, cuenta_foco, cuenta_activa")
          .order("cliente")
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allCuentas = [...allCuentas, ...data];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        } else {
          hasMore = false;
        }
      }
      setCuentas(allCuentas);
      // 1.1.2 Cargar segmentos oficiales del catálogo
      const { data: catalogData } = await supabase.from("catalogo_segmentos").select("nombre");
      let currentCatalog: string[] = [];
      if (catalogData && catalogData.length > 0) {
        currentCatalog = Array.from(new Set([...currentCatalog, ...catalogData.map((s: any) => s.nombre).filter(Boolean)]));
      }
      const dbSegments = allCuentas.map((c: any) => c.segmento).filter(Boolean);
      setAvailableSegments(Array.from(new Set([...currentCatalog, ...dbSegments])).sort());
    } catch (cuentasError) {
      console.error("Error al cargar cuentas:", cuentasError);
      toast.error("Error al cargar la lista completa de cuentas");
    }

    const currentCuentas = allCuentas;

    // 1.2 Obtener base de contactos (Prospección, Nutrición y Marketing - solo activos)
    const { data: contactsData, error } = await supabase
      .from("contactos")
      .select("*")
      .in("etapa", ["prospeccion", "marketing"])
      .eq("estado", "activo")
      .not("correo", "is", null)
      .neq("correo", "")
      .order("nombre", { ascending: true });

    if (error) {
      toast.error("Error al cargar contactos");
      setLoading(false);
      return;
    }

    const validContacts = contactsData || [];

    // Apply localStorage segment overrides if any
    validContacts.forEach((c: any) => {
      const savedSeg = localStorage.getItem(`contacto_seg_${c.id}`);
      if (savedSeg) {
        c.segmento = savedSeg;
      }
    });

    // Build accounts map
    const accountsMap: Record<string, { cliente: string; sector: string; segmento?: string; cuenta_foco?: boolean; cuenta_activa?: boolean }> = {};
    currentCuentas.forEach((acc: any) => {
      accountsMap[acc.id] = { 
        cliente: acc.cliente, 
        sector: acc.sector || 'privado',
        segmento: acc.segmento || '',
        cuenta_foco: acc.cuenta_foco || false,
        cuenta_activa: acc.cuenta_activa || false
      };
    });

    // Embed the account name, sector, segment and focus state directly in the contact object mapping:
    validContacts.forEach((c: any) => {
      if (c.cuenta_id && accountsMap[c.cuenta_id]) {
        c.empresa_rel_name = accountsMap[c.cuenta_id].cliente;
        c.empresa_rel_sector = accountsMap[c.cuenta_id].sector;
        c.empresa_rel_segmento = accountsMap[c.cuenta_id].segmento;
        c.empresa_rel_cuenta_foco = accountsMap[c.cuenta_id].cuenta_foco;
        c.empresa_rel_cuenta_activa = accountsMap[c.cuenta_id].cuenta_activa;
      }
    });

    // 2. Obtener historial (trazabilidad_correos) de forma segura y paginada (bypasseando límite de 1000 filas)
    let historyData: any[] = [];
    try {
      let allHistory: any[] = [];
      let from = 0;
      const limit = 1000;
      const startDate = days[0]?.date || '2026-03-01';
      const endDate = days[days.length - 1]?.date || '2026-12-31';
      
      while (true) {
        const { data, error: hError } = await supabase
          .from("trazabilidad_correos")
          .select("*")
          .gte("fecha", startDate)
          .lte("fecha", endDate)
          .range(from, from + limit - 1);

        if (hError) {
          console.error("Error fetching history range:", hError);
          break;
        }

        if (!data || data.length === 0) break;
        allHistory = allHistory.concat(data);
        if (data.length < limit) break;
        from += limit;
      }
      historyData = allHistory;
    } catch (err) {
      console.warn("⚠️ Tabla trazabilidad_correos no detectada o error al paginar. Usando fallback.");
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
    // Generar días laborables basados en el mes y año seleccionados
    const days: CalendarDay[] = [];
    const date = new Date(selectedYear, selectedMonth, 1);
    while (date.getMonth() === selectedMonth) {
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
  }, [selectedMonth, selectedYear]);


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
    // Excluir plantillas de cortesía manuales del historial del día para no marcar checkmarks en la trazabilidad Brevo
    const eventosDelDia = (contacto.historial || []).filter((h: any) => h.fecha === day && !h.mensaje_id?.startsWith("manual_template:"));
    
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
        return (
          <span title={status.toUpperCase()}>
            <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
          </span>
        );
      }

      // APERTURAS
      if (status === "opened" || status === "unique_opened" || status === "clicks" || status === "loadedbyproxy") 
        return <Eye className="h-5 w-5 text-purple-400" />;

      // ENTREGAS
      if (status === "delivered" || status === "request" || status === "requests") 
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      
      return <Mail className="h-5 w-5 text-blue-400" />;
    }

    // 2. FALLBACK: Modelo antiguo (ultimo_envio único) - Solo si no hay historial real en absoluto
    if (!contacto.historial || contacto.historial.length === 0) {
      const ultimoEnvio = contacto.ultimo_envio?.split('T')[0];
      if (ultimoEnvio === day) {
        if (contacto.es_bloqueado) return <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />;
        const lastStatus = (contacto.ultimo_estado_brevo || "").toLowerCase();

        if (lastStatus.includes('bounce') || lastStatus === 'spam' || lastStatus.includes('invalid')) 
          return <AlertCircle className="h-5 w-5 text-red-500" />;

        if (lastStatus === "opened" || lastStatus === "unique_opened" || lastStatus === "clicks" || lastStatus === "loadedbyproxy") 
          return <Eye className="h-5 w-5 text-purple-400" />;
        if (lastStatus === "delivered" || lastStatus.includes("request")) 
          return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
        return <Mail className="h-5 w-5 text-blue-400" />;
      }
    }
    
    return <div className="h-1.5 w-1.5 bg-gray-800 rounded-full" />; // Dot default
  };

  const openEditModal = (c: any) => {
    setSelectedContact({ ...c });
    setIsEditModalOpen(true);
  };

  const handleSaveContact = async () => {
    if (!selectedContact) return;
    if (!selectedContact.nombre?.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!selectedContact.cuenta_id) {
      toast.error("Debe seleccionar una cuenta");
      return;
    }

    setGuardandoContacto(true);
    try {
      const { id, empresa_rel_name, empresa_rel_sector, historial, ...updates } = selectedContact;
      const { error } = await supabase
        .from("contactos")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      toast.success("Contacto actualizado correctamente");
      
      await fetchContactos(calendarDays);
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error("Error al actualizar contacto:", err);
      toast.error("Error al actualizar el contacto");
    } finally {
      setGuardandoContacto(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    if (!confirm("¿Estás seguro de eliminar este contacto?")) return;

    setGuardandoContacto(true);
    try {
      const { error } = await supabase
        .from("contactos")
        .delete()
        .eq("id", selectedContact.id);

      if (error) throw error;
      toast.success("Contacto eliminado correctamente");

      await fetchContactos(calendarDays);
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error("Error al eliminar contacto:", err);
      toast.error("Error al eliminar el contacto");
    } finally {
      setGuardandoContacto(false);
    }
  };

  const openEditCuentaModal = async (cuentaId: string) => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select("*")
        .eq("id", cuentaId)
        .single();
      
      if (error) throw error;
      if (data) {
        setSelectedCuenta(data);
        setIsEditCuentaModalOpen(true);
      }
    } catch (err: any) {
      console.error("Error fetching account:", err);
      toast.error("Error al cargar los datos de la cuenta");
    }
  };

  const handleSaveCuenta = async () => {
    if (!selectedCuenta) return;
    if (!selectedCuenta.cliente?.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    setGuardandoCuenta(true);
    try {
      const { id, ...updates } = selectedCuenta;
      const { error } = await supabase
        .from("cuentas")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      toast.success("Cuenta actualizada correctamente");
      
      await fetchContactos(calendarDays);
      setIsEditCuentaModalOpen(false);
    } catch (err: any) {
      console.error("Error al actualizar cuenta:", err);
      toast.error("Error al actualizar la cuenta");
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const handleDeleteCuenta = async () => {
    if (!selectedCuenta) return;
    if (!confirm("¿Estás seguro de eliminar esta cuenta? Esto podría eliminar o afectar sus contactos vinculados. ¿Deseas continuar?")) return;

    setGuardandoCuenta(true);
    try {
      const { error } = await supabase
        .from("cuentas")
        .delete()
        .eq("id", selectedCuenta.id);

      if (error) throw error;
      toast.success("Cuenta eliminada correctamente");

      await fetchContactos(calendarDays);
      setIsEditCuentaModalOpen(false);
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error("Error al eliminar cuenta:", err);
      toast.error("Error al eliminar la cuenta");
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const matchFlexible = (text: string, search: string) => {
    if (!search || !search.trim()) return true;
    const normSearch = normalizeString(search);
    const words = normSearch.split(/\s+/).filter(Boolean);
    const normText = normalizeString(text || "");
    return words.every(w => normText.includes(w));
  };

  const cuentasFiltradas = cuentas.filter(acc => 
    matchFlexible(acc.cliente, busquedaCuentas)
  );

  const vendedoresMap: Record<string, string> = {};
  if (vendedores) {
    vendedores.forEach(v => {
      vendedoresMap[v.id] = v.nombre;
    });
  }

  const filtered = contactos.filter(c => {
    const accountName = c.empresa_rel_name || c.empresa || "";
    const matchesSearch = matchFlexible(accountName, filtro) || matchFlexible(c.nombre, filtro) || matchFlexible(c.correo, filtro);
    const matchesCriticos = soloCriticos ? c.es_bloqueado : true;
    const matchesActivo = c.empresa_rel_cuenta_activa === true;
    const matchesEtapa = filtroEtapa === "todos" ? true : (c.etapa === filtroEtapa);
    
    const contactSector = c.empresa_rel_sector?.toLowerCase() || "privado";
    const matchesSector = filtroSector === "todos" ? true : (
      filtroSector === "privado"
        ? contactSector === "privado"
        : (contactSector === "público" || contactSector === "publico")
    );

    // Resolve assigned executive name (prefer database relation vendedor_id, fallback to legacy text)
    const contactVendedorName = c.vendedor_id 
      ? (vendedoresMap[c.vendedor_id] || "") 
      : (c.correo_cortesia_vendedor || "");

    const matchesEjecutivo = filtroEjecutivo === "todos" ? true : (
      filtroEjecutivo === "sin_asignar" 
        ? (!contactVendedorName || contactVendedorName.trim() === "")
        : (filtroEjecutivo === "mis_asignados"
            ? contactVendedorName.toLowerCase() === vendedor.toLowerCase()
            : contactVendedorName.toLowerCase() === filtroEjecutivo.toLowerCase())
    );

    const matchesSegmento = filtroSegmento === "todos" ? true : (
      (c.empresa_rel_segmento || "").toLowerCase() === filtroSegmento.toLowerCase()
    );

    const matchesSegmentoComercial = filtroSegmentoComercial === "todos" ? true : (
      (c.segmento || 'A').toUpperCase() === filtroSegmentoComercial.toUpperCase()
    );

    return matchesSearch && matchesCriticos && matchesActivo && matchesEtapa && matchesSector && matchesEjecutivo && matchesSegmento && matchesSegmentoComercial;
  });

  const sortedAndFiltered = [...filtered].sort((a, b) => {
    const aEsProspeccion = a.etapa === 'prospeccion';
    const aTieneAperturas = a.historial?.some((h: any) => 
      ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(h.estado?.toLowerCase())
    ) || ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(a.ultimo_estado_brevo?.toLowerCase());

    const bEsProspeccion = b.etapa === 'prospeccion';
    const bTieneAperturas = b.historial?.some((h: any) => 
      ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(h.estado?.toLowerCase())
    ) || ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(b.ultimo_estado_brevo?.toLowerCase());

    const aPrioridad = aEsProspeccion && aTieneAperturas;
    const bPrioridad = bEsProspeccion && bTieneAperturas;

    if (aPrioridad && !bPrioridad) return -1;
    if (!aPrioridad && bPrioridad) return 1;
    
    // Si tienen la misma prioridad, ordenar alfabéticamente por nombre
    return a.nombre.localeCompare(b.nombre);
  });

  

  

  

  

  


  const abrirModalZoho = (contacto: any, cuenta: any) => {
    setSelectedContactoDraft(contacto);
    setSelectedCuentaDraft(cuenta);
    setIsZohoModalOpen(true);
  };


  

  const formatToInputDate = (dateStr: string): string => {
    if (!dateStr || dateStr === "—") return "";
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return "";
  };

  

  const getTemplateStatus = (contacto: any, template: any, nextTemplate: any, idx: number) => {
    // 1. Group events by message_id
    const eventsByMsg: Record<string, any[]> = {};
    (contacto.historial || []).forEach((h: any) => {
      if (h.mensaje_id) {
        if (!eventsByMsg[h.mensaje_id]) eventsByMsg[h.mensaje_id] = [];
        eventsByMsg[h.mensaje_id].push(h);
      }
    });

    // 2. Identify manual sends/opens and automated sends
    const manualSends: Record<string, { sentEvent?: any; openEvents: any[] }> = {};
    const autoSends: { sentEvent: any; openEvent?: any; date: number }[] = [];

    Object.entries(eventsByMsg).forEach(([msgId, evs]) => {
      if (msgId.startsWith("manual_send:") || msgId.startsWith("manual_template:")) {
        const parts = msgId.split(":");
        const templateId = parts[1];
        if (templateId) {
          if (!manualSends[templateId]) manualSends[templateId] = { openEvents: [] };
          const earliest = evs.reduce((prev, curr) => 
            new Date(prev.created_at || prev.fecha).getTime() < new Date(curr.created_at || curr.fecha).getTime() ? prev : curr
          );
          manualSends[templateId].sentEvent = earliest;
        }
      } else if (msgId.startsWith("manual_open:")) {
        const parts = msgId.split(":");
        if (parts.length >= 4) {
          const templateId = parts[2];
          if (!manualSends[templateId]) manualSends[templateId] = { openEvents: [] };
          // Acumular TODOS los eventos de apertura para contar y obtener primera/última
          evs.forEach(ev => manualSends[templateId].openEvents.push(ev));
        }
      } else {
        // Automated SMTP email
        const sentEvent = evs.find((h: any) => 
          ['delivered', 'request', 'requests', 'deferred'].includes(h.estado?.toLowerCase())
        ) || evs[0];
        const openEvent = evs.find((h: any) => 
          ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(h.estado?.toLowerCase())
        );
        const date = new Date(sentEvent.created_at || sentEvent.fecha).getTime();
        autoSends.push({ sentEvent, openEvent, date });
      }
    });

    // Sort automated sends oldest first
    autoSends.sort((a, b) => a.date - b.date);

    // 3. Resolve status for the current column/template
    // Check manual send first
    let sentEvent = manualSends[template.id]?.sentEvent;
    const allOpenEvents = manualSends[template.id]?.openEvents || [];

    // Fallback: If sent but no open events mapped, check for any open event in history within the timeframe
    if (sentEvent && allOpenEvents.length === 0) {
      const sentTime = new Date(sentEvent.created_at || sentEvent.fecha).getTime();
      
      let nextSentTime = Infinity;
      const nextManualSent = nextTemplate ? manualSends[nextTemplate.id]?.sentEvent : null;
      if (nextManualSent) {
        nextSentTime = new Date(nextManualSent.created_at || nextManualSent.fecha).getTime();
      } else if (autoSends[idx + 1]) {
        nextSentTime = autoSends[idx + 1].date;
      }

      const fallbackOpen = (contacto.historial || []).find((h: any) => 
        ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(h.estado?.toLowerCase()) && 
        new Date(h.created_at || h.fecha).getTime() >= sentTime &&
        new Date(h.created_at || h.fecha).getTime() < nextSentTime
      );
      if (fallbackOpen) allOpenEvents.push(fallbackOpen);
    }

    if (allOpenEvents.length > 0) {
      // Ordenar cronológicamente para obtener primera y última apertura
      const sorted = [...allOpenEvents].sort((a, b) => 
        new Date(a.created_at || a.fecha).getTime() - new Date(b.created_at || b.fecha).getTime()
      );
      const firstOpen = sorted[0];
      const lastOpen = sorted[sorted.length - 1];
      return { 
        status: 'opened', 
        sendDate: sentEvent ? (sentEvent.created_at || sentEvent.fecha) : null,
        firstOpenDate: firstOpen.created_at || firstOpen.fecha,
        lastOpenDate: lastOpen.created_at || lastOpen.fecha,
        openCount: sorted.length
      };
    } else if (sentEvent) {
      return { 
        status: 'sent', 
        sendDate: sentEvent.created_at || sentEvent.fecha 
      };
    }
    return { status: 'none' };
  };

  // Calcula días hábiles (lunes-viernes) transcurridos desde una fecha hasta hoy
  const calcularDiasHabiles = (desde: string, hasta: Date): number => {
    const start = new Date(desde);
    start.setHours(0, 0, 0, 0);
    const end = new Date(hasta);
    end.setHours(0, 0, 0, 0);
    let count = 0;
    const cur = new Date(start);
    cur.setDate(cur.getDate() + 1); // Contar desde el día siguiente al envío
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  // Determina si el banderín rojo debe mostrarse en la columna idx (0=P1, 1=P2, 2=P3)
  const getBanderinStatus = (contacto: any, idx: number): { mostrar: boolean; dias: number } => {
    const fechas = [contacto.fecha_envio_foco, contacto.fecha_envio_foco_2, contacto.fecha_envio_foco_3];
    const fechaAnterior = idx > 0 ? fechas[idx - 1] : null;
    const fechaActual = fechas[idx];
    if (idx === 0) return { mostrar: false, dias: 0 };
    if (fechaActual) return { mostrar: false, dias: 0 };
    if (!fechaAnterior) return { mostrar: false, dias: 0 };
    const dias = calcularDiasHabiles(fechaAnterior, new Date());
    return { mostrar: dias >= 3, dias };
  };

  const renderTemplateCell = (statusObj: any) => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    if (statusObj.status === 'opened') {
      const count = statusObj.openCount || 1;
      const isHot = count >= 3;
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-0.5">
          <div className="relative">
            <Eye className={`h-4 w-4 ${isHot ? 'text-orange-400' : 'text-purple-400'}`} />
            {count > 1 && (
              <span className={`absolute -top-1.5 -right-3 text-[8px] font-black px-1 rounded-full ${isHot ? 'bg-orange-500 text-white' : 'bg-purple-500 text-white'}`}>
                ×{count}
              </span>
            )}
          </div>
          <span className={isHot ? 'text-orange-300 font-bold' : 'text-purple-300'}>Abierto</span>
          <span className="text-gray-500 text-[8px]">Env: {formatDate(statusObj.sendDate)}</span>
          <span className="text-gray-500 text-[8px]">1ª: {formatDate(statusObj.firstOpenDate)}</span>
          <span className="text-gray-500 text-[8px]">Últ: {formatDate(statusObj.lastOpenDate)}</span>
        </div>
      );
    } else if (statusObj.status === 'sent') {
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-300">Enviado</span>
          <span className="text-gray-500 text-[8px]">Env: {formatDate(statusObj.sendDate)}</span>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-1 opacity-50">
          <Circle className="h-4 w-4 text-gray-600" />
          <span className="text-gray-500">Sin enviar</span>
        </div>
      );
    }
  };

  const toggleCampanaActiva = async (contacto: any) => {
    const newEstado = contacto.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      const { error } = await supabase.from('contactos').update({ estado: newEstado }).eq('id', contacto.id);
      if (error) throw error;
      toast.success(`Campaña ${newEstado === 'activo' ? 'activada' : 'pausada'} para ${contacto.nombre}`);
      await fetchContactos(calendarDays);
    } catch (err: any) {
      toast.error('Error al cambiar el estado de la campaña');
    }
  };

  const toggleSegmento = async (contacto: any) => {
    const currentSeg = contacto.segmento || localStorage.getItem(`contacto_seg_${contacto.id}`) || 'A';
    const nuevoSegmento = currentSeg === 'B' ? 'A' : 'B';
    
    // Update local state and localStorage immediately
    contacto.segmento = nuevoSegmento;
    localStorage.setItem(`contacto_seg_${contacto.id}`, nuevoSegmento);

    try {
      await supabase.from('contactos').update({ segmento: nuevoSegmento }).eq('id', contacto.id);
    } catch (err: any) {
      console.warn("Supabase update segmento non-blocking error:", err);
    }

    if (contacto.cuenta_id) {
      try {
        await supabase.from('cuentas').update({ segmento: nuevoSegmento }).eq('id', contacto.cuenta_id);
      } catch (err: any) {
        console.warn("Supabase cuenta update non-blocking error:", err);
      }
    }

    toast.success(`Contacto ${contacto.nombre || ''} movido a Segmento ${nuevoSegmento}`);
    setContactos([...contactos]);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
      {/* Header & Controls */}
      {/* Fila 1: Header, Simbología y Sincronizar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-900/40 p-4 rounded-2xl border border-gray-800 backdrop-blur-sm">
        {/* Izquierda: Logo y Título */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-xl">
            <RefreshCcw className={`h-5 w-5 text-amber-500 ${loading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">🟢 Matrix Sentinel Cuentas Activas</h2>
            <p className="text-xs text-gray-500">Trazabilidad histórica por etapa de envío</p>
          </div>
        </div>



        {/* Derecha: Botón Sincronizar */}
        <div>
          <button 
            onClick={syncWithBrevo}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 h-[36px]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            SINCRONIZAR
          </button>
        </div>
      </div>

      {/* Fila 2: Filtros (Búsqueda, Ejecutivo) */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-900/40 p-4 rounded-2xl border border-gray-800 backdrop-blur-sm">
        <div className="w-[320px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar cuenta..." 
            className="w-full bg-gray-800/50 border-gray-700 rounded-xl pl-10 text-sm py-2 focus:ring-amber-500/50 h-[36px]" 
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        <Select onValueChange={(val) => setFiltroEjecutivo(val)} defaultValue="todos">
          <SelectTrigger className="w-[185px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
            <SelectValue placeholder="EJECUTIVO" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white">
            <SelectItem value="todos">TODOS LOS EJECUTIVOS</SelectItem>
            <SelectItem value="sin_asignar">SIN ASIGNAR</SelectItem>
            {vendedores && vendedores.map(v => (
              <SelectItem key={v.id} value={v.nombre}>{v.nombre.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => setFiltroSegmentoComercial(val)} defaultValue="todos">
          <SelectTrigger className="w-[185px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
            <SelectValue placeholder="SEGMENTO" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white">
            <SelectItem value="todos">TODOS LOS SEGMENTOS</SelectItem>
            <SelectItem value="A">⭐ SEGMENTO A (COTIZARON)</SelectItem>
            <SelectItem value="B">🟢 SEGMENTO B (SIN COTIZAR)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* The Matrix */}
      <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-[9px] font-black tracking-widest text-gray-500 uppercase">
                <th className="px-4 py-4 w-[240px]">
                  CONTACTO
                </th>
                {["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"].map((mes, idx) => (
                  <th key={mes} className="px-1 py-4 text-center border-l border-gray-800/50">
                    <span className="text-[10px] font-black uppercase text-gray-400">{mes}</span>
                  </th>
                ))}
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[90px]">ESTADO SECUENCIA</th>
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[90px]">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {sortedAndFiltered.map((c) => (
                <tr key={c.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-4 py-5 border-r border-gray-900/10">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-white uppercase truncate max-w-[150px]">
                          {c.nombre?.replace('Contacto Principal - ', '') || 'SIN NOMBRE'}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSegmento(c)}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase transition-all shadow-sm cursor-pointer shrink-0",
                            (c.segmento || 'A') === 'B' 
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30" 
                              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30"
                          )}
                          title="Cambiar Segmento (A: Cotizaron / B: Decisor sin cotizar)"
                        >
                          Seg. {c.segmento || 'A'}
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[180px] font-medium flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-gray-500" />
                        {c.empresa_rel_name || c.empresa || 'Empresa No Asignada'}
                      </div>
                    </div>
                  </td>
                  {["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"].map((mes, idx) => {
                    const mesIndexStr = String(idx + 1).padStart(2, '0');
                    const historyForMonth = (c.historial || []).filter((h: any) => {
                      if (!h.fecha) return false;
                      const [yyyy, mm] = h.fecha.split("-");
                      return mm === mesIndexStr && yyyy === String(selectedYear);
                    });

                    const isSent = historyForMonth.length > 0;
                    const latest = historyForMonth.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
                    const statusObj = latest ? {
                      status: latest.estado,
                      fecha: latest.fecha,
                      openCount: latest.open_count
                    } : { status: 'none' };

                    const currentRealMonth = new Date().getMonth();
                    const allHistory = (c.historial || []).sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
                    const lastEmailEver = allHistory[0];
                    let mostrarBanderin = false;
                    let diasDesdeUltimo = 0;
                    
                    if (idx === currentRealMonth) {
                      if (!lastEmailEver) {
                        mostrarBanderin = true;
                        diasDesdeUltimo = 30; // default for never sent
                      } else {
                        const dias = calcularDiasHabiles(lastEmailEver.fecha, new Date());
                        if (dias >= 30) {
                          mostrarBanderin = true;
                          diasDesdeUltimo = dias;
                        }
                      }
                    }

                    return (
                      <td key={mes} className="px-2 py-4 text-center border-l border-gray-800/30 group-hover:border-gray-700/50 relative">
                        {mostrarBanderin && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center animate-bounce">
                            <div className="flex items-center gap-1 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-pulse">
                              <AlertCircle className="h-2 w-2" />
                              <span>{diasDesdeUltimo}D</span>
                            </div>
                            <div className="w-1 h-1 border-l-[4px] border-l-transparent border-t-[4px] border-t-red-600 border-r-[4px] border-r-transparent opacity-90" />
                          </div>
                        )}
                        <div className={`flex flex-col items-center gap-1 cursor-pointer ${mostrarBanderin ? 'mt-4' : ''}`} onClick={() => abrirModalZoho(c, { cliente: c.empresa_rel_name || c.empresa })}>
                          {isSent ? renderTemplateCell(statusObj) : <Circle className="h-4 w-4 text-gray-600" />}
                          <span className="text-[8px] font-medium text-gray-600 mt-1 uppercase tracking-wider">
                            {isSent ? translateStatus(latest.estado) : "Sin enviar"}
                          </span>
                          {isSent && latest.fecha && (
                            <span className="text-[8px] font-bold text-gray-500/80 tracking-tight">
                              Env: {new Date(latest.fecha).getDate().toString().padStart(2, '0')}/{mesIndexStr}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  
                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex flex-col justify-center items-center gap-1.5">
                      <div className="text-[11px] font-black px-3 py-1.5 rounded-md bg-green-500 text-white shadow-md uppercase">
                        ACTIVA
                      </div>
                    </div>
                  </td>

                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex justify-center items-center gap-2">
                      <button 
                        onClick={() => {
                          const mockCuenta = { cliente: c.empresa_rel_name || c.empresa };
                          abrirModalZoho(c, mockCuenta);
                        }} 
                        className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md hover:scale-110 transition-all flex items-center justify-center border border-gray-750"
                        title="Abrir Centro de Envío"
                      >
                        <Mail className="h-4 w-4 text-indigo-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDICIÓN Y GESTIÓN DE CONTACTO */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-widest text-indigo-400">
              <Settings className="h-5 w-5" /> Gestionar Contacto
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Edita la información del contacto o elimínalo de la base de datos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Nombre Completo</Label>
                <Input 
                  type="text" 
                  value={selectedContact?.nombre || ""} 
                  onChange={(e) => setSelectedContact({ ...selectedContact, nombre: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Correo Electrónico</Label>
                <Input 
                  type="email" 
                  value={selectedContact?.correo || ""} 
                  onChange={(e) => setSelectedContact({ ...selectedContact, correo: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Celular</Label>
                <Input 
                  type="text" 
                  value={selectedContact?.celular || ""} 
                  onChange={(e) => setSelectedContact({ ...selectedContact, celular: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Teléfono Fijo</Label>
                <Input 
                  type="text" 
                  value={selectedContact?.telefono || ""} 
                  onChange={(e) => setSelectedContact({ ...selectedContact, telefono: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Departamento</Label>
                <Input 
                  type="text" 
                  value={selectedContact?.departamento || ""} 
                  onChange={(e) => setSelectedContact({ ...selectedContact, departamento: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[10px] font-black text-gray-500 uppercase">Cuenta / Cliente</Label>
                  {selectedContact?.cuenta_id && (
                    <button
                      type="button"
                      onClick={() => openEditCuentaModal(selectedContact.cuenta_id)}
                      className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase flex items-center gap-1 hover:underline"
                    >
                      <Settings className="h-3 w-3" /> Editar Cuenta
                    </button>
                  )}
                </div>
                <Popover open={isCuentaOpen} onOpenChange={setIsCuentaOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCuentaOpen}
                      className="w-full justify-between h-[36px] bg-gray-900 border border-gray-800 text-white hover:bg-gray-850 hover:text-white"
                    >
                      <span className="truncate">
                        {selectedContact?.cuenta_id
                          ? cuentas.find((acc) => acc.id === selectedContact.cuenta_id)?.cliente
                          : "Seleccionar cuenta..."}
                      </span>
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-gray-950 border border-gray-800 text-white shadow-xl animate-in fade-in-50 duration-200" align="start">
                    <div className="flex flex-col h-[250px]">
                      <div className="p-2 border-b border-gray-800">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                          <Input
                            placeholder="Buscar cuenta..."
                            className="pl-8 h-9 text-sm bg-gray-900 border-none text-white focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                            value={busquedaCuentas}
                            onChange={(e) => setBusquedaCuentas(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                        {cuentasFiltradas.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">
                            No se encontraron cuentas.
                          </div>
                        ) : (
                          cuentasFiltradas.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setSelectedContact({ ...selectedContact, cuenta_id: acc.id });
                                setIsCuentaOpen(false);
                                setBusquedaCuentas("");
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
                                selectedContact?.cuenta_id === acc.id
                                  ? "bg-indigo-600 text-white"
                                  : "hover:bg-gray-850 text-gray-300"
                              )}
                            >
                              <span className="truncate pr-2">{acc.cliente}</span>
                              {selectedContact?.cuenta_id === acc.id && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Estado del Contacto</Label>
                <Select 
                  value={selectedContact?.estado || "activo"} 
                  onValueChange={(val) => setSelectedContact({ ...selectedContact, estado: val })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue placeholder="Seleccionar estado..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-850 text-white">
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Etapa de Secuencia</Label>
                <Select 
                  value={selectedContact?.etapa || "marketing"} 
                  onValueChange={(val) => setSelectedContact({ ...selectedContact, etapa: val })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue placeholder="Seleccionar etapa..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-850 text-white">
                    <SelectItem value="prospeccion">Prospección</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Segmento Comercial (Mantención)</Label>
                <Select 
                  value={selectedContact?.segmento || "A"} 
                  onValueChange={(val) => setSelectedContact({ ...selectedContact, segmento: val })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white h-[36px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-950 border border-gray-800 text-white">
                    <SelectItem value="A">⭐ Segmento A (Cotizaron / Interés previo)</SelectItem>
                    <SelectItem value="B">🟢 Segmento B (Decisor validado sin cotizar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


          </div>
          <DialogFooter className="flex justify-between items-center gap-3 border-t border-gray-800 pt-6">
            <Button 
              variant="outline" 
              className="border-red-900/50 hover:bg-red-950/20 text-red-400 hover:text-red-300 font-bold"
              onClick={handleDeleteContact}
              disabled={guardandoContacto}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ELIMINAR
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="border-gray-800 text-gray-400 hover:bg-gray-900"
                onClick={() => setIsEditModalOpen(false)}
                disabled={guardandoContacto}
              >
                CANCELAR
              </Button>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black"
                onClick={handleSaveContact}
                disabled={guardandoContacto}
              >
                {guardandoContacto ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDICIÓN Y GESTIÓN DE CUENTA */}
      <Dialog open={isEditCuentaModalOpen} onOpenChange={setIsEditCuentaModalOpen}>
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-widest text-indigo-400">
              <Building2 className="h-5 w-5" /> Gestionar Cuenta
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Edita la información de la cuenta o elimínala del sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Nombre del Cliente</Label>
                <Input 
                  type="text" 
                  value={selectedCuenta?.cliente || ""} 
                  onChange={(e) => setSelectedCuenta({ ...selectedCuenta, cliente: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">RUT</Label>
                <Input 
                  type="text" 
                  value={selectedCuenta?.rut || ""} 
                  onChange={(e) => setSelectedCuenta({ ...selectedCuenta, rut: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Sector</Label>
                <Select 
                  value={selectedCuenta?.sector || ""} 
                  onValueChange={(val) => setSelectedCuenta({ ...selectedCuenta, sector: val })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-850 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue placeholder="Seleccionar sector..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-850 text-white">
                    <SelectItem value="Privado">Privado</SelectItem>
                    <SelectItem value="Público">Público</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Segmento</Label>
                <Select 
                  value={selectedCuenta?.segmento || ""} 
                  onValueChange={(val) => setSelectedCuenta({ ...selectedCuenta, segmento: val })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-850 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue placeholder="Seleccionar segmento..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-850 text-white max-h-60 overflow-y-auto">
                    {availableSegments.map(seg => (
                      <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Ciudad</Label>
                <Input 
                  type="text" 
                  value={selectedCuenta?.ciudad || ""} 
                  onChange={(e) => setSelectedCuenta({ ...selectedCuenta, ciudad: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Sitio Web</Label>
                <Input 
                  type="url" 
                  value={selectedCuenta?.web || ""} 
                  onChange={(e) => setSelectedCuenta({ ...selectedCuenta, web: e.target.value })}
                  className="bg-gray-900 border border-gray-850 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                />
              </div>
            </div>

            <div className="space-y-1 w-[50%]">
              <Label className="text-[10px] font-black text-gray-500 uppercase">Estado</Label>
              <Select 
                value={selectedCuenta?.estado || "activo"} 
                onValueChange={(val) => setSelectedCuenta({ ...selectedCuenta, estado: val })}
              >
                <SelectTrigger className="bg-gray-900 border-gray-850 text-white focus:ring-1 focus:ring-indigo-500">
                  <SelectValue placeholder="Seleccionar estado..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-850 text-white">
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center gap-3 border-t border-gray-800 pt-6">
            <Button 
              variant="outline" 
              className="border-red-900/50 hover:bg-red-950/20 text-red-400 hover:text-red-300 font-bold"
              onClick={handleDeleteCuenta}
              disabled={guardandoCuenta}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ELIMINAR
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="border-gray-800 text-gray-400 hover:bg-gray-900"
                onClick={() => setIsEditCuentaModalOpen(false)}
                disabled={guardandoCuenta}
              >
                CANCELAR
              </Button>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black"
                onClick={handleSaveCuenta}
                disabled={guardandoCuenta}
              >
                {guardandoCuenta ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REDACCION ZOHO */}
      <ZohoMailModal
        isOpen={isZohoModalOpen}
        onOpenChange={setIsZohoModalOpen}
        contacto={selectedContactoDraft}
        cuenta={selectedCuentaDraft}
        vendedor={vendedor || ""}
        defaultTab="clientes"
        onRefresh={async () => {
          await fetchContactos(calendarDays);
        }}
      />
    </div>
  );
}
