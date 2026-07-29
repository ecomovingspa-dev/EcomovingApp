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

  useEffect(() => {
    if (vendedores && vendedores.length > 0 && (vendedor === "Vendedor 1" || vendedor === "")) {
      setVendedor(vendedores[0].nombre);
    }
  }, [vendedores]);
  const [draftData, setDraftData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  // --- Estados de Plantillas ---
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedContactoDraft, setSelectedContactoDraft] = useState<any>(null);
  const [editorMode, setEditorMode] = useState<"redactar" | "crear" | "editar">("redactar");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Campos formulario de plantilla
  const [templateFormName, setTemplateFormName] = useState("");
  const [templateFormSubject, setTemplateFormSubject] = useState("");
  const [templateFormBody, setTemplateFormBody] = useState("");

  // Account states
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
  const [isEditCuentaModalOpen, setIsEditCuentaModalOpen] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [busquedaCuentas, setBusquedaCuentas] = useState("");
  const [isCuentaOpen, setIsCuentaOpen] = useState(false);

  const resolveTemplateVariables = (subject: string, body: string, contact: any, vendedorName: string) => {
    if (!contact) return { resolvedSubject: subject, resolvedBody: body };
    
    // Clean and normalize the name (e.g. "Contacto Principal - VERONICA FONSECA" -> "Veronica Fonseca")
    const rawName = (contact.nombre || '').replace('Contacto Principal - ', '').trim();
    const name = rawName.split(' ').map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).filter(Boolean).join(' ');
    
    const firstName = name.split(' ')[0] || '';
    const finalCompany = contact.empresa_rel_name || contact.empresa || 'su empresa';

    // Obtener teléfono según el vendedor
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
        .replace(/{\s*vendedor\s*}/gi, vendedorName)
        .replace(/{\s*telefono\s*}/gi, telefonoVendedor);
    };

    return {
      resolvedSubject: replaceAll(subject),
      resolvedBody: replaceAll(body)
    };
  };

  const handleVendedorChange = (newVendedor: string) => {
    const oldVendedor = vendedor;
    setVendedor(newVendedor);
    
    // Obtener teléfonos para la firma
    const telefonos: Record<string, string> = {
      "Mario Osorio C.": "+56 9 7958 7293",
      "Jimena Lara F.": "+56 9 6528 0052"
    };
    const oldTelefono = telefonos[oldVendedor] || "+56 9 7958 7293";
    const newTelefono = telefonos[newVendedor] || "+56 9 7958 7293";

    // If we have selectedContactoDraft and selectedTemplateId, we can re-resolve the body with the new vendedor
    if (selectedContactoDraft && selectedTemplateId && draftData) {
      const currentTmpl = templates.find(t => t.id === selectedTemplateId);
      if (currentTmpl) {
        // Resolve template with old vendor to see if user has customized it
        const oldResolved = resolveTemplateVariables(currentTmpl.subject, currentTmpl.body, selectedContactoDraft, oldVendedor);
        
        // If current body matches old resolved body, we can safely overwrite it with new resolved body
        if (draftData.body === oldResolved.resolvedBody) {
          const newResolved = resolveTemplateVariables(currentTmpl.subject, currentTmpl.body, selectedContactoDraft, newVendedor);
          setDraftData({
            ...draftData,
            subject: draftData.subject === oldResolved.resolvedSubject ? newResolved.resolvedSubject : draftData.subject,
            body: newResolved.resolvedBody
          });
          return;
        }
      }
    }
    
    if (draftData && draftData.body) {
      const oldSignature = `Saludos,\n\n${oldVendedor}\n${oldTelefono}\nwww.ecomoving.cl`;
      const newSignature = `Saludos,\n\n${newVendedor}\n${newTelefono}\nwww.ecomoving.cl`;
      if (draftData.body.includes(oldSignature)) {
        setDraftData({
          ...draftData,
          body: draftData.body.replace(oldSignature, newSignature)
        });
      } else {
        const oldSignatureSimple = `Saludos,\n\n${oldVendedor}`;
        const newSignatureSimple = `Saludos,\n\n${newVendedor}`;
        if (draftData.body.includes(oldSignatureSimple)) {
          setDraftData({
            ...draftData,
            body: draftData.body.replace(oldSignatureSimple, newSignatureSimple)
          });
        }
      }
    }
  };

  const handleSaveTemplate = () => {
    if (!templateFormName.trim()) {
      toast.error("El nombre de la plantilla es obligatorio");
      return;
    }
    if (!templateFormSubject.trim()) {
      toast.error("El asunto de la plantilla es obligatorio");
      return;
    }
    if (!templateFormBody.trim()) {
      toast.error("El cuerpo de la plantilla es obligatorio");
      return;
    }

    if (editorMode === "crear") {
      const newT: EmailTemplate = {
        id: `custom-${Date.now()}`,
        name: templateFormName,
        subject: templateFormSubject,
        body: templateFormBody
      };
      const updated = [...templates, newT];
      localStorage.setItem("ecomoving_custom_templates", JSON.stringify(updated));
      setTemplates(updated);
      toast.success("Plantilla creada correctamente");
      
      // Auto-select the newly created template
      setSelectedTemplateId(newT.id);
      if (selectedContactoDraft) {
        const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
          newT.subject,
          newT.body,
          selectedContactoDraft,
          vendedor
        );
        setDraftData({
          email: selectedContactoDraft.correo,
          subject: resolvedSubject,
          body: resolvedBody,
          contactoId: selectedContactoDraft.id
        });
      }
    } else if (editorMode === "editar" && editingTemplateId) {
      const updated = templates.map(t => 
        t.id === editingTemplateId 
          ? { ...t, name: templateFormName, subject: templateFormSubject, body: templateFormBody } 
          : t
      );
      localStorage.setItem("ecomoving_custom_templates", JSON.stringify(updated));
      setTemplates(updated);
      toast.success("Plantilla actualizada correctamente");

      // Si es una plantilla de prospección oficial, guardamos de forma asíncrona en Supabase configuracion_prospeccion
      if (editingTemplateId.startsWith("builtin-prospeccion-")) {
        const ordenStr = editingTemplateId.replace("builtin-prospeccion-", "");
        const orden = parseInt(ordenStr);
        if (!isNaN(orden)) {
          let intro = templateFormBody;
          let cierre = "";
          const idx = templateFormBody.indexOf("Saludos,");
          if (idx !== -1) {
            intro = templateFormBody.substring(0, idx).trim();
            cierre = templateFormBody.substring(idx).trim();
          }

          supabase
            .from("configuracion_prospeccion")
            .update({
              asunto_template: templateFormSubject,
              mensaje_intro: intro,
              mensaje_cierre: cierre
            })
            .eq("orden", orden)
            .then(({ error }) => {
              if (error) {
                console.error("Error updating prospection template in database:", error);
                toast.error("Error al persistir en la base de datos");
              } else {
                toast.success("Plantilla sincronizada con la base de datos");
              }
            });
        }
      }
      
      if (selectedTemplateId === editingTemplateId) {
        // Force refresh editor preview
        const editedTemplate = updated.find(t => t.id === editingTemplateId);
        if (editedTemplate && selectedContactoDraft) {
          const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
            editedTemplate.subject,
            editedTemplate.body,
            selectedContactoDraft,
            vendedor
          );
          setDraftData({
            email: selectedContactoDraft.correo,
            subject: resolvedSubject,
            body: resolvedBody,
            contactoId: selectedContactoDraft.id
          });
        }
      }
    }

    setEditorMode("redactar");
    setEditingTemplateId(null);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de eliminar esta plantilla?")) return;

    const updated = templates.filter(t => t.id !== id);
    localStorage.setItem("ecomoving_custom_templates", JSON.stringify(updated));
    setTemplates(updated);
    toast.success("Plantilla eliminada correctamente");

    if (selectedTemplateId === id) {
      if (updated.length > 0) {
        handleSelectTemplate(updated[0].id);
      } else {
        setSelectedTemplateId("");
        setDraftData(null);
      }
    }
  };

  const handleSelectTemplate = (id: string, contact = selectedContactoDraft) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find(t => t.id === id);
    if (tmpl && contact) {
      const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
        tmpl.subject,
        tmpl.body,
        contact,
        vendedor
      );
      setDraftData({
        email: contact.correo,
        subject: resolvedSubject,
        body: resolvedBody,
        contactoId: contact.id
      });
    }
  };

  const toggleCortesiaRespondido = async (contact: any) => {
    const newValue = !contact.correo_cortesia_respondido;
    try {
      const { error } = await supabase
        .from("contactos")
        .update({ correo_cortesia_respondido: newValue })
        .eq("id", contact.id);

      if (error) throw error;
      toast.success(newValue ? "Marcado como respondido" : "Marcado como no respondido");
      
      setContactos(prev => prev.map(c => {
        if (c.id === contact.id) {
          return { ...c, correo_cortesia_respondido: newValue };
        }
        return c;
      }));
    } catch (err) {
      console.error("Error al actualizar estado de respuesta:", err);
      toast.error("Error al actualizar el estado de respuesta");
    }
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

          setSelectedContactoDraft((prev: any) => {
            if (prev && prev.id === contact.id) {
              return {
                ...prev,
                historial: prev.historial.filter((h: any) => h.mensaje_id !== trace.mensaje_id)
              };
            }
            return prev;
          });
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

        setSelectedContactoDraft((prev: any) => {
          if (prev && prev.id === contact.id) {
            return {
              ...prev,
              historial: [...(prev.historial || []), newTraceItem]
            };
          }
          return prev;
        });
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

    // 1.2 Obtener base de contactos (Prospección, Nutrición y Marketing)
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
      
      while (true) {
        const { data, error: hError } = await supabase
          .from("trazabilidad_correos")
          .select("*")
          .gte("fecha", startDate)
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

    // Initialize templates from Supabase configuracion_prospeccion and localStorage
    const defaultTemplates: EmailTemplate[] = [
      {
        id: "builtin-prospeccion-1",
        name: "1. Consulta de Relación (Ice-Breaker)",
        subject: "Consulta rápida sobre regalos o merchandising en {empresa}",
        body: "Hola {nombre_corto},\n\nEspero que estés teniendo una excelente semana.\n\nTe escribo brevemente con la esperanza de poder conversar contigo sobre la gestión de regalos corporativos o merchandising para {empresa}.\n\nSé que coordinar estos artículos suele ser un dolor de cabeza silencioso (buscar proveedores que respondan rápido, asegurarse de que los logos queden perfectos y cruzar los dedos para que todo llegue a tiempo para el evento).\n\nSolo quería preguntar de manera muy abierta y relajada: ¿tienen planificado algún proyecto de regalos corporativos o merchandising en carpeta para estos meses en el que te vendría bien una mano?\n\nNo pretendo venderte nada a la fuerza hoy. Pero si te sirve tener una opción de confianza y rápida para cotizar cuando lo necesites, me avisas y te comparto algunas ideas o nuestro catálogo digital.\n\nSaludos,\n\n{vendedor}\n{telefono}\nwww.ecomoving.cl"
      },
      {
        id: "builtin-prospeccion-2",
        name: "2. Seguimiento Empático (Valor sin presión)",
        subject: "Re: Consulta rápida sobre regalos o merchandising en {empresa}",
        body: "Hola {nombre_corto},\n\nEspero que vaya todo muy bien.\n\nTe escribo de manera muy breve en seguimiento a mi correo anterior, sobre el merchandising y regalos para su equipo en {empresa}.\n\nEntiendo perfectamente que en el día a día las agendas están a mil por hora, por lo que solo quería reiterarte nuestra total disposición. Si en algún momento planifican algún evento corporativo, bienvenida de colaboradores o fechas especiales, acá estamos para simplificarte el proceso y buscar ideas atractivas sin compromiso.\n\nSi estás con muchos pendientes ahora, no se preocupen en responder. Pero si te gustaría tener nuestro catálogo guardado para más adelante, me avisas con un breve \"sí\" y te lo envío encantado.\n\nSaludos,\n\n{vendedor}\n{telefono}\nwww.ecomoving.cl"
      },
      {
        id: "builtin-prospeccion-3",
        name: "3. Email de Despedida (Breakup suave)",
        subject: "Cerrando contacto / Merchandising en {empresa}",
        body: "Hola {nombre_corto},\n\nEspero que te encuentres muy bien.\n\nTe escribo por última vez para no saturar tu bandeja de entrada. Como no hemos coincidido en esta oportunidad, asumo que el tema de regalos o merchandising no está dentro de tus prioridades o necesidades actuales en {empresa}, lo cual es totalmente comprensible.\n\nSi en el futuro cercano deciden buscar alternativas o necesitas solucionar una producción a contrarreloj con excelente calidad, nos encantará poder ayudarte.\n\nTe deseo el mayor de los éxitos en tus proyectos y metas del año. Si en algún momento nos necesitas, ya tienes mi contacto por esta vía.\n\nSaludos,\n\n{vendedor}\n{telefono}\nwww.ecomoving.cl"
      }
    ];

    const loadTemplates = async () => {
      let prospectionTemplates = [...defaultTemplates];
      try {
        // Cargar etapas de prospección desde Supabase en tiempo real
        const { data: dbEtapas, error: dbErr } = await supabase
          .from("configuracion_prospeccion")
          .select("*")
          .eq("activo", true)
          .order("orden", { ascending: true });

        if (!dbErr && dbEtapas && dbEtapas.length > 0) {
          prospectionTemplates = dbEtapas.map(etapa => ({
            id: `builtin-prospeccion-${etapa.orden}`,
            name: `${etapa.orden}. ${etapa.nombre}`,
            subject: etapa.asunto_template || "",
            body: `${etapa.mensaje_intro || ""}\n\n${etapa.mensaje_cierre || ""}`.trim()
          }));
        } else if (dbErr) {
          console.warn("Could not load dynamic templates from Supabase, using defaults:", dbErr.message);
        }
      } catch (err) {
        console.error("Error fetching templates from database:", err);
      }

      try {
        const custom = localStorage.getItem("ecomoving_custom_templates");
        let loadedTemplates: EmailTemplate[] = [];
        if (custom) {
          loadedTemplates = JSON.parse(custom);
        }

        // Separar las creadas por el usuario de las predeterminadas antiguas
        const customUserTemplates = loadedTemplates.filter(t => !t.id.startsWith("builtin-"));
        
        // Unir las plantillas de prospección actualizadas de la base de datos con las personalizadas del usuario
        const combinadas = [...prospectionTemplates, ...customUserTemplates];
        localStorage.setItem("ecomoving_custom_templates", JSON.stringify(combinadas));
        setTemplates(combinadas);
      } catch (e) {
        console.error("Error combining templates with localStorage:", e);
        setTemplates(prospectionTemplates);
      }
    };

    loadTemplates();
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

    // 2. FALLBACK: Modelo antiguo (ultimo_envio único) - Solo si no hay historial real en absoluto
    if (!contacto.historial || contacto.historial.length === 0) {
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
    }
    
    return <div className="h-1.5 w-1.5 bg-gray-800 rounded-full" />; // Dot default
  };

  const generateDraft = (c: any) => {
    setSelectedContactoDraft(c);
    
    // Check if contact has opens or clicks
    const tieneAperturas = c.historial?.some((h: any) => 
      ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(h.estado?.toLowerCase())
    ) || ['opened', 'unique_opened', 'clicks', 'loadedbyproxy'].includes(c.ultimo_estado_brevo?.toLowerCase());

    const fallbackTmpls = [
      {
        id: "builtin-aperturas",
        name: "Cortesía (Con aperturas)",
        subject: "Sobre tu consulta de hidratación eficiente - Ecomoving",
        body: "Hola {nombre_corto},\n\nTe escribo porque vi que estuvieron revisando nuestra propuesta de sostenibilidad y eficiencia operativa para {empresa} recientemente.\n\nNo quería que se quedaran con dudas tácticas sobre cómo el cambio a purificadores puede reducir sus costos logísticos de inmediato.\n\n¿Tendrían 10 minutos la próxima semana para una llamada rápida?\n\nSaludos,\n\n{vendedor}\nEcomoving SpA"
      },
      {
        id: "builtin-sin-aperturas",
        name: "Cortesía (Sin aperturas)",
        subject: "Soluciones de hidratación eficiente para {empresa} - Ecomoving",
        body: "Hola {nombre_corto},\n\nEspero que te encuentres muy bien.\n\nTe escribo de Ecomoving para dar seguimiento a nuestra propuesta de sostenibilidad y eficiencia operativa para {empresa}.\n\nMe gustaría saber si han tenido oportunidad de revisarla y si podríamos coordinar una breve llamada de 10 minutos la próxima semana para conversar al respecto.\n\nSaludos,\n\n{vendedor}\nEcomoving SpA"
      }
    ];

    const targetId = tieneAperturas ? "builtin-aperturas" : "builtin-sin-aperturas";
    
    let tmpl = templates.find(t => t.id === targetId);
    if (!tmpl && templates.length > 0) {
      tmpl = templates[0];
    }
    if (!tmpl) {
      tmpl = tieneAperturas ? fallbackTmpls[0] : fallbackTmpls[1];
    }

    setSelectedTemplateId(tmpl.id);
    const { resolvedSubject, resolvedBody } = resolveTemplateVariables(tmpl.subject, tmpl.body, c, vendedor);

    setDraftData({ 
      email: c.correo, 
      subject: resolvedSubject, 
      body: resolvedBody, 
      contactoId: c.id 
    });
    
    setEditorMode("redactar");
    setIsModalOpen(true);
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

    const matchesEjecutivo = filtroEjecutivo === "todos" ? true : (
      filtroEjecutivo === "sin_asignar" 
        ? (!c.correo_cortesia_vendedor || c.correo_cortesia_vendedor.trim() === "")
        : (filtroEjecutivo === "mis_asignados"
            ? c.correo_cortesia_vendedor === vendedor
            : c.correo_cortesia_vendedor === filtroEjecutivo)
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

        {/* Centro: Simbología */}
        <div className="flex flex-wrap gap-4 items-center justify-center">
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

        {/* Derecha: Botón Sincronizar */}
        <div>
          <button 
            onClick={syncWithBrevo}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 h-[36px]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            SINCRONIZAR BREVO
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

        <button 
          onClick={() => setSoloCriticos(!soloCriticos)}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all h-[36px] ${
            soloCriticos ? "bg-red-500 text-white shadow-lg shadow-red-500/50" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {soloCriticos ? "FILTRANDO CRÍTICOS" : "TODOS"}
        </button>

        <button 
          onClick={() => setSoloFoco(!soloFoco)}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1 h-[36px] ${
            soloFoco ? "bg-yellow-500 text-gray-950 shadow-lg shadow-yellow-500/50" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          ⭐ {soloFoco ? "SOLO CUENTAS FOCO" : "TODAS LAS CUENTAS"}
        </button>

        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-xl h-[36px]">
          <span className="text-[9px] font-black uppercase text-gray-500">Mi Perfil:</span>
          <Select value={vendedor} onValueChange={(val) => handleVendedorChange(val)}>
            <SelectTrigger className="w-[140px] bg-transparent border-0 text-[10px] font-black uppercase text-indigo-400 p-0 h-auto focus:ring-0 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              {vendedores && vendedores.length > 0 ? (
                vendedores.map(v => (
                  <SelectItem key={v.id} value={v.nombre}>{v.nombre.toUpperCase()}</SelectItem>
                ))
              ) : (
                ['Vendedor 1', 'Vendedor 2'].map(v => (
                  <SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <Select onValueChange={(val) => setFiltroEjecutivo(val)} defaultValue="todos">
          <SelectTrigger className="w-[185px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
            <SelectValue placeholder="EJECUTIVO" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white">
            <SelectItem value="todos">TODOS LOS EJECUTIVOS</SelectItem>
            <SelectItem value="sin_asignar">SIN ASIGNAR</SelectItem>
            <SelectItem value="Mario Osorio C.">MARIO OSORIO C.</SelectItem>
            <SelectItem value="Jimena Lara F.">JIMENA LARA F.</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => setFiltroSector(val)} defaultValue="todos">
          <SelectTrigger className="w-[145px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
            <SelectValue placeholder="SECTOR" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white">
            <SelectItem value="todos">SECTOR: TODOS</SelectItem>
            <SelectItem value="privado">PRIVADOS</SelectItem>
            <SelectItem value="publico">PÚBLICOS</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => setFiltroSegmento(val)} defaultValue="todos">
          <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-[10px] font-black uppercase text-white h-[36px] rounded-xl">
            <SelectValue placeholder="SEGMENTO" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800 text-white max-h-60 overflow-y-auto">
            <SelectItem value="todos">SEGMENTO: TODOS</SelectItem>
            {availableSegments.map(seg => (
              <SelectItem key={seg} value={seg}>{seg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[80px] text-gray-500">CORTESÍA</th>
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
                        c.etapa === 'prospeccion' ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20' : 'bg-blue-500/10 text-blue-400 border border-blue-400/20'
                      }`}>
                        {c.etapa?.toUpperCase() || 'MARKETING'}
                      </div>

                      {/* Información de Cortesía y Abordaje */}
                      <div className="mt-2 pt-2 border-t border-gray-900 flex flex-col gap-1.5 text-[9px]">
                        {/* Fila 1: Badges de Cortesía (C1, C2, C3) y vendedor */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-500 font-bold uppercase tracking-wider text-[8px]">Cortesías:</span>
                          <div className="flex gap-1">
                            {(() => {
                              const hasC1 = c.historial?.some((h: any) => 
                                h.mensaje_id?.includes("prospeccion-1") || 
                                h.mensaje_id?.includes("consulta_directa")
                              );
                              const hasC2 = c.historial?.some((h: any) => 
                                h.mensaje_id?.includes("prospeccion-2") || 
                                h.mensaje_id?.includes("alternativa_valor")
                              );
                              const hasC3 = c.historial?.some((h: any) => 
                                h.mensaje_id?.includes("prospeccion-3") || 
                                h.mensaje_id?.includes("email_despedida")
                              );

                              return (
                                <>
                                  <span 
                                    className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                      hasC1 
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                        : "bg-gray-900 text-gray-600 border border-gray-800"
                                    }`}
                                    title="Consulta Directa"
                                  >
                                    C1
                                  </span>
                                  <span 
                                    className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                      hasC2 
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                        : "bg-gray-900 text-gray-600 border border-gray-800"
                                    }`}
                                    title="Alternativa de Valor"
                                  >
                                    C2
                                  </span>
                                  <span 
                                    className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                      hasC3 
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                        : "bg-gray-900 text-gray-600 border border-gray-800"
                                    }`}
                                    title="Email Despedida"
                                  >
                                    C3
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          
                          {c.correo_cortesia_vendedor && (
                            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded border border-indigo-500/20 font-bold truncate max-w-[80px]" title={`Abordado por ${c.correo_cortesia_vendedor}`}>
                              👤 {c.correo_cortesia_vendedor.split(' ')[0]}
                            </span>
                          )}
                        </div>

                        {/* Fila 2: Checkbox "Respondió" */}
                        <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => toggleCortesiaRespondido(c)}>
                          <input 
                            type="checkbox" 
                            checked={!!c.correo_cortesia_respondido} 
                            onChange={() => {}} 
                            className="h-3 w-3 rounded border-gray-800 text-indigo-600 focus:ring-indigo-500/50 bg-gray-900 cursor-pointer accent-indigo-600"
                          />
                          <span className={`${c.correo_cortesia_respondido ? "text-emerald-400 font-bold" : "text-gray-500"} transition-colors text-[9px]`}>
                            {c.correo_cortesia_respondido ? "✓ Respondió" : "No ha respondido"}
                          </span>
                        </div>
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

                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex justify-center items-center">
                      {c.correo_cortesia_enviado ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" title="Correo de cortesía enviado" />
                      ) : (
                        <Circle className="h-4.5 w-4.5 text-gray-700" title="Pendiente de envío" />
                      )}
                    </div>
                  </td>

                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex justify-center items-center gap-2">
                      {(() => {
                        const isLocked = c.correo_cortesia_vendedor && c.correo_cortesia_vendedor !== vendedor;
                        if (isLocked) {
                          return (
                            <button 
                              disabled
                              className="p-1 bg-gray-900 border border-gray-805 text-red-500 rounded-md cursor-not-allowed opacity-50 flex items-center justify-center"
                              title={`Bloqueado: Asignado en exclusiva a ${c.correo_cortesia_vendedor}`}
                            >
                              <Lock className="h-3.5 w-3.5 text-red-500" />
                            </button>
                          );
                        }
                        return (
                          <button 
                            onClick={() => generateDraft(c)} 
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md hover:scale-110 transition-all flex items-center justify-center shadow-md shadow-indigo-600/25 cursor-pointer"
                            title="Enviar correo"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                        );
                      })()}
                      <button 
                        onClick={() => openEditModal(c)} 
                        className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md hover:scale-110 transition-all flex items-center justify-center border border-gray-750"
                        title="Gestionar contacto"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REDACCION @VENTAS */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase tracking-widest text-indigo-400">
              <Mail className="h-5 w-5" /> Redacción e Inteligencia de Plantillas @Ventas
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Personaliza, selecciona y mantén trazabilidad de los correos manuales enviados a este contacto.
            </DialogDescription>
          </DialogHeader>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-6 my-4 border-t border-gray-900 pt-4">
            
            {/* Columna Izquierda: Plantillas */}
            <div className="col-span-12 md:col-span-4 border-r border-gray-900 pr-4 flex flex-col justify-between h-[450px]">
              <div className="flex flex-col space-y-3 overflow-hidden">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  Plantillas Disponibles
                </span>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
                  {templates.map(t => {
                    const wasSent = selectedContactoDraft?.historial?.some((h: any) => 
                      h.mensaje_id?.startsWith(`manual_template:${t.id}:`)
                    );
                    
                    return (
                      <div 
                        key={t.id}
                        onClick={() => handleSelectTemplate(t.id)}
                        className={cn(
                          "group p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2",
                          selectedTemplateId === t.id
                            ? "bg-indigo-600/10 border-indigo-500 text-white shadow-sm shadow-indigo-500/10"
                            : "bg-gray-900/40 border-gray-800 text-gray-400 hover:bg-gray-900/80 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTemplateSentStatus(t.id, selectedContactoDraft);
                            }}
                            className="shrink-0 p-0.5 rounded hover:bg-gray-800/80 transition-colors cursor-pointer"
                            title={wasSent ? "Marcar como Pendiente" : "Marcar como Enviado"}
                          >
                            {wasSent ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 animate-in fade-in zoom-in" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-700 shrink-0 hover:text-emerald-500 transition-colors" />
                            )}
                          </button>
                          <span className="text-xs font-bold truncate flex-1">{t.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTemplateId(t.id);
                              setTemplateFormName(t.name);
                              setTemplateFormSubject(t.subject);
                              setTemplateFormBody(t.body);
                              setEditorMode("editar");
                            }}
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 opacity-60 hover:opacity-100 transition-opacity"
                            title="Editar plantilla"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                            className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-gray-800 opacity-60 hover:opacity-100 transition-opacity"
                            title="Eliminar plantilla"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <Button
                variant="outline"
                className="mt-2 w-full border-dashed border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-xs font-black h-9 flex items-center justify-center gap-2 cursor-pointer"
                onClick={() => {
                  setTemplateFormName("");
                  setTemplateFormSubject("");
                  setTemplateFormBody("");
                  setEditorMode("crear");
                }}
              >
                <Plus className="h-3.5 w-3.5" /> CREAR PLANTILLA
              </Button>
            </div>
            
            {/* Columna Derecha: Redactor o Editor de Plantilla */}
            <div className="col-span-12 md:col-span-8 pl-4 flex flex-col justify-between h-[450px]">
              
              {editorMode === "redactar" ? (
                <>
                  <div className="space-y-4 flex-1 overflow-y-auto pr-1 max-h-[390px]">
                    <div className="flex items-center gap-4 bg-gray-900/30 p-2.5 rounded-xl border border-gray-800">
                      <span className="text-[10px] font-black uppercase text-gray-400 w-20">Remitente:</span>
                      <div className="flex gap-2 flex-wrap">
                        {vendedores && vendedores.length > 0 ? (
                          vendedores.map(v => (
                            <button 
                              key={v.id}
                              type="button"
                              onClick={() => handleVendedorChange(v.nombre)}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                                vendedor === v.nombre ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800'
                              }`}
                            >
                              {v.nombre}
                            </button>
                          ))
                        ) : (
                          ['Vendedor 1', 'Vendedor 2'].map(v => (
                            <button 
                              key={v}
                              type="button"
                              onClick={() => handleVendedorChange(v)}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                                vendedor === v ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800'
                              }`}
                            >
                              {v}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">Destinatario</label>
                        <input 
                          type="text" 
                          value={draftData?.email || ""} 
                          onChange={(e) => setDraftData(draftData ? { ...draftData, email: e.target.value } : null)}
                          className="w-full bg-gray-900/60 border border-gray-800 text-white text-xs p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">Asunto</label>
                        <input 
                          type="text" 
                          value={draftData?.subject || ""} 
                          onChange={(e) => setDraftData(draftData ? { ...draftData, subject: e.target.value } : null)}
                          className="w-full bg-gray-900/60 border border-gray-800 text-white text-xs p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">Cuerpo del Correo (Editable)</label>
                        <Textarea 
                          value={draftData?.body || ""} 
                          onChange={(e) => setDraftData(draftData ? { ...draftData, body: e.target.value } : null)}
                          rows={7}
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="flex justify-end gap-2 border-t border-gray-900 pt-4 mt-auto">
                    <Button 
                      variant="outline" 
                      className="border-gray-800 text-gray-400 hover:bg-gray-900 text-xs font-black h-9"
                      onClick={() => setIsModalOpen(false)}
                    >
                      DESCARTAR
                    </Button>
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs h-9"
                      onClick={async () => {
                        if (draftData) {
                          try {
                            const telefonos: Record<string, string> = {
                              "Mario Osorio C.": "+56 9 7958 7293",
                              "Jimena Lara F.": "+56 9 6528 0052"
                            };
                            const tel = telefonos[vendedor] || "+56 9 7958 7293";

                            // Limpiar firma de texto plano del cuerpo para que Outlook coloque su firma nativa abajo
                            let cleanBody = draftData.body;
                            const signatureToSearch = `Saludos,\n\n${vendedor}\n${tel}\nwww.ecomoving.cl`;
                            if (cleanBody.includes(signatureToSearch)) {
                              cleanBody = cleanBody.replace(signatureToSearch, "").trim();
                            }
                            const signatureToSearchSimple = `Saludos,\n\n${vendedor}`;
                            if (cleanBody.includes(signatureToSearchSimple)) {
                              cleanBody = cleanBody.replace(signatureToSearchSimple, "").trim();
                            }

                            // 1. Copiar cuerpo limpio al portapapeles
                            await navigator.clipboard.writeText(cleanBody);

                            // 2. Abrir Zoho Mail en su URL de composición limpia directamente
                            window.open("https://mail.zoho.com/zm/#compose", "_blank");

                            toast.success("Cuerpo copiado. Redactando en Zoho Mail (Ctrl + V)...");

                            if (draftData.contactoId) {
                              const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });

                                // 1. Update contact
                              const { error: updateErr } = await supabase
                                .from("contactos")
                                .update({ 
                                  correo_cortesia_enviado: true,
                                  correo_cortesia_vendedor: vendedor,
                                  ultimo_envio: new Date().toISOString()
                                })
                                .eq("id", draftData.contactoId);

                              if (updateErr) throw updateErr;

                              // 2. Insert trace record
                              const { error: traceErr } = await supabase
                                .from("trazabilidad_correos")
                                .insert({
                                  contacto_id: draftData.contactoId,
                                  email: draftData.email,
                                  fecha: todayStr,
                                  estado: "delivered",
                                  mensaje_id: `manual:${Date.now()}`
                                });

                              if (traceErr) console.warn("Error inserting history trace:", traceErr);

                              // 3. Update local state
                              setContactos(prev => prev.map(c => {
                                if (c.id === draftData.contactoId) {
                                  const newTraceItem = {
                                    id: `temp-${Date.now()}`,
                                    contacto_id: draftData.contactoId,
                                    email: draftData.email,
                                    fecha: todayStr,
                                    estado: "delivered",
                                    mensaje_id: `manual:${Date.now()}`,
                                    created_at: new Date().toISOString()
                                  };
                                  return { 
                                    ...c, 
                                    correo_cortesia_enviado: true, 
                                    correo_cortesia_vendedor: vendedor,
                                    ultimo_envio: new Date().toISOString(),
                                    historial: [...(c.historial || []), newTraceItem]
                                  };
                                }
                                return c;
                              }));
                            }
                          } catch (err: any) {
                            console.error("Error al copiar o actualizar estado:", err);
                            toast.error("Error al procesar la cortesía");
                          }
                        }
                        setIsModalOpen(false);
                      }}
                    >
                      ENVIAR AL GESTOR (Disparar)
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-3 flex-1 overflow-y-auto pr-1 max-h-[390px]">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-900">
                      <button 
                        onClick={() => setEditorMode("redactar")}
                        className="p-1 hover:bg-gray-900 rounded text-gray-400 hover:text-white"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-bold tracking-wider uppercase text-indigo-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        {editorMode === "crear" ? "Crear Nueva Plantilla" : "Editar Plantilla"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">Nombre de la Plantilla</label>
                        <input 
                          type="text" 
                          placeholder="Ej: Seguimiento de propuesta"
                          value={templateFormName} 
                          onChange={(e) => setTemplateFormName(e.target.value)}
                          className="w-full bg-gray-900/60 border border-gray-800 text-white text-xs p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">Asunto</label>
                        <input 
                          type="text" 
                          placeholder="Ej: Dudas sobre propuesta para {empresa}"
                          value={templateFormSubject} 
                          onChange={(e) => setTemplateFormSubject(e.target.value)}
                          className="w-full bg-gray-900/60 border border-gray-800 text-white text-xs p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">Cuerpo de la Plantilla</label>
                        <Textarea 
                          placeholder="Hola {nombre_corto}, te escribo..."
                          value={templateFormBody} 
                          onChange={(e) => setTemplateFormBody(e.target.value)}
                          rows={6}
                          className="w-full bg-gray-900/60 border border-gray-800 text-white text-xs p-2.5 rounded-xl resize-none focus:ring-1 focus:ring-indigo-500 focus:outline-none max-h-[140px] overflow-y-auto" 
                        />
                      </div>
                      
                      <div className="p-2.5 bg-gray-950 rounded-xl border border-gray-900 text-[10px] text-gray-500 space-y-1 font-medium">
                        <div className="font-bold text-gray-400 uppercase text-[8px] tracking-wider">Placeholders Admitidos:</div>
                        <div><code className="text-indigo-400 font-bold">{`{contacto}`}</code> o <code className="text-indigo-400 font-bold">{`{nombre_corto}`}</code>: Primer nombre.</div>
                        <div><code className="text-indigo-400 font-bold">{`{nombre}`}</code>: Nombre completo.</div>
                        <div><code className="text-indigo-400 font-bold">{`{empresa}`}</code>: Nombre de la empresa.</div>
                        <div><code className="text-indigo-400 font-bold">{`{vendedor}`}</code>: Vendedor asignado.</div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="flex justify-end gap-2 border-t border-gray-900 pt-4 mt-auto">
                    <Button 
                      variant="outline" 
                      className="border-gray-800 text-gray-400 hover:bg-gray-900 text-xs font-black h-9"
                      onClick={() => {
                        setEditorMode("redactar");
                        setEditingTemplateId(null);
                      }}
                    >
                      CANCELAR
                    </Button>
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs h-9 cursor-pointer"
                      onClick={handleSaveTemplate}
                    >
                      GUARDAR PLANTILLA
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

            {/* Nuevos Campos de Abordaje y Cortesía */}
            <div className="grid grid-cols-2 gap-4 border-t border-gray-900 pt-4 mt-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-gray-500 uppercase">Vendedor Abordando</Label>
                <Select 
                  value={selectedContact?.correo_cortesia_vendedor || "ninguno"} 
                  onValueChange={(val) => setSelectedContact({ 
                    ...selectedContact, 
                    correo_cortesia_vendedor: val === "ninguno" ? null : val 
                  })}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white focus:ring-1 focus:ring-indigo-500">
                    <SelectValue placeholder="Seleccionar vendedor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-850 text-white">
                    <SelectItem value="ninguno">Ninguno</SelectItem>
                    <SelectItem value="Mario Osorio C.">Mario Osorio C.</SelectItem>
                    <SelectItem value="Jimena Lara F.">Jimena Lara F.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-3 select-none">
                  <input 
                    type="checkbox" 
                    id="modal-enviado"
                    checked={!!selectedContact?.correo_cortesia_enviado} 
                    onChange={(e) => setSelectedContact({ 
                      ...selectedContact, 
                      correo_cortesia_enviado: e.target.checked 
                    })}
                    className="h-4 w-4 rounded border-gray-800 text-indigo-600 focus:ring-indigo-500 bg-gray-900 cursor-pointer accent-indigo-600"
                  />
                  <Label htmlFor="modal-enviado" className="text-xs text-gray-300 cursor-pointer">
                    Cortesía Enviada (Marcar Manual)
                  </Label>
                </div>
                <div className="flex items-center gap-3 select-none">
                  <input 
                    type="checkbox" 
                    id="modal-respondido"
                    checked={!!selectedContact?.correo_cortesia_respondido} 
                    onChange={(e) => setSelectedContact({ 
                      ...selectedContact, 
                      correo_cortesia_respondido: e.target.checked 
                    })}
                    className="h-4 w-4 rounded border-gray-800 text-indigo-600 focus:ring-indigo-500 bg-gray-900 cursor-pointer accent-indigo-600"
                  />
                  <Label htmlFor="modal-respondido" className="text-xs text-gray-300 cursor-pointer">
                    ¿El contacto respondió?
                  </Label>
                </div>
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
