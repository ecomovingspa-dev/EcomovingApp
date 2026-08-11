import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { Cuenta } from "../../types";
import { Trash2, CheckCircle2, AlertCircle, Loader2, Building2, Search, RotateCcw, X, Plus, Sparkles, Edit2, Save, Check, Users, Compass, UserPlus, Mail } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SEGMENTOS_MAESTROS } from "../../utils/constants";
import { useVendedores } from "../../hooks/useVendedores";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function CuentasPage() {
  const navigate = useNavigate();
  const { vendedores } = useVendedores();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentasFiltradas, setCuentasFiltradas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [enriqueciendoId, setEnriqueciendoId] = useState<string | null>(null);
  const [buscandoSimilaresId, setBuscandoSimilaresId] = useState<string | null>(null);
  const [cuentaIdActiva, setCuentaIdActiva] = useState<string | null>(null);
  const [modalBasicAbierto, setModalBasicAbierto] = useState(false);
  const [datosBasicosPropuestos, setDatosBasicosPropuestos] = useState<{ web: string; telefono: string; ciudad: string; segmento: string }>({ web: "", telefono: "", ciudad: "", segmento: "" });
  const [modalSimilaresAbierto, setModalSimilaresAbierto] = useState(false);
  const [listaSimilaresEncontradas, setListaSimilaresEncontradas] = useState<{ cliente: string; web?: string; ciudad?: string }[]>([]);
  const [empresaOriginalNombre, setEmpresaOriginalNombre] = useState("");

  // Estados para edición inline de segmentos
  const [openSegmentId, setOpenSegmentId] = useState<string | null>(null);
  const [searchSegment, setSearchSegment] = useState("");

  // Estados para prospección
  const [filtroFoco, setFiltroFoco] = useState<string>(() => sessionStorage.getItem("cuentas_filtroFoco") || "todos");
  const [filtroEtapa, setFiltroEtapa] = useState<string>(() => sessionStorage.getItem("cuentas_filtroEtapa") || "todas");
  const [stats, setStats] = useState({
    totalFoco: 0,
    sinVerificar: 0,
    verificado: 0,
  });

  // Estados para filtros y búsqueda
  const [busqueda, setBusqueda] = useState(() => sessionStorage.getItem("cuentas_busqueda") || "");
  const [busquedaAplicada, setBusquedaAplicada] = useState(() => sessionStorage.getItem("cuentas_busqueda") || "");
  const [filtroSector, setFiltroSector] = useState(() => sessionStorage.getItem("cuentas_filtroSector") || "");
  const [filtroSegmento, setFiltroSegmento] = useState(() => sessionStorage.getItem("cuentas_filtroSegmento") || "");
  const [filtroEstado, setFiltroEstado] = useState(() => sessionStorage.getItem("cuentas_filtroEstado") || "");
  const [filtroVendedor, setFiltroVendedor] = useState(() => sessionStorage.getItem("cuentas_filtroVendedor") || "");
  const [filtroFecha, setFiltroFecha] = useState(() => sessionStorage.getItem("cuentas_filtroFecha") || "");

  // --- Estados para Redacción Manual Zoho ---
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [selectedContactoDraft, setSelectedContactoDraft] = useState<any>(null);
  const [selectedCuentaDraft, setSelectedCuentaDraft] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSendDates, setTemplateSendDates] = useState<Record<string, string>>({});
  const [draftData, setDraftData] = useState<any>(null);
  const [vendedor, setVendedor] = useState("");
  const [isEditingTemplateMode, setIsEditingTemplateMode] = useState(false);
  const [tempEditSubject, setTempEditSubject] = useState("");
  const [tempEditBody, setTempEditBody] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [guardandoFechas, setGuardandoFechas] = useState(false);
  const [imageUrl, setImageUrl] = useState(""); // Stores base64 string
  const [guardandoImagen, setGuardandoImagen] = useState(false);

  useEffect(() => {
    if (vendedores && vendedores.length > 0 && (vendedor === "Vendedor 1" || vendedor === "")) {
      setVendedor(vendedores[0].nombre);
    }
  }, [vendedores]);

  // Sincronizar filtros a sessionStorage para persistencia en navegación
  useEffect(() => { sessionStorage.setItem("cuentas_filtroFoco", filtroFoco); }, [filtroFoco]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroEtapa", filtroEtapa); }, [filtroEtapa]);
  useEffect(() => { sessionStorage.setItem("cuentas_busqueda", busqueda); }, [busqueda]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroSector", filtroSector); }, [filtroSector]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroSegmento", filtroSegmento); }, [filtroSegmento]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroEstado", filtroEstado); }, [filtroEstado]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroVendedor", filtroVendedor); }, [filtroVendedor]);
  useEffect(() => { sessionStorage.setItem("cuentas_filtroFecha", filtroFecha); }, [filtroFecha]);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;

  // Estados para opciones de filtros (se cargan una vez al inicio)
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  // Determinar si hay algún filtro activo
  // No longer restricted, we use server-side pagination for performance
  const hayFiltroActivo = true;

  useEffect(() => {
    cargarOpcionesFiltros();
    cargarEstadisticasProspeccion();
    loadTemplates();
  }, []);

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

      // Recalcular el texto de inmediato para el borrador activo en la pantalla
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

    // Check size to avoid massive database payloads (recommend max 800kb)
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
          
          // Save base64 string directly into the 'imagen' column of 'contactos'
          const { error } = await supabase
            .from("contactos")
            .update({ imagen: base64String })
            .eq("id", selectedContactoDraft.id);

          if (error) throw error;

          toast.success("¡Render personalizado guardado en el contacto!");
          setImageUrl(base64String);
          setSelectedContactoDraft((prev: any) => prev ? { ...prev, imagen: base64String } : null);
          await cargarCuentas();
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
    
    // Clear and load send dates for this contact from trazabilidad_correos
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
    
    // Select first template by default if available
    const activeVendedor = vendedor || (vendedores && vendedores.length > 0 ? vendedores[0].nombre : "");
    if (!vendedor && activeVendedor) {
      setVendedor(activeVendedor);
    }
    
    // Since state is asynchronous, we find first template and resolve variables directly
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

      const updatePayload: Record<string, any> = {
        estado: selectedContactoDraft.estado
      };

      if (latestDateObj) {
        updatePayload.ultimo_envio = latestDateObj.toISOString();
        updatePayload.ultimo_evento_trazabilidad = latestDateObj.toISOString();
      }
      
      await supabase.from('contactos').update(updatePayload).eq('id', selectedContactoDraft.id);

      await cargarCuentas();
      toast.success("¡Datos del contacto actualizados con éxito!");
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

  const cargarEstadisticasProspeccion = async () => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select("etapa_prospeccion")
        .eq("cuenta_foco", true);

      if (error) throw error;

      const counts = {
        totalFoco: 0,
        sinVerificar: 0,
        verificado: 0,
      };

      if (data) {
        counts.totalFoco = data.length;
        data.forEach((c: any) => {
          if (c.etapa_prospeccion === "Verificado") {
            counts.verificado++;
          } else {
            counts.sinVerificar++;
          }
        });
      }
      setStats(counts);
    } catch (err) {
      console.error("Error al cargar estadísticas de prospección:", err);
    }
  };

  const cargarOpcionesFiltros = async () => {
    try {
      // 1. Cargar sectores de las cuentas y normalizar mayúsculas/espacios
      const { data: accountsData } = await supabase.from("cuentas").select("sector");
      if (accountsData) {
        const sectorSet = new Set<string>();
        accountsData.forEach((c: any) => {
          if (c.sector && typeof c.sector === 'string') {
            const trimmed = c.sector.trim();
            if (trimmed) {
              // Standardize casing: First letter uppercase, rest lowercase
              const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
              sectorSet.add(normalized);
            }
          }
        });
        setAvailableSectors(Array.from(sectorSet).sort());
      }

      // 2. Cargar segmentos de la tabla de catálogo
      const { data: catalogData } = await supabase.from("catalogo_segmentos").select("nombre");
      if (catalogData && catalogData.length > 0) {
        const dbSegments = catalogData.map((s: any) => s.nombre).filter(Boolean);
        setAvailableSegments(Array.from(new Set([...SEGMENTOS_MAESTROS, ...dbSegments])).sort());
      } else {
        setAvailableSegments([...SEGMENTOS_MAESTROS].sort());
      }
    } catch (e) {
      console.error("Error cargando opciones de filtros:", e);
    }
  };

  const agregarNuevoSegmentoAlCatálogo = async (nuevoNombre: string, cuentaId: string) => {
    try {
      const { data, error } = await supabase
        .from("catalogo_segmentos")
        .insert([{ nombre: nuevoNombre }])
        .select("nombre")
        .single();

      if (error) throw error;

      if (data) {
        setAvailableSegments(prev => Array.from(new Set([...prev, data.nombre])).sort());
        await actualizarCuentaInline(cuentaId, "segmento", data.nombre);
        setOpenSegmentId(null);
        setSearchSegment("");
      }
    } catch (error: any) {
      console.error("Error al crear segmento inline:", error);
      alert("Error al crear segmento: " + error.message);
    }
  };

  const eliminarSegmentoDelCatálogo = async (nombre: string) => {
    try {
      const { error } = await supabase
        .from("catalogo_segmentos")
        .delete()
        .eq("nombre", nombre);
      if (error) throw error;
      setAvailableSegments(prev => prev.filter(s => s !== nombre));
    } catch (error: any) {
      console.error("Error al eliminar segmento del catálogo:", error);
      alert("Error al eliminar segmento: " + error.message);
    }
  };

  useEffect(() => {
    if (hayFiltroActivo) {
      cargarCuentas();
    } else {
      setCuentas([]);
      setCuentasFiltradas([]);
      setTotalRecords(0);
      setCargando(false);
    }
  }, [paginaActual, busqueda, filtroSector, filtroSegmento, filtroEstado, filtroVendedor, filtroFoco, filtroEtapa, filtroFecha, hayFiltroActivo]);


  const cargarCuentas = async () => {
    try {
      setCargando(true);
      setError("");

      let query = supabase
        .from("cuentas")
        .select("*, vendedores(nombre), contactos:contactos!contactos_cuenta_id_fkey(id, nombre, correo, celular, telefono, imagen, ultimo_envio, ultimo_evento_trazabilidad, estado, etapa)", { count: "exact" });

      if (busqueda) {
        query = query.or(`cliente.ilike.%${busqueda}%,rut.ilike.%${busqueda}%,ciudad.ilike.%${busqueda}%`);
      }
      if (filtroSector) {
        query = query.ilike("sector", filtroSector);
      }
      if (filtroSegmento) {
        query = query.eq("segmento", filtroSegmento);
      }
      if (filtroEstado) {
        query = query.eq("estado", filtroEstado);
      }
      if (filtroVendedor) {
        if (filtroVendedor === "null") {
          query = query.is("vendedor_id", null);
        } else {
          query = query.eq("vendedor_id", filtroVendedor);
        }
      }
      if (filtroFoco === "foco") {
        query = query.eq("cuenta_foco", true);
      }
      if (filtroEtapa !== "todas") {
        if (filtroEtapa === "Sin Verificar") {
          query = query.or("etapa_prospeccion.eq.Sin Verificar,etapa_prospeccion.is.null");
        } else {
          query = query.eq("etapa_prospeccion", filtroEtapa);
        }
      }
      if (filtroFecha) {
        const startDate = new Date(`${filtroFecha}T00:00:00`);
        const endDate = new Date(`${filtroFecha}T23:59:59.999`);
        query = query
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina - 1);

      if (error) throw error;

      setCuentas(data || []);
      setCuentasFiltradas(data || []);
      setTotalRecords(count || 0);
    } catch (err: any) {
      console.error("Error al cargar cuentas:", err);
      setError("No se pudieron cargar las cuentas.");
    } finally {
      setCargando(false);
    }
  };

  const totalPaginas = Math.ceil(totalRecords / filasPorPagina);
  const cuentasPaginadas = cuentas; // Already paginated from server

  const handleReset = () => {
    setBusqueda("");
    setFiltroSector("");
    setFiltroSegmento("");
    setFiltroEstado("");
    setFiltroVendedor("");
    setFiltroFoco("todos");
    setFiltroEtapa("todas");
    setFiltroFecha("");
    setPaginaActual(1);
  };


  const actualizarCuentaInline = async (id: string, campo: keyof Cuenta, valor: any) => {
    const cuentaOriginal = cuentas.find(c => c.id === id);
    if (cuentaOriginal && cuentaOriginal[campo] === valor) return;

    setGuardandoId(id);
    try {
      const { error } = await supabase
        .from("cuentas")
        .update({ [campo]: valor })
        .eq("id", id);

      if (error) throw error;

      // Actualizar estado local
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
      
      // Recargar estadísticas si cambió la etapa o el foco
      if (campo === "cuenta_foco" || campo === "etapa_prospeccion") {
        cargarEstadisticasProspeccion();
      }
    } catch (err) {
      console.error("Error al actualizar:", err);
      setError("Error al guardar los cambios");
      setTimeout(() => setError(""), 3000);
    } finally {
      setGuardandoId(null);
    }
  };

  const eliminarCuenta = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta cuenta?")) return;
    try {
      const { error } = await supabase.from("cuentas").delete().eq("id", id);
      if (error) throw error;
      setCuentas(cuentas.filter((c) => c.id !== id));
    } catch (error: any) {
      console.error("Error:", error);
      alert("Error al eliminar la cuenta");
    }
  };

  const enriquecerConIA = async (cuentaId: string) => {
    setEnriqueciendoId(cuentaId);
    setError("");
    try {
      const response = await fetch("/api/enrich-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cuentaId, mode: 'basic' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al enriquecer con IA");
      }
      
      const resData = data.data || {};
      setDatosBasicosPropuestos({
        web: resData.web || "",
        telefono: resData.telefono || "",
        ciudad: resData.ciudad || "",
        segmento: resData.segmento || ""
      });
      setCuentaIdActiva(cuentaId);
      setModalBasicAbierto(true);
    } catch (err: any) {
      console.error("Error al enriquecer con IA:", err);
      setError(err.message || "Error al enriquecer con IA");
      setTimeout(() => setError(""), 5000);
    } finally {
      setEnriqueciendoId(null);
    }
  };

  const guardarDatosBasicosConfirmados = async () => {
    if (!cuentaIdActiva) return;
    try {
      const payload = {
        web: datosBasicosPropuestos.web || null,
        telefono: datosBasicosPropuestos.telefono || null,
        ciudad: datosBasicosPropuestos.ciudad || null,
        segmento: datosBasicosPropuestos.segmento || null,
        origen: 'AI'
      };
      
      const { error } = await supabase
        .from("cuentas")
        .update(payload)
        .eq("id", cuentaIdActiva);
        
      if (error) throw error;
      setModalBasicAbierto(false);
      await cargarCuentas();
    } catch (err: any) {
      console.error("Error al guardar datos enriquecidos:", err);
      alert("Error al guardar datos enriquecidos: " + err.message);
    }
  };

  const buscarSimilaresConIA = async (cuentaId: string) => {
    setBuscandoSimilaresId(cuentaId);
    setError("");
    try {
      const response = await fetch("/api/enrich-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cuentaId, mode: 'similar' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al buscar empresas similares");
      }
      
      const { data: accountData } = await supabase.from("cuentas").select("cliente").eq("id", cuentaId).single();
      const originalName = accountData?.cliente || "";
      const similares = data.data?.similares || [];
      
      setEmpresaOriginalNombre(originalName);
      setListaSimilaresEncontradas(similares);
      setCuentaIdActiva(cuentaId);
      setModalSimilaresAbierto(true);
    } catch (err: any) {
      console.error("Error al buscar similares con IA:", err);
      setError(err.message || "Error al buscar empresas similares con IA");
      setTimeout(() => setError(""), 5000);
    } finally {
      setBuscandoSimilaresId(null);
    }
  };

  const guardarSimilaresConfirmadas = async () => {
    if (!cuentaIdActiva) return;
    try {
      const { data: activeAcc } = await supabase.from("cuentas").select("sector, segmento").eq("id", cuentaIdActiva).single();
      const sector = activeAcc?.sector || 'privado';
      const segmento = activeAcc?.segmento || 'Servicios';

      for (const emp of listaSimilaresEncontradas) {
        if (!emp.cliente || emp.cliente.trim() === "") continue;

        const { data: existingEmp } = await supabase
          .from("cuentas")
          .select("id")
          .ilike("cliente", emp.cliente.trim())
          .maybeSingle();

        if (existingEmp) continue;

        await supabase.from("cuentas").insert([
          {
            cliente: emp.cliente.trim(),
            web: emp.web || null,
            ciudad: emp.ciudad || "Santiago",
            sector,
            segmento,
            estado: "prospecto",
            etapa_prospeccion: "Sin Verificar",
            origen: "AI",
            cuenta_foco: true,
            vendedor_id: null,
            created_at: new Date().toISOString()
          }
        ]);
      }
      setModalSimilaresAbierto(false);
      await cargarCuentas();
    } catch (err: any) {
      console.error("Error al guardar similares:", err);
      alert("Error al guardar similares: " + err.message);
    }
  };


  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Cuentas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
            Gestión inteligente de empresas. <span className="text-blue-500 font-bold underline">Nota:</span> Correo y Teléfono ahora se gestionan en la pestaña de <Link to="/contactos" className="hover:text-blue-600">Contactos</Link>.
          </p>
        </div>
        <Link
          to="/cuentas/nueva"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
        >
          ➕ Nueva Cuenta
        </Link>
      </div>

      {/* Panel de Agenda de Prospección Rápida */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => {
            const act = filtroFoco === "foco" && filtroEtapa === "todas";
            setFiltroFoco(act ? "todos" : "foco");
            setFiltroEtapa("todas");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco" && filtroEtapa === "todas"
              ? "bg-yellow-500/15 border-yellow-500 text-yellow-700 dark:text-yellow-400 ring-2 ring-yellow-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">⭐ Cuentas Foco Totales</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.totalFoco}</p>
          </div>
          <span className="text-2xl">⭐</span>
        </button>

        <button
          onClick={() => {
            const act = filtroFoco === "foco" && filtroEtapa === "Sin Verificar";
            setFiltroFoco(act ? "todos" : "foco");
            setFiltroEtapa(act ? "todas" : "Sin Verificar");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco" && filtroEtapa === "Sin Verificar"
              ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">🔍 Sin Verificar (Foco)</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.sinVerificar}</p>
          </div>
          <span className="text-2xl">🔍</span>
        </button>

        <button
          onClick={() => {
            const act = filtroFoco === "foco" && filtroEtapa === "Verificado";
            setFiltroFoco(act ? "todos" : "foco");
            setFiltroEtapa(act ? "todas" : "Verificado");
            setPaginaActual(1);
          }}
          className={cn(
            "p-5 rounded-2xl border text-left transition-all shadow-md flex items-center justify-between cursor-pointer",
            filtroFoco === "foco" && filtroEtapa === "Verificado"
              ? "bg-green-500/15 border-green-500 text-green-700 dark:text-green-400 ring-2 ring-green-500/20"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500"
          )}
        >
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">✅ Verificado (Foco)</p>
            <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{stats.verificado}</p>
          </div>
          <span className="text-2xl">✅</span>
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por cliente, RUT o ciudad..."
              className="w-full border-none rounded-xl px-12 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
            {cargando ? (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : busqueda ? (
              <button
                onClick={() => { setBusqueda(""); }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <div className="relative">
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => {
                setFiltroFecha(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full border-none rounded-xl px-6 py-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer"
              title="Filtrar por fecha de ingreso"
            />
            {filtroFecha ? (
              <button
                onClick={() => { setFiltroFecha(""); }}
                className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Limpiar fecha"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {[
            { label: "Sector", val: filtroSector, set: setFiltroSector, opts: availableSectors },
            { label: "Segmento", val: filtroSegmento, set: setFiltroSegmento, opts: availableSegments },
            {
              label: "Vendedor",
              val: filtroVendedor,
              set: setFiltroVendedor,
              opts: [
                { value: "", label: "Vendedor: Todos" },
                ...vendedores.map((v) => ({ value: v.id, label: `👤 ${v.nombre}` })),
                { value: "null", label: "👤 Sin Asignar (IA)" }
              ]
            },
            {
              label: "Prioridad",
              val: filtroFoco,
              set: setFiltroFoco,
              opts: [
                { value: "todos", label: "Prioridad: Todas" },
                { value: "foco", label: "⭐ Solo Foco" }
              ]
            },
            {
              label: "Etapa Prosp.",
              val: filtroEtapa,
              set: setFiltroEtapa,
              opts: [
                { value: "todas", label: "Etapa: Todas" },
                { value: "Sin Verificar", label: "🔍 Sin Verificar" },
                { value: "Verificado", label: "✅ Verificado" }
              ]
            }
          ].map((f, i) => (
            <div key={i}>
              <select
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full border-none rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-xs font-semibold capitalize"
              >
                {Array.isArray(f.opts) && typeof f.opts[0] === 'string' ? (
                  <>
                    <option value="">{f.label}: Todos</option>
                    {f.opts.map((opt) => (
                      <option key={opt} value={opt || ""}>{opt}</option>
                    ))}
                  </>
                ) : (
                  (f.opts as any[]).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))
                )}
              </select>
            </div>
          ))}
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resetear
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 animate-pulse">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}

      {/* Tabla con Edición Inline */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {["Cliente", "Teléfono", "Sector", "Segmento", "Etapa", "Fecha ingreso", ""].map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest",
                    h === "Sector" ? "w-[100px] min-w-[90px] text-center" : ""
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y divide-gray-100 dark:divide-gray-700 transition-opacity duration-200 ${cargando ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {cargando && cuentasPaginadas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
                    <div className="text-gray-600 dark:text-gray-400 font-medium">⏳ Sincronizando cuentas...</div>
                  </div>
                </td>
              </tr>
            ) : cuentasPaginadas.length > 0 ? (
              cuentasPaginadas.map((cuenta) => (
                <tr
                  key={cuenta.id}
                  className={`group transition-colors ${
                    cuenta.origen === 'AI'
                      ? "bg-cyan-100/80 dark:bg-cyan-950/50 hover:bg-cyan-200/60 dark:hover:bg-cyan-900/50"
                      : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                  }`}
                >
                  <td className="px-4 py-2 min-w-[280px]">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-center gap-1 shrink-0 min-w-[28px]">
                        {/* Botón de estrella de prioridad */}
                        <button
                          type="button"
                          onClick={() => actualizarCuentaInline(cuenta.id, "cuenta_foco", !cuenta.cuenta_foco)}
                          className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-yellow-500 transition-all transform hover:scale-110 cursor-pointer"
                          title={cuenta.cuenta_foco ? "Quitar prioridad" : "Marcar como prioridad (Foco)"}
                        >
                          <span className={`text-lg leading-none ${cuenta.cuenta_foco ? "text-yellow-500 fill-current font-bold" : "opacity-30"}`}>★</span>
                        </button>
                        {cuenta.origen === 'AI' && (
                          <span className="px-1 py-0.5 rounded bg-cyan-200 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 text-[8px] font-black uppercase tracking-widest leading-none">
                            IA
                          </span>
                        )}
                      </div>

                      {cuenta.contactos && cuenta.contactos.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="mt-1.5 p-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 text-blue-600 dark:text-blue-400 cursor-pointer transition-all hover:scale-105 shrink-0"
                              title={`Ver ${cuenta.contactos.length} contacto(s)`}
                            >
                              <Plus className="h-3 w-3 font-bold" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl z-50" align="start">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2 mb-2 uppercase tracking-wide flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-500" />
                              Contactos de la Cuenta
                            </h4>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                              {cuenta.contactos.map((contact: any) => (
                                <div key={contact.id} className="text-xs border-b border-gray-50 dark:border-gray-700/50 pb-2 last:border-0 last:pb-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-gray-900 dark:text-gray-100 uppercase truncate">{contact.nombre || "Sin nombre"}</p>
                                      {contact.correo && (
                                        <p className="text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={contact.correo}>{contact.correo}</p>
                                      )}
                                      {(contact.celular || contact.telefono) && (
                                        <p className="text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                                          📞 {contact.celular || contact.telefono}
                                        </p>
                                      )}
                                    </div>
                                    {contact.correo && (
                                      <button
                                        type="button"
                                        onClick={() => abrirModalZoho(contact, cuenta)}
                                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 cursor-pointer transition-all hover:scale-105 shrink-0"
                                        title="Preparar correo de Zoho"
                                      >
                                        <Mail className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="w-5 shrink-0" />
                      )}
                      
                      <div className="flex-grow flex flex-col">
                        <textarea
                          defaultValue={cuenta.cliente || ""}
                          onBlur={(e) => actualizarCuentaInline(cuenta.id, "cliente", e.target.value)}
                          rows={2}
                          className="w-full bg-transparent border-none rounded-lg px-2 py-1 text-sm font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all resize-none"
                        />
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold px-2 pb-1">
                          👤 {cuenta.vendedores?.nombre || "Sin Asignar (IA)"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-2 min-w-[150px]">
                    <input
                      defaultValue={cuenta.telefono || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "telefono", e.target.value)}
                      placeholder="Sin teléfono"
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 w-[100px] min-w-[90px]">
                    <input
                      defaultValue={cuenta.sector || ""}
                      onBlur={(e) => actualizarCuentaInline(cuenta.id, "sector", e.target.value)}
                      className="w-full bg-transparent border-none rounded-lg px-1 py-1.5 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-center"
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[200px]">
                    <Popover 
                      open={openSegmentId === cuenta.id} 
                      onOpenChange={(open) => {
                        if (open) {
                          setOpenSegmentId(cuenta.id);
                        } else {
                          setOpenSegmentId(null);
                          setSearchSegment("");
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-lg text-sm transition-all focus:ring-1 focus:ring-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                            cuenta.segmento ? "text-gray-900 dark:text-white font-medium" : "text-gray-400 dark:text-gray-500 italic"
                          )}
                        >
                          {cuenta.segmento || "Seleccionar..."}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl z-50" align="start">
                        <div className="flex flex-col space-y-2">
                          <input
                            type="text"
                            placeholder="Buscar o escribir nuevo..."
                            value={searchSegment}
                            onChange={(e) => setSearchSegment(e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <div className="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar">
                            {availableSegments
                              .filter((seg) => seg.toLowerCase().includes(searchSegment.toLowerCase()))
                              .length === 0 ? (
                                <div className="py-2 text-center text-xs text-gray-500">
                                  No se encontraron segmentos.
                                </div>
                              ) : (
                                availableSegments
                                  .filter((seg) => seg.toLowerCase().includes(searchSegment.toLowerCase()))
                                  .map((seg) => (
                                    <div
                                      key={seg}
                                      className="group/item flex items-center justify-between px-2 py-1 text-xs rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await actualizarCuentaInline(cuenta.id, "segmento", seg);
                                          setOpenSegmentId(null);
                                          setSearchSegment("");
                                        }}
                                        className="flex-1 text-left text-gray-900 dark:text-gray-100 font-medium"
                                      >
                                        {seg}
                                      </button>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {cuenta.segmento === seg && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                                        {!SEGMENTOS_MAESTROS.includes(seg) && (
                                          <button
                                            type="button"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm(`¿Estás seguro de que deseas eliminar el segmento "${seg}" del catálogo?`)) {
                                                await eliminarSegmentoDelCatálogo(seg);
                                              }
                                            }}
                                            className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer"
                                            title="Eliminar de la lista"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                              )}
                          </div>
                          {searchSegment.trim() && !availableSegments.some(s => s.toLowerCase() === searchSegment.trim().toLowerCase()) && (
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                              <button
                                type="button"
                                className="w-full text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center gap-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                                onClick={() => {
                                  agregarNuevoSegmentoAlCatálogo(searchSegment.trim(), cuenta.id);
                                }}
                              >
                                <Plus className="h-3 w-3" />
                                Crear "{searchSegment.trim()}"
                              </button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-4 py-2 min-w-[150px]">
                    <select
                      value={cuenta.etapa_prospeccion || "Sin Verificar"}
                      onChange={(e) => actualizarCuentaInline(cuenta.id, "etapa_prospeccion", e.target.value)}
                      className={`text-xs font-bold rounded-lg px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                        cuenta.etapa_prospeccion === "Verificado" 
                          ? "text-green-600 dark:text-green-400 font-bold" 
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      <option value="Sin Verificar">🔍 Sin Verificar</option>
                      <option value="Verificado">✅ Verificado</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 min-w-[150px]">
                    <input
                      type="date"
                      defaultValue={cuenta.created_at ? (() => {
                        const d = new Date(cuenta.created_at);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      })() : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          try {
                            const localDate = new Date(`${e.target.value}T12:00:00`);
                            actualizarCuentaInline(cuenta.id, "created_at", localDate.toISOString());
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                      className="w-full bg-transparent border-none rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all cursor-pointer font-medium"
                    />
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/contactos/nuevo?cuentaId=${cuenta.id}&returnTo=/cuentas`}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors rounded-lg cursor-pointer"
                        title="Agregar Contacto"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Link>

                      {guardandoId === cuenta.id ? (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      ) : (
                        <Link
                          to={`/cuentas/editar/${cuenta.id}`}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Editar Cuenta"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                      )}

                      {enriqueciendoId === cuenta.id ? (
                        <Loader2 className="h-4 w-4 text-cyan-500 animate-spin" />
                      ) : (
                        <button
                          onClick={() => enriquecerConIA(cuenta.id)}
                          className="p-2 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Enriquecer Datos Básicos con IA"
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                      )}

                      {buscandoSimilaresId === cuenta.id ? (
                        <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
                      ) : (
                        <button
                          onClick={() => buscarSimilaresConIA(cuenta.id)}
                          className="p-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors rounded-lg cursor-pointer"
                          title="Buscar 5 empresas similares en Chile"
                        >
                          <Compass className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => eliminarCuenta(cuenta.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        title="Eliminar Cuenta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4 text-gray-500 dark:text-gray-400">
                    <Search className="h-12 w-12 opacity-20" />
                    <div className="max-w-xs mx-auto">
                      <p className="text-lg font-bold">No se encontraron cuentas</p>
                      <p className="text-sm">Intenta ajustar los filtros o la búsqueda para encontrar lo que buscas.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* Paginación */}
      {
        totalPaginas > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 px-6 py-4">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Página <span className="text-gray-900 dark:text-white">{paginaActual}</span> de <span className="text-gray-900 dark:text-white">{totalPaginas}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold disabled:opacity-50 transition-all"
              >
                Anterior
              </button>
              <button
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold disabled:opacity-50 transition-all"
              >
                Siguiente
              </button>
            </div>
          </div>
        )
      }

      {/* Modal 1: Datos Básicos Encontrados */}
      <Dialog open={modalBasicAbierto} onOpenChange={setModalBasicAbierto}>
        <DialogContent className="max-w-md p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-500" />
              Datos de Cuenta Propuestos por IA
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Revisa y edita los datos básicos encontrados antes de aplicarlos a la cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Sitio Web</label>
              <input
                type="text"
                value={datosBasicosPropuestos.web}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, web: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="www.ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Teléfono</label>
              <input
                type="text"
                value={datosBasicosPropuestos.telefono}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, telefono: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="+56 2..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Ciudad</label>
              <input
                type="text"
                value={datosBasicosPropuestos.ciudad}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, ciudad: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Santiago"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Segmento</label>
              <select
                value={datosBasicosPropuestos.segmento}
                onChange={(e) => setDatosBasicosPropuestos(p => ({ ...p, segmento: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona segmento...</option>
                {SEGMENTOS_MAESTROS.map(seg => (
                  <option key={seg} value={seg}>{seg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setModalBasicAbierto(false)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={guardarDatosBasicosConfirmados}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all shadow-md text-sm cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Empresas Similares Encontradas */}
      <Dialog open={modalSimilaresAbierto} onOpenChange={setModalSimilaresAbierto}>
        <DialogContent className="max-w-md p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-violet-500" />
              Empresas Similares Encontradas
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Hemos detectado los siguientes competidores de <span className="font-bold text-gray-950 dark:text-white">"{empresaOriginalNombre}"</span> en Chile. Presiona Aceptar para crearlos.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
            {listaSimilaresEncontradas.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
                No se encontraron nuevas empresas similares.
              </div>
            ) : (
              listaSimilaresEncontradas.map((emp, index) => (
                <div 
                  key={index}
                  className="flex flex-col p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    ⭐ {emp.cliente}
                  </span>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {emp.ciudad && (
                      <span>📍 {emp.ciudad}</span>
                    )}
                    {emp.web && (
                      <span className="text-blue-500 truncate max-w-[200px]">
                        🔗 {emp.web}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setModalSimilaresAbierto(false)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={guardarSimilaresConfirmadas}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all shadow-md text-sm cursor-pointer"
            >
              Aceptar
            </button>
          </div>
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
                {guardandoFechas ? "ACTUALIZANDO..." : "ACTUALIZAR"}
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
                          onClick={() => {
                            if (!selectedContactoDraft) return;
                            const newEstado = selectedContactoDraft.estado === 'activo' ? 'inactivo' : 'activo';
                            setSelectedContactoDraft(prev => prev ? { ...prev, estado: newEstado } : prev);
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

                        // 1. Generar versión HTML para el portapapeles
                        let htmlBody = cleanBody.replace(/\n/g, "<br/>");
                        
                        // Si hay URL/Base64 de render en el contacto, inyectar esa. Si no, no inyectar nada
                        if (imageUrl.trim()) {
                          const imgTag = `<img src="${imageUrl.trim()}" alt="Render Ecomoving" style="max-width:100%; height:auto; margin: 20px 0; border-radius: 12px; border: 1px solid #e2e8f0; display: block;" />`;
                          
                          // Marcadores posibles de imagen
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

                          // Si no hay marcador explícito, la inserta entre párrafos por defecto
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
                          // Limpiar variables de imagen si no hay render configurado
                          htmlBody = htmlBody
                            .replace(/{\s*imagen\s*}/gi, "")
                            .replace(/{\s*imagen_url\s*}/gi, "")
                            .replace(/{\s*render\s*}/gi, "")
                            .replace(/\(\s*imagen pegada en el cuerpo del correo\s*\)/gi, "");
                        }

                        // Agregar píxel invisible de rastreo al final
                        const pixelUrl = `${window.location.origin}/api/sentinel-pixel?contacto_id=${selectedContactoDraft?.id}&template_id=${selectedTemplateId || ''}`;
                        const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" />`;
                        htmlBody = htmlBody + pixelTag;

                        // 2. Copiar cuerpo enriquecido al portapapeles
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

                        // 3. Marcar en base de datos que se envió una cortesía (para trazabilidad opcional)
                        const now = new Date();
                        const timestamp = now.getTime();
                        
                        // Actualizar estado visual del modal inmediatamente
                        setSelectedContactoDraft(prev => prev ? {
                          ...prev,
                          estado: 'activo'
                        } : prev);
                        
                        await supabase.from('contactos').update({
                          ultimo_envio: now.toISOString(),
                          ultimo_evento_trazabilidad: now.toISOString(),
                          estado: "activo",
                          etapa: "marketing"
                        }).eq('id', selectedContactoDraft.id);

                        // Registrar un evento 'sent' con precisión timestamptz en la tabla trazabilidad_correos
                        await supabase.from('trazabilidad_correos').insert({
                          contacto_id: selectedContactoDraft.id,
                          email: selectedContactoDraft.correo.toLowerCase(),
                          fecha: now.toISOString().split('T')[0],
                          estado: 'sent',
                          mensaje_id: `manual_send:${selectedTemplateId}:${timestamp}`
                        });
                        
                        // Recargar cuentas para reflejar el cambio en la vista principal
                        cargarCuentas();

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
    </div >
  );
}

// --- Helper to get clean fantasy/short name for a company ---
const cleanCompanyShortName = (companyName: string): string => {
  if (!companyName) return "";
  
  let clean = companyName;
  
  // 1. Remove long corporate prefixes case-insensitively
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
  
  // 2. Remove common Chilean legal suffixes case-insensitively
  clean = clean.replace(/,?\s*(s\.?a\.?|spa|limitada|ltda\.?|s\.?a\.?c\.?|e\.?i\.?r\.?l\.?|chile|group|grupo|s\.a\.s\.?)\b/gi, "");
  
  // 3. Clean up extra spaces, trailing/leading commas or periods
  clean = clean.replace(/^[ ,.\t]+/, "").replace(/[,.\s]+$/, "").trim();
  
  return clean || companyName;
};

// --- Soporte de variables e inicialización ---
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

  return {
    resolvedSubject: replaceAll(subject),
    resolvedBody: replaceAll(body)
  };
};
