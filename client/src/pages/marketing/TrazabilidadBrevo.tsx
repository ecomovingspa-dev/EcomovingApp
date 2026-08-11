// v2.0.0 - Excel-style Sentinel Matrix
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
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
import { cn } from "@/lib/utils";
import { SEGMENTOS_MAESTROS } from "../../utils/constants";

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

export default function TrazabilidadBrevo() {
  const { vendedores } = useVendedores();
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [soloFoco, setSoloFoco] = useState(false);
  const [vendedor, setVendedor] = useState("Vendedor 1");
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const [filtroSector, setFiltroSector] = useState("todos");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState("todos");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
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
  const [templates, setTemplates] = useState<any[]>([]);
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [selectedContactoDraft, setSelectedContactoDraft] = useState<any>(null);
  const [selectedCuentaDraft, setSelectedCuentaDraft] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSendDates, setTemplateSendDates] = useState<Record<string, string>>({});
  const [draftData, setDraftData] = useState<any>(null);
  const [isEditingTemplateMode, setIsEditingTemplateMode] = useState(false);
  const [tempEditSubject, setTempEditSubject] = useState("");
  const [tempEditBody, setTempEditBody] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [guardandoFechas, setGuardandoFechas] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [guardandoImagen, setGuardandoImagen] = useState(false);

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

  const resolveTemplateVariables = (subject: string, body: string, contact: any, account: any, vendedorName: string) => {
    if (!contact) return { resolvedSubject: subject, resolvedBody: body };
    const rawName = (contact.nombre || '').replace('Contacto Principal - ', '').trim();
    const name = rawName.split(' ').map((word: any) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).filter(Boolean).join(' ');
    const firstName = name.split(' ')[0] || '';
    const finalCompany = account?.cliente || contact.empresa || 'su empresa';
    const shortCompany = cleanCompanyShortName(finalCompany);
    const telefonos: Record<string, string> = {
      "Mario Osorio C.": "+56 9 7958 7293",
      "Jimena Lara F.": "+56 9 6528 0052"
    };
    const telefonoVendedor = telefonos[vendedorName] || "+56 9 7958 7293";
    const replaceAll = (text: string) => {
      if (!text) return "";
      return text
        .replace(/{\s*nombre\s*}/gi, name)
        .replace(/{\s*nombre_corto\s*}/gi, firstName)
        .replace(/{\s*contacto\s*}/gi, firstName)
        .replace(/{\s*empresa\s*}/gi, finalCompany)
        .replace(/{\s*empresa_corto\s*}/gi, shortCompany)
        .replace(/{\s*vendedor\s*}/gi, vendedorName)
        .replace(/{\s*telefono\s*}/gi, telefonoVendedor);
    };
    return { resolvedSubject: replaceAll(subject), resolvedBody: replaceAll(body) };
  };

  const loadTemplates = async () => {
    try {
      const { data: dbEtapas, error: dbErr } = await supabase
        .from("configuracion_prospeccion")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (!dbErr && dbEtapas && dbEtapas.length > 0) {
        const prospectionTemplates = dbEtapas.map(etapa => ({
          id: `builtin-prospeccion-${etapa.orden}`,
          dbId: etapa.id,
          orden: etapa.orden,
          name: `${etapa.orden}. ${etapa.nombre}`,
          subject: etapa.asunto_template || "",
          body: `${etapa.mensaje_intro || ""}\n\n${etapa.mensaje_cierre || ""}`.trim()
        }));
        setTemplates(prospectionTemplates);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);


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
          .select("id, cliente, sector, segmento, cuenta_foco")
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
      let currentCatalog: string[] = [...SEGMENTOS_MAESTROS];
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

    // Build accounts map
    const accountsMap: Record<string, { cliente: string; sector: string; segmento?: string; cuenta_foco?: boolean }> = {};
    currentCuentas.forEach((acc: any) => {
      accountsMap[acc.id] = { 
        cliente: acc.cliente, 
        sector: acc.sector || 'privado',
        segmento: acc.segmento || '',
        cuenta_foco: acc.cuenta_foco || false
      };
    });

    // Embed the account name, sector, segment and focus state directly in the contact object mapping:
    validContacts.forEach((c: any) => {
      if (c.cuenta_id && accountsMap[c.cuenta_id]) {
        c.empresa_rel_name = accountsMap[c.cuenta_id].cliente;
        c.empresa_rel_sector = accountsMap[c.cuenta_id].sector;
        c.empresa_rel_segmento = accountsMap[c.cuenta_id].segmento;
        c.empresa_rel_cuenta_foco = accountsMap[c.cuenta_id].cuenta_foco;
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

  const cuentasFiltradas = cuentas.filter(acc => 
    normalizeString(acc.cliente).includes(normalizeString(busquedaCuentas))
  );

  const vendedoresMap: Record<string, string> = {};
  if (vendedores) {
    vendedores.forEach(v => {
      vendedoresMap[v.id] = v.nombre;
    });
  }

  const filtered = contactos.filter(c => {
    const accountName = c.empresa_rel_name || c.empresa || "";
    const matchesSearch = normalizeString(accountName).includes(normalizeString(filtro));
    const matchesCriticos = soloCriticos ? c.es_bloqueado : true;
    const matchesFoco = soloFoco ? (c.empresa_rel_cuenta_foco === true) : true;
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

    return matchesSearch && matchesCriticos && matchesFoco && matchesEtapa && matchesSector && matchesEjecutivo && matchesSegmento;
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

  const startEditingTemplate = (tmpl: any) => {
    setIsEditingTemplateMode(true);
    setTempEditSubject(tmpl.subject);
    setTempEditBody(tmpl.body);
  };

  const handleSaveTemplateChanges = async () => {
    const tmpl = templates.find(t => t.id === selectedTemplateId);
    if (!tmpl || !tmpl.dbId) {
      toast.error("No se encontró el ID de base de datos de la plantilla");
      return;
    }
    
    setGuardandoPlantilla(true);
    try {
      const { error } = await supabase
        .from("configuracion_prospeccion")
        .update({
          asunto_template: tempEditSubject,
          mensaje_intro: tempEditBody,
          mensaje_cierre: ""
        })
        .eq("id", tmpl.dbId);

      if (error) throw error;

      toast.success("¡Plantilla actualizada con éxito en la base de datos!");
      setIsEditingTemplateMode(false);
      await loadTemplates();

      const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
        tempEditSubject,
        tempEditBody,
        selectedContactoDraft,
        selectedCuentaDraft,
        vendedor
      );
      setDraftData({
        email: selectedContactoDraft.correo,
        subject: resolvedSubject,
        body: resolvedBody,
        contactoId: selectedContactoDraft.id
      });
    } catch (err: any) {
      console.error("Error saving template:", err);
      toast.error("Error al actualizar la plantilla: " + err.message);
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContactoDraft) return;

    if (file.size > 1024 * 1024) {
      toast.error("La imagen es demasiado grande. Por favor sube una imagen de menos de 1MB.");
      return;
    }

    setGuardandoImagen(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          
          const { error } = await supabase
            .from("contactos")
            .update({ imagen: base64String })
            .eq("id", selectedContactoDraft.id);

          if (error) throw error;

          toast.success("¡Render personalizado guardado en el contacto!");
          setImageUrl(base64String);
          setSelectedContactoDraft((prev: any) => prev ? { ...prev, imagen: base64String } : null);
          await fetchContactos(calendarDays);
        } catch (err: any) {
          console.error("Error saving image:", err);
          toast.error("Error al procesar la imagen: " + err.message);
        } finally {
          setGuardandoImagen(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Error reading file:", err);
      toast.error("Error al leer el archivo");
      setGuardandoImagen(false);
    }
  };

  const abrirModalZoho = (contacto: any, cuenta: any) => {
    setSelectedContactoDraft(contacto);
    setSelectedCuentaDraft(cuenta);
    setIsZohoModalOpen(true);
    setIsEditingTemplateMode(false);
    setImageUrl(contacto.imagen || "");
    
    setTemplateSendDates({});
    if (contacto && contacto.id) {
      supabase
        .from("trazabilidad_correos")
        .select("mensaje_id, created_at")
        .eq("contacto_id", contacto.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            const datesMap: Record<string, string> = {};
            data.forEach((row: any) => {
              if (row.mensaje_id && row.mensaje_id.startsWith("manual_send:")) {
                const parts = row.mensaje_id.split(":");
                if (parts.length >= 2) {
                  const templateId = parts[1];
                  if (!datesMap[templateId]) {
                    const dateObj = new Date(row.created_at);
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const year = dateObj.getFullYear();
                    const hours = String(dateObj.getHours()).padStart(2, '0');
                    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                    datesMap[templateId] = `${day}/${month}/${year} ${hours}:${minutes}`;
                  }
                }
              }
            });
            setTemplateSendDates(datesMap);
          }
        });
    }
    
    const activeVendedor = vendedor || (vendedores && vendedores.length > 0 ? vendedores[0].nombre : "");
    if (!vendedor && activeVendedor) {
      setVendedor(activeVendedor);
    }
    
    if (templates.length > 0) {
      const firstTmpl = templates[0];
      setSelectedTemplateId(firstTmpl.id);
      const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
        firstTmpl.subject,
        firstTmpl.body,
        contacto,
        cuenta,
        activeVendedor
      );
      setDraftData({
        email: contacto.correo,
        subject: resolvedSubject,
        body: resolvedBody,
        contactoId: contacto.id
      });
    }
  };

  const handleSaveAllTemplateDates = async () => {
    if (!selectedContactoDraft || !selectedContactoDraft.id) return;
    
    setGuardandoFechas(true);
    try {
      const { data: existingEvents, error: fetchErr } = await supabase
        .from("trazabilidad_correos")
        .select("id, mensaje_id")
        .eq("contacto_id", selectedContactoDraft.id);

      if (fetchErr) throw fetchErr;

      let latestDateObj: Date | null = null;

      for (const t of templates) {
        const sendDate = templateSendDates[t.id];
        const targetEvent = existingEvents?.find(row => 
          row.mensaje_id && row.mensaje_id.startsWith(`manual_send:${t.id}:`)
        );

        if (!sendDate || sendDate === "—") {
          if (targetEvent) {
            await supabase.from("trazabilidad_correos").delete().eq("id", targetEvent.id);
          }
          continue;
        }

        const parts = sendDate.split("/");
        if (parts.length === 3) {
          const inputDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
          const targetDate = new Date(`${inputDateStr}T12:00:00`);

          if (!latestDateObj || targetDate > latestDateObj) {
            latestDateObj = targetDate;
          }

          if (targetEvent) {
            await supabase
              .from("trazabilidad_correos")
              .update({
                fecha: inputDateStr,
                created_at: targetDate.toISOString()
              })
              .eq("id", targetEvent.id);
          } else {
            await supabase.from('trazabilidad_correos').insert({
              contacto_id: selectedContactoDraft.id,
              email: selectedContactoDraft.correo.toLowerCase(),
              fecha: inputDateStr,
              estado: 'sent',
              mensaje_id: `manual_send:${t.id}:${targetDate.getTime()}`,
              created_at: targetDate.toISOString()
            });
          }
        }
      }

      if (latestDateObj) {
        await supabase.from('contactos').update({
          ultimo_envio: latestDateObj.toISOString(),
          ultimo_evento_trazabilidad: latestDateObj.toISOString()
        }).eq('id', selectedContactoDraft.id);
      }

      await fetchContactos(calendarDays);
      toast.success("¡Fechas de envío guardadas con éxito!");
    } catch (err: any) {
      console.error("Error saving template dates:", err);
      toast.error("Error al guardar las fechas de envío");
    } finally {
      setGuardandoFechas(false);
    }
  };

  const formatToInputDate = (dateStr: string): string => {
    if (!dateStr || dateStr === "—") return "";
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return "";
  };

  const handleSelectTemplate = (templateId: string, contact = selectedContactoDraft, account = selectedCuentaDraft, activeVendedor = vendedor) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl && contact) {
      const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
        tmpl.subject,
        tmpl.body,
        contact,
        account,
        activeVendedor
      );
      setDraftData({
        email: contact.correo,
        subject: resolvedSubject,
        body: resolvedBody,
        contactoId: contact.id
      });
    }
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
    const manualSends: Record<string, { sentEvent?: any; openEvent?: any }> = {};
    const autoSends: { sentEvent: any; openEvent?: any; date: number }[] = [];

    Object.entries(eventsByMsg).forEach(([msgId, evs]) => {
      if (msgId.startsWith("manual_send:") || msgId.startsWith("manual_template:")) {
        const parts = msgId.split(":");
        const templateId = parts[1];
        if (templateId) {
          if (!manualSends[templateId]) manualSends[templateId] = {};
          const earliest = evs.reduce((prev, curr) => 
            new Date(prev.created_at || prev.fecha).getTime() < new Date(curr.created_at || curr.fecha).getTime() ? prev : curr
          );
          manualSends[templateId].sentEvent = earliest;
        }
      } else if (msgId.startsWith("manual_open:")) {
        const parts = msgId.split(":");
        if (parts.length >= 4) {
          const templateId = parts[2];
          if (!manualSends[templateId]) manualSends[templateId] = {};
          const earliest = evs.reduce((prev, curr) => 
            new Date(prev.created_at || prev.fecha).getTime() < new Date(curr.created_at || curr.fecha).getTime() ? prev : curr
          );
          manualSends[templateId].openEvent = earliest;
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
    let openEvent = manualSends[template.id]?.openEvent;

    // Fallback: If sent but no open event mapped, check for any open event in history within the timeframe
    if (sentEvent && !openEvent) {
      const sentTime = new Date(sentEvent.created_at || sentEvent.fecha).getTime();
      
      // Determine the next send event (either manual or automated for the next stage)
      let nextSentTime = Infinity;
      const nextManualSent = nextTemplate ? manualSends[nextTemplate.id]?.sentEvent : null;
      if (nextManualSent) {
        nextSentTime = new Date(nextManualSent.created_at || nextManualSent.fecha).getTime();
      } else if (autoSends[idx + 1]) {
        nextSentTime = autoSends[idx + 1].date;
      }

      openEvent = (contacto.historial || []).find((h: any) => 
        ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(h.estado?.toLowerCase()) && 
        new Date(h.created_at || h.fecha).getTime() >= sentTime &&
        new Date(h.created_at || h.fecha).getTime() < nextSentTime
      );
    }

    if (openEvent) {
      return { 
        status: 'opened', 
        sendDate: sentEvent ? (sentEvent.created_at || sentEvent.fecha) : null,
        openDate: openEvent.created_at || openEvent.fecha
      };
    } else if (sentEvent) {
      return { 
        status: 'sent', 
        sendDate: sentEvent.created_at || sentEvent.fecha 
      };
    }
    return { status: 'none' };
  };

  const renderTemplateCell = (statusObj: any) => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    if (statusObj.status === 'opened') {
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-1">
          <Eye className="h-4 w-4 text-purple-400" />
          <span className="text-purple-300">Abierto</span>
          <span className="text-gray-500 text-[8px]">Env: {formatDate(statusObj.sendDate)}</span>
          <span className="text-gray-500 text-[8px]">Lec: {formatDate(statusObj.openDate)}</span>
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
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">Matrix Sentinel v2.0</h2>
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

      {/* Fila 2: Filtros (Búsqueda, Todos/Críticos, Ejecutivo, Sector, Segmento) */}
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

        <div className="flex items-center gap-1.5 ml-auto">
          <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
            <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
              <SelectValue placeholder="MES" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="0">ENERO</SelectItem>
              <SelectItem value="1">FEBRERO</SelectItem>
              <SelectItem value="2">MARZO</SelectItem>
              <SelectItem value="3">ABRIL</SelectItem>
              <SelectItem value="4">MAYO</SelectItem>
              <SelectItem value="5">JUNIO</SelectItem>
              <SelectItem value="6">JULIO</SelectItem>
              <SelectItem value="7">AGOSTO</SelectItem>
              <SelectItem value="8">SEPTIEMBRE</SelectItem>
              <SelectItem value="9">OCTUBRE</SelectItem>
              <SelectItem value="10">NOVIEMBRE</SelectItem>
              <SelectItem value="11">DICIEMBRE</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-[90px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
              <SelectValue placeholder="AÑO" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                {templates.slice(0, 3).map((t: any, idx: number) => (
                  <th key={t.id} className="px-1 py-4 text-center border-l border-gray-800/50">
                    {idx + 1}° Correo<br/><span className="text-[7px] text-gray-400 capitalize">{t.name.split('. ')[1] || t.name}</span>
                  </th>
                ))}
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[110px] text-gray-500">ESTADO SECUENCIA</th>
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[110px] text-gray-500">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {sortedAndFiltered.map((c) => (
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
                        c.estado === 'activo' ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20' : 'bg-gray-500/10 text-gray-400 border border-gray-400/20'
                      }`}>
                        {c.estado === 'activo' ? 'CAMPAÑA ACTIVA' : 'CAMPAÑA PAUSADA'}
                      </div>
                    </div>
                  </td>

                  {templates.slice(0, 3).map((t: any, idx: number, arr: any[]) => (
                    <td key={t.id} className="px-1 py-5 text-center border-l border-gray-900/10">
                      {renderTemplateCell(getTemplateStatus(c, t, arr[idx + 1], idx))}
                    </td>
                  ))}

                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex justify-center items-center">
                      <div className={`text-[9px] font-black px-2 py-1 rounded-md ${
                        c.etapa === 'prospeccion' ? 'bg-amber-500 text-gray-900' : 'bg-blue-500 text-white'
                      }`}>
                        {c.etapa?.toUpperCase() || 'MARKETING'}
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
                        title="Abrir Zoho / Acciones Sentinel"
                      >
                        <Settings2 className="h-4 w-4 text-indigo-400" />
                      </button>
                      <button 
                        onClick={() => toggleCampanaActiva(c)}
                        className={`p-1 rounded-md transition-all flex items-center justify-center border ${c.estado === 'activo' ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400 border-green-900/50' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-750'}`}
                        title={c.estado === 'activo' ? "Pausar Campaña" : "Reactivar Campaña"}
                      >
                        {c.estado === 'activo' ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
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
      <Dialog open={isZohoModalOpen} onOpenChange={setIsZohoModalOpen}>
        <DialogContent className="max-w-6xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl text-gray-900 dark:text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Mail className="h-5 w-5" /> Redacción e Inteligencia de Plantillas Zoho
            </DialogTitle>
            <DialogDescription className="text-gray-505">
              Selecciona una plantilla para enviar a {selectedContactoDraft?.nombre}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-12 gap-6 my-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            
            {/* Columna Izquierda: Plantillas */}
            <div className="col-span-12 md:col-span-3 border-r border-gray-100 dark:border-gray-800 pr-4 flex flex-col justify-between h-[450px]">
              <div className="flex flex-col space-y-3 overflow-hidden">
                <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plantillas Disponibles
                </span>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
                  {templates.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => {
                        setIsEditingTemplateMode(false);
                        handleSelectTemplate(t.id);
                      }}
                      className={cn(
                        "group p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 h-12",
                        selectedTemplateId === t.id
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <span className="text-xs font-bold truncate flex-1">{t.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplateId(t.id);
                          startEditingTemplate(t);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-all shrink-0"
                        title="Editar estructura de plantilla"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Columna Central: Fecha de Envío */}
            <div className="col-span-12 md:col-span-2 border-r border-gray-100 dark:border-gray-800 pr-4 flex flex-col justify-between h-[450px]">
              <div className="flex flex-col space-y-3 overflow-hidden min-h-0">
                <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fecha de Envío
                </span>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[320px]">
                  {templates.map(t => {
                    const sendDate = templateSendDates[t.id];
                    const dateOnly = sendDate ? sendDate.split(" ")[0] : "—";
                    return (
                      <div 
                        key={`date-${t.id}`}
                        onClick={() => {
                          setIsEditingTemplateMode(false);
                          handleSelectTemplate(t.id);
                        }}
                        className={cn(
                          "group p-1.5 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center h-12 text-xs font-bold",
                          selectedTemplateId === t.id
                            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-400 text-indigo-600 dark:text-indigo-400 shadow-sm"
                            : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80"
                        )}
                      >
                        <input 
                          type="date"
                          value={dateOnly !== "—" ? formatToInputDate(dateOnly) : ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const [year, month, day] = val.split("-");
                              setTemplateSendDates(prev => ({
                                ...prev,
                                [t.id]: `${day}/${month}/${year}`
                              }));
                            } else {
                              setTemplateSendDates(prev => ({
                                ...prev,
                                [t.id]: ""
                              }));
                            }
                          }}
                          className={cn(
                            "bg-transparent text-center border-none outline-none focus:ring-0 w-full text-xs cursor-pointer font-bold select-none",
                            dateOnly !== "—" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-450 dark:text-gray-600"
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveAllTemplateDates}
                disabled={guardandoFechas}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md text-xs cursor-pointer mt-2 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {guardandoFechas && <Loader2 className="h-3 w-3 animate-spin" />}
                {guardandoFechas ? "GUARDANDO..." : "GUARDAR FECHAS"}
              </button>
            </div>

            {/* Columna Derecha: Contenido del Correo o Editor de Plantilla */}
            <div className="col-span-12 md:col-span-7 flex flex-col h-[450px]">
              {isEditingTemplateMode ? (
                <div className="space-y-4 flex-grow flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      ✏️ Editando Estructura de Plantilla (Original)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingTemplateMode(false)}
                      className="text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      Volver a Vista Previa
                    </button>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Asunto Base (Con Placeholders)</label>
                    <input 
                      type="text" 
                      value={tempEditSubject} 
                      onChange={(e) => setTempEditSubject(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="Ej: Consulta rápida sobre regalos o merchandising en {empresa}"
                    />
                  </div>

                  <div className="flex-grow flex flex-col space-y-1 min-h-0">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cuerpo Base (Con Placeholders)</label>
                    <textarea 
                      value={tempEditBody} 
                      onChange={(e) => setTempEditBody(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none resize-none min-h-0 font-sans"
                      placeholder="Hola {nombre_corto}, te escribo..."
                    />
                  </div>

                  <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl text-[10px] text-gray-500 space-y-1 font-medium">
                    <div className="font-bold text-gray-700 dark:text-gray-400 uppercase text-[8px] tracking-wider">Variables Admitidas:</div>
                    <div><code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{nombre}"}</code>: Nombre completo | <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{nombre_corto}"}</code> o <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{contacto}"}</code>: Primer nombre.</div>
                    <div><code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{empresa}"}</code>: Nombre completo | <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{empresa_corto}"}</code>: Nombre comercial | <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{vendedor}"}</code>: Vendedor | <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{telefono}"}</code>: Teléfono.</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 flex-grow flex flex-col overflow-hidden">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destinatario</label>
                      <input 
                        type="text" 
                        value={draftData?.email || ""} 
                        disabled
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-xs text-gray-505 rounded-lg p-2.5 font-mono"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado Campaña</label>
                      <div className="flex items-center h-[38px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 justify-between">
                        <span className={`text-[10px] font-bold uppercase ${selectedContactoDraft?.estado === 'activo' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                          {selectedContactoDraft?.estado === 'activo' ? 'Campaña Activa' : 'Campaña Pausada'}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedContactoDraft) return;
                            const newEstado = selectedContactoDraft.estado === 'activo' ? 'inactivo' : 'activo';
                            try {
                              const { error } = await supabase
                                .from('contactos')
                                .update({ estado: newEstado })
                                .eq('id', selectedContactoDraft.id);
                              if (error) throw error;
                              
                              setSelectedContactoDraft(prev => ({ ...prev, estado: newEstado }));
                              toast.success(`Campaña ${newEstado === 'activo' ? 'activada' : 'pausada'} para ${selectedContactoDraft.nombre}`);
                              fetchContactos(calendarDays);
                            } catch (err: any) {
                              toast.error('Error al actualizar estado de campaña');
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${selectedContactoDraft?.estado === 'activo'
                            ? "bg-green-500 dark:bg-green-600 shadow-sm shadow-green-500/50"
                            : "bg-gray-300 dark:bg-gray-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${selectedContactoDraft?.estado === 'activo'
                              ? "translate-x-5"
                              : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Asunto del Correo</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={draftData?.subject || ""} 
                        onChange={(e) => setDraftData(draftData ? { ...draftData, subject: e.target.value } : null)}
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (draftData?.subject) {
                            await navigator.clipboard.writeText(draftData.subject);
                            toast.success("Asunto copiado");
                          }
                        }}
                        className="px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-xs font-bold rounded-lg transition-all"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  {/* Widget para Subir Render Personalizado desde Computador (Base64) */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      {imageUrl ? (
                        <img src={imageUrl} className="h-10 w-10 object-cover rounded-lg border border-gray-250 dark:border-gray-700 shadow-sm" alt="Preview render" />
                      ) : (
                        <div className="h-10 w-10 bg-gray-250 dark:bg-gray-800 rounded-lg flex items-center justify-center text-[10px] text-gray-400 font-bold border border-dashed border-gray-300 dark:border-gray-700">
                          S/R
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">Render Personalizado</div>
                        <div className="text-[10px] text-gray-500">Se guardará en la ficha del contacto y se insertará en el correo</div>
                      </div>
                    </div>
                    <input 
                      type="file" 
                      id="render-image-upload" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                    />
                    <label 
                      htmlFor="render-image-upload" 
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold cursor-pointer transition-all border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1 shadow-sm"
                    >
                      {guardandoImagen ? "Procesando..." : (imageUrl ? "Reemplazar Render" : "Subir Render")}
                    </label>
                  </div>

                  <div className="flex-1 flex flex-col space-y-1 min-h-0">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mensaje (Cuerpo)</label>
                    <textarea 
                      value={draftData?.body || ""} 
                      onChange={(e) => setDraftData(draftData ? { ...draftData, body: e.target.value } : null)}
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none resize-none min-h-0 font-sans"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
            {isEditingTemplateMode ? (
              <>
                <button 
                  onClick={() => setIsEditingTemplateMode(false)}
                  disabled={guardandoPlantilla}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleSaveTemplateChanges}
                  disabled={guardandoPlantilla}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md text-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {guardandoPlantilla && <Loader2 className="h-3 w-3 animate-spin" />}
                  GUARDAR CAMBIOS EN PLANTILLA
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsZohoModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  DESCARTAR
                </button>
                <button 
                  onClick={async () => {
                    if (draftData && selectedContactoDraft && selectedCuentaDraft) {
                      try {
                        const telefonos: Record<string, string> = {
                          "Mario Osorio C.": "+56 9 7958 7293",
                          "Jimena Lara F.": "+56 9 6528 0052"
                        };
                        const tel = telefonos[vendedor] || "+56 9 7958 7293";

                        let cleanBody = draftData.body;
                        const signatureToSearch = `Saludos,\n\n${vendedor}\n${tel}\nwww.ecomoving.cl`;
                        if (cleanBody.includes(signatureToSearch)) {
                          cleanBody = cleanBody.replace(signatureToSearch, "").trim();
                        }
                        const signatureToSearchSimple = `Saludos,\n\n${vendedor}`;
                        if (cleanBody.includes(signatureToSearchSimple)) {
                          cleanBody = cleanBody.replace(signatureToSearchSimple, "").trim();
                        }

                        let htmlBody = cleanBody.replace(/\n/g, "<br/>");
                        
                        if (imageUrl.trim()) {
                          const imgTag = `<img src="${imageUrl.trim()}" alt="Render Ecomoving" style="max-width:100%; height:auto; margin: 20px 0; border-radius: 12px; border: 1px solid #e2e8f0; display: block;" />`;
                          
                          const imagePlaceholders = [
                            /\{\s*imagen\s*\}/gi,
                            /\{\s*imagen_url\s*\}/gi,
                            /\{\s*render\s*\}/gi,
                            /\(\s*imagen pegada en el cuerpo del correo\s*\)/gi
                          ];

                          let replaced = false;
                          for (const regex of imagePlaceholders) {
                            if (regex.test(htmlBody)) {
                              htmlBody = htmlBody.replace(regex, imgTag);
                              replaced = true;
                            }
                          }

                          if (!replaced) {
                            const paragraphs = htmlBody.split("<br/><br/>");
                            if (paragraphs.length > 1) {
                              paragraphs.splice(1, 0, imgTag);
                              htmlBody = paragraphs.join("<br/><br/>");
                            } else {
                              htmlBody = htmlBody + "<br/><br/>" + imgTag;
                            }
                          }
                        } else {
                          htmlBody = htmlBody
                            .replace(/{\s*imagen\s*}/gi, "")
                            .replace(/{\s*imagen_url\s*}/gi, "")
                            .replace(/{\s*render\s*}/gi, "")
                            .replace(/\(\s*imagen pegada en el cuerpo del correo\s*\)/gi, "");
                        }

                        const pixelUrl = `${window.location.origin}/api/sentinel-pixel?contacto_id=${selectedContactoDraft?.id}&template_id=${selectedTemplateId || ''}`;
                        const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" />`;
                        htmlBody = htmlBody + pixelTag;

                        try {
                          const typeHtml = "text/html";
                          const typeText = "text/plain";
                          const blobHtml = new Blob([htmlBody], { type: typeHtml });
                          const plainTextForClip = cleanBody
                            .replace(/{\s*imagen\s*}/gi, "")
                            .replace(/{\s*imagen_url\s*}/gi, "")
                            .replace(/{\s*render\s*}/gi, "")
                            .replace(/\(\s*imagen pegada en el cuerpo del correo\s*\)/gi, "");
                          const blobText = new Blob([plainTextForClip], { type: typeText });
                          
                          const data = [
                            new ClipboardItem({
                              [typeHtml]: blobHtml,
                              [typeText]: blobText
                            })
                          ];
                          await navigator.clipboard.write(data);
                        } catch (clipErr) {
                          console.warn("ClipboardItem API failed, falling back to writeText:", clipErr);
                          await navigator.clipboard.writeText(cleanBody);
                        }

                        const now = new Date();
                        const timestamp = now.getTime();
                        const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        
                        setTemplateSendDates(prev => ({
                          ...prev,
                          [selectedTemplateId]: formattedDate
                        }));

                        await supabase.from('contactos').update({
                          ultimo_envio: now.toISOString(),
                          ultimo_evento_trazabilidad: now.toISOString(),
                          estado: "activo",
                          etapa: "marketing"
                        }).eq('id', selectedContactoDraft.id);

                        await supabase.from('trazabilidad_correos').insert({
                          contacto_id: selectedContactoDraft.id,
                          email: selectedContactoDraft.correo.toLowerCase(),
                          fecha: now.toISOString().split('T')[0],
                          estado: 'sent',
                          mensaje_id: `manual_send:${selectedTemplateId}:${timestamp}`
                        });
                        
                        fetchContactos(calendarDays);

                        setIsZohoModalOpen(false);
                        toast.success("¡Cuerpo e imagen copiados! Puedes pegarlo en tu correo.");
                      } catch (err: any) {
                        console.error("Error al copiar:", err);
                        toast.error("Error al copiar el cuerpo");
                      }
                    }
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md text-xs cursor-pointer"
                >
                  COPIAR CUERPO
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
