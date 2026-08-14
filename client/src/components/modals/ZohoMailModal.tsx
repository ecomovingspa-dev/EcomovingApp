
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Edit2, Loader2, CheckCircle2, Image as ImageIcon, Send, Pencil, Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ZohoMailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contacto: any | null;
  cuenta: any | null;
  vendedor: string;
  onRefresh: () => Promise<void>;
}

export function ZohoMailModal({
  isOpen,
  onOpenChange,
  contacto: selectedContactoDraft,
  cuenta: selectedCuentaDraft,
  vendedor,
  onRefresh
}: ZohoMailModalProps) {
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesClientes, setTemplatesClientes] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSendDates, setTemplateSendDates] = useState<Record<string, string>>({});
  const [isEditingTemplateMode, setIsEditingTemplateMode] = useState(false);
  const [tempEditName, setTempEditName] = useState("");
  const [tempEditSubject, setTempEditSubject] = useState("");
  const [tempEditBody, setTempEditBody] = useState("");
  const [draftData, setDraftData] = useState<{email: string; subject: string; body: string; contactoId: string} | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlCliente, setImageUrlCliente] = useState("");
  
  const [guardandoFechas, setGuardandoFechas] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [guardandoImagen, setGuardandoImagen] = useState(false);
  const [guardandoImagenCliente, setGuardandoImagenCliente] = useState(false);

  // Funciones auxiliares
  const formatToInputDate = (ddMMyyyy: string) => {
    if (!ddMMyyyy || ddMMyyyy === "—") return "";
    const parts = ddMMyyyy.split("/");
    if (parts.length !== 3) return "";
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const resolveTemplateVariables = (
    subject: string,
    body: string,
    contacto: any,
    cuenta: any,
    vendedorName: string
  ) => {
    const contactName = contacto?.nombre || "";
    const shortName = contactName.split(" ")[0];
    const finalCompany = (contacto?.empresa_rel_name || cuenta?.nombre || "").trim();
    const shortCompany = finalCompany.replace(/\b(SpA|EIRL|S\.A\.|LTDA|Limitada|S\.A)\b/gi, "").trim();
    
    // Configuración del equipo comercial (harcodeado temporalmente igual que antes)
    const telefonosPorVendedor: Record<string, string> = {
      "José Tomas Gonzalez": "+56942007727",
      "Ignacio Gonzalez": "+56961159807"
    };
    const telefonoVendedor = telefonosPorVendedor[vendedorName] || "+56942007727";

    const replaceAll = (text: string) => {
      return text
        .replace(/{\s*nombre\s*}/gi, contactName)
        .replace(/{\s*nombre_corto\s*}/gi, shortName)
        .replace(/{\s*contacto\s*}/gi, shortName)
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
          rawName: etapa.nombre || "",
          subject: etapa.asunto_template || "",
          body: `${etapa.mensaje_intro || ""}\n\n${etapa.mensaje_cierre || ""}`.trim()
        }));
        setTemplates(prospectionTemplates);
      }

      const { data: dbClientes, error: dbClientesErr } = await supabase
        .from("configuracion_clientes")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (!dbClientesErr && dbClientes && dbClientes.length > 0) {
        const clientesTemplates = dbClientes.map(etapa => ({
          id: `builtin-clientes-${etapa.orden}`,
          dbId: etapa.id,
          orden: etapa.orden,
          name: `${etapa.orden}. ${etapa.nombre}`,
          rawName: etapa.nombre || "",
          subject: etapa.asunto_template || "",
          body: `${etapa.mensaje_intro || ""}\n\n${etapa.mensaje_cierre || ""}`.trim()
        }));
        setTemplatesClientes(clientesTemplates);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsEditingTemplateMode(false);
      setImageUrl(selectedContactoDraft?.imagen || "");
      setImageUrlCliente("");
      
      setTemplateSendDates({});
      if (selectedContactoDraft) {
        const focoColumns = [selectedContactoDraft.fecha_envio_foco, selectedContactoDraft.fecha_envio_foco_2, selectedContactoDraft.fecha_envio_foco_3];
        const datesMap: Record<string, string> = {};
        focoColumns.forEach((fecha, idx) => {
          if (fecha) {
            const parts = fecha.split('-');
            if (parts.length === 3) {
              const templateId = templates.length > idx ? templates[idx].id : `builtin-prospeccion-${idx + 1}`;
              datesMap[templateId] = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          }
        });
        setTemplateSendDates(datesMap);
      }
    }
  }, [isOpen, selectedContactoDraft]);

  useEffect(() => {
    if (isOpen && templates.length > 0 && selectedContactoDraft && !draftData) {
      const firstTmpl = templates[0];
      setSelectedTemplateId(firstTmpl.id);
      const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
        firstTmpl.subject,
        firstTmpl.body,
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
    }
  }, [isOpen, templates, selectedContactoDraft, draftData, selectedCuentaDraft, vendedor]);


  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    let tmpl = templates.find(t => t.id === id);
    if (!tmpl) tmpl = templatesClientes.find(t => t.id === id);
    if (tmpl && selectedContactoDraft) {
      const { resolvedSubject, resolvedBody } = resolveTemplateVariables(
        tmpl.subject,
        tmpl.body,
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
    }
  };

  const startEditingTemplate = (tmpl: any) => {
    setIsEditingTemplateMode(true);
    setTempEditName(tmpl.rawName);
    setTempEditSubject(tmpl.subject);
    setTempEditBody(tmpl.body);
  };

  const handleSaveTemplateChanges = async () => {
    let isCliente = false;
    let tmpl = templates.find(t => t.id === selectedTemplateId);
    if (!tmpl) {
      tmpl = templatesClientes.find(t => t.id === selectedTemplateId);
      isCliente = true;
    }
    
    if (!tmpl || !tmpl.dbId) {
      toast.error("No se encontró el ID de base de datos de la plantilla");
      return;
    }
    
    setGuardandoPlantilla(true);
    try {
      const tableName = isCliente ? "configuracion_clientes" : "configuracion_prospeccion";
      const { error } = await supabase
        .from(tableName)
        .update({
          nombre: tempEditName,
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

  const handleCreateTemplateCliente = async () => {
    try {
      const nextOrden = templatesClientes.length + 1;
      const { data, error } = await supabase
        .from("configuracion_clientes")
        .insert({
          orden: nextOrden,
          nombre: `Plantilla Cliente ${nextOrden}`,
          asunto_template: "Nuevo Asunto",
          mensaje_intro: "Hola {nombre},\n\nTe envío el render para {empresa}:\n\n{render}",
          mensaje_cierre: "Saludos",
          activo: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast.success("Nueva plantilla creada");
      await loadTemplates();
      
      const newTemplateId = `builtin-clientes-${nextOrden}`;
      setSelectedTemplateId(newTemplateId);
      setIsEditingTemplateMode(true);
      setTempEditSubject(data.asunto_template);
      setTempEditBody(`${data.mensaje_intro}\n\n${data.mensaje_cierre}`);
    } catch (err: any) {
      console.error("Error creating template:", err);
      toast.error("Error al crear plantilla: " + err.message);
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
          if (selectedContactoDraft) {
              selectedContactoDraft.imagen = base64String;
          }
          await onRefresh();
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

  const handleImageUploadCliente = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGuardandoImagenCliente(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImageUrlCliente(base64String);
        toast.success("¡Render cargado en la pestaña Clientes!");
        setGuardandoImagenCliente(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Error reading file:", err);
      toast.error("Error al leer el archivo");
      setGuardandoImagenCliente(false);
    }
  };

  const handleSaveAllTemplateDates = async () => {
    if (!selectedContactoDraft || !selectedContactoDraft.id) return;
    
    setGuardandoFechas(true);
    try {
      const focoColumnMap: Record<number, string> = { 0: 'fecha_envio_foco', 1: 'fecha_envio_foco_2', 2: 'fecha_envio_foco_3' };
      const updatePayload: Record<string, string | null> = {};
      
      templates.forEach((t, idx) => {
        const colName = focoColumnMap[idx];
        if (!colName) return;
        const tDate = templateSendDates[t.id];
        if (tDate && tDate !== "—") {
          const parts = tDate.split("/");
          if (parts.length === 3) {
            updatePayload[colName] = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            updatePayload[colName] = null;
          }
        } else {
          updatePayload[colName] = null;
        }
      });

      updatePayload.estado = selectedContactoDraft.estado;
      await supabase.from('contactos').update(updatePayload).eq('id', selectedContactoDraft.id);

      const { data: existingEvents, error: fetchErr } = await supabase
        .from("trazabilidad_correos")
        .select("id, mensaje_id")
        .eq("contacto_id", selectedContactoDraft.id);

      if (!fetchErr) {
        for (const t of templates) {
          const tSendDate = templateSendDates[t.id];
          const targetEvent = existingEvents?.find(row => 
            row.mensaje_id && row.mensaje_id.startsWith(`manual_send:${t.id}:`)
          );

          if (!tSendDate || tSendDate === "—") {
            if (targetEvent) {
              await supabase.from("trazabilidad_correos").delete().eq("id", targetEvent.id);
            }
            continue;
          }

          const parts = tSendDate.split("/");
          if (parts.length === 3) {
            const inputDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            const targetDate = new Date(`${inputDateStr}T12:00:00`);

            if (targetEvent) {
              await supabase.from("trazabilidad_correos")
                .update({ fecha: inputDateStr })
                .eq("id", targetEvent.id);
            } else {
              await supabase.from("trazabilidad_correos").insert({
                contacto_id: selectedContactoDraft.id,
                email: selectedContactoDraft.correo.toLowerCase(),
                fecha: inputDateStr,
                estado: 'sent',
                mensaje_id: `manual_send:${t.id}:${targetDate.getTime()}`
              });
            }
          }
        }
      }

      toast.success("Fechas guardadas correctamente");
      await onRefresh();
    } catch (err: any) {
      console.error("Error al guardar fechas:", err);
      toast.error("Error al guardar las fechas: " + err.message);
    } finally {
      setGuardandoFechas(false);
    }
  };

  return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl text-gray-900 dark:text-gray-100">
          <Tabs defaultValue="prospeccion" className="w-full">
            <div className="flex flex-col gap-4 mb-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Mail className="h-5 w-5" /> Redacción e Inteligencia de Plantillas Zoho
                </DialogTitle>
                <DialogDescription className="text-gray-505">
                  Selecciona una plantilla para enviar a {selectedContactoDraft?.nombre}.
                </DialogDescription>
              </DialogHeader>
              <div className="flex w-full">
                <TabsList className="bg-gray-100 dark:bg-gray-800 w-[90%] mx-auto justify-center rounded-lg h-12 p-1 gap-2 mb-4">
                  <TabsTrigger 
                    value="prospeccion" 
                    className="text-sm font-black uppercase rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-400 text-gray-400 pb-3 px-0 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    Prospección
                  </TabsTrigger>
                  <TabsTrigger 
                    value="clientes" 
                    className="text-sm font-black uppercase rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-400 text-gray-400 pb-3 px-0 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    Cuentas Activas
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="prospeccion" className="mt-0">
              <div className="grid grid-cols-12 gap-6 mt-2">
            
            {/* Columna Izquierda: Plantillas y Fechas combinadas */}
            <div className="col-span-12 md:col-span-5 border-r border-gray-100 dark:border-gray-800 pr-4 flex flex-col justify-between h-[450px]">
              <div className="flex flex-col space-y-3 overflow-hidden h-full">
                <div className="flex justify-between items-center pr-2">
                  <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plantillas Disponibles
                  </span>
                  <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-6">
                    Fecha Envío
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 h-full">
                  {templates.map(t => {
                    const sendDate = templateSendDates[t.id];
                    const dateOnly = sendDate ? sendDate.split(" ")[0] : "—";
                    return (
                      <div 
                        key={t.id}
                        onClick={() => {
                          setIsEditingTemplateMode(false);
                          handleSelectTemplate(t.id);
                        }}
                        className={cn(
                          "group p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2",
                          selectedTemplateId === t.id
                            ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 shadow-sm"
                            : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/80"
                        )}
                      >
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <span className={cn("text-xs font-bold truncate", selectedTemplateId === t.id ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white")}>
                            {t.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
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
                              "bg-transparent text-center border-none outline-none focus:ring-0 w-[105px] text-xs cursor-pointer font-bold select-none p-0",
                              dateOnly !== "—" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-450 dark:text-gray-600"
                            )}
                          />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplateId(t.id);
                              startEditingTemplate(t);
                            }}
                            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-all"
                            title="Editar estructura de plantilla"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
                {guardandoFechas ? "ACTUALIZANDO..." : "ACTUALIZAR FECHAS"}
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
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre de Plantilla</label>
                    <input 
                      type="text" 
                      value={tempEditName} 
                      onChange={(e) => setTempEditName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 rounded-md py-1 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
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
                            const { error } = await supabase.from('contactos').update({ estado: newEstado }).eq('id', selectedContactoDraft.id);
                            if (error) {
                              toast.error('Error al cambiar el estado');
                            } else {
                              toast.success('Estado actualizado');
                              if (onRefresh) await onRefresh();
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
                  onClick={() => onOpenChange(false)}
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

                        // Determinar la columna fecha_envio_foco correcta según la plantilla seleccionada
                        const templateIdx = templates.findIndex(t => t.id === selectedTemplateId);
                        const focoColMap: Record<number, string> = { 0: 'fecha_envio_foco', 1: 'fecha_envio_foco_2', 2: 'fecha_envio_foco_3' };
                        const focoCol = focoColMap[templateIdx] || 'fecha_envio_foco';
                        
                        await supabase.from('contactos').update({
                          [focoCol]: now.toISOString().split('T')[0],
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
                        
                        
                        
                        onRefresh();

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
            </TabsContent>

            <TabsContent value="clientes" className="mt-0">
              <div className="grid grid-cols-12 gap-6 mt-2">
                
                {/* Columna Izquierda: Plantillas de Cliente y Fechas combinadas */}
                <div className="col-span-12 md:col-span-5 border-r border-gray-100 dark:border-gray-800 pr-4 flex flex-col justify-between h-[450px]">
                  <div className="flex flex-col space-y-3 overflow-hidden h-full">
                    <div className="flex justify-between items-center pr-2">
                      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Plantillas Clientes
                      </span>
                      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-6">
                        Fecha Envío
                      </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 h-full">
                      {templatesClientes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/20 h-full">
                          <Mail className="h-8 w-8 text-gray-400 mb-2 opacity-50" />
                          <p className="text-xs text-gray-500">Sin plantillas.</p>
                        </div>
                      ) : (
                        templatesClientes.map(t => {
                          const sendDate = templateSendDates[t.id];
                          const dateOnly = sendDate ? sendDate.split(" ")[0] : "—";
                          return (
                            <div 
                              key={t.id}
                              onClick={() => {
                                setIsEditingTemplateMode(false);
                                handleSelectTemplate(t.id);
                              }}
                              className={cn(
                                "group p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2",
                                selectedTemplateId === t.id
                                  ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 shadow-sm"
                                  : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/80"
                              )}
                            >
                              <div className="flex-1 flex flex-col gap-1 min-w-0">
                                <span className={cn("text-xs font-bold truncate", selectedTemplateId === t.id ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white")}>
                                  {t.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
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
                                    "bg-transparent text-center border-none outline-none focus:ring-0 w-[105px] text-xs cursor-pointer font-bold select-none p-0",
                                    dateOnly !== "—" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-450 dark:text-gray-600"
                                  )}
                                />

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTemplateId(t.id);
                                    startEditingTemplate(t);
                                  }}
                                  className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-all"
                                  title="Editar estructura de plantilla"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-white dark:bg-gray-900 border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0 mt-2"
                      onClick={handleCreateTemplateCliente}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Crear Nueva Plantilla
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAllTemplateDates}
                    disabled={guardandoFechas}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md text-xs cursor-pointer mt-2 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {guardandoFechas && <Loader2 className="h-3 w-3 animate-spin" />}
                    {guardandoFechas ? "ACTUALIZANDO..." : "ACTUALIZAR FECHAS"}
                  </button>
                </div>

                {/* Columna Derecha: Redacción Manual */}
                <div className="col-span-12 md:col-span-7 flex flex-col justify-between h-[450px]">
                  {isEditingTemplateMode ? (
                    <div className="space-y-4 flex-grow flex flex-col">
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
                        <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre de Plantilla</label>
                        <input 
                          type="text" 
                          value={tempEditName} 
                          onChange={(e) => setTempEditName(e.target.value)}
                          className="w-full bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 text-xs text-gray-900 dark:text-gray-100 rounded-md py-1 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div className="flex flex-col space-y-1">
                        <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editar Asunto Base</label>
                        <input 
                          type="text" 
                          value={tempEditSubject} 
                          onChange={(e) => setTempEditSubject(e.target.value)}
                          className="w-full bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 text-xs text-gray-900 dark:text-gray-100 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col space-y-1 min-h-0">
                        <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editar Cuerpo Base</label>
                        <textarea 
                          value={tempEditBody} 
                          onChange={(e) => setTempEditBody(e.target.value)}
                          className="flex-1 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 text-xs text-gray-900 dark:text-gray-100 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none resize-none min-h-0 font-sans"
                        />
                      </div>
                      
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl text-[10px] text-gray-500 space-y-1 font-medium">
                        <div className="font-bold text-gray-700 dark:text-gray-400 uppercase text-[8px] tracking-wider">Variables Admitidas:</div>
                        <div><code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{nombre}"}</code>: Nombre completo | <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{nombre_corto}"}</code> o <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{contacto}"}</code>: Primer nombre.</div>
                        <div><code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{empresa}"}</code>: Nombre completo | <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{"{empresa_corto}"}</code>: Nombre comercial.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-grow flex flex-col overflow-hidden">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase">Destinatario</Label>
                          <div className="flex gap-2">
                            <Input 
                              value={draftData?.email || ""} 
                              readOnly 
                              className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-medium cursor-default"
                            />
                            <button
                              onClick={async () => {
                                if (draftData?.email) {
                                  await navigator.clipboard.writeText(draftData.email);
                                  toast.success("Correo copiado");
                                }
                              }}
                              className="px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-xs font-bold rounded-lg transition-all whitespace-nowrap"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase">Asunto del correo</Label>
                        <div className="flex gap-2">
                          <Input 
                            value={draftData?.subject || ""} 
                            onChange={(e) => setDraftData(draftData ? { ...draftData, subject: e.target.value } : null)}
                            placeholder="Redacta el asunto..." 
                            className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800"
                            id="cliente-asunto"
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
                          {imageUrlCliente ? (
                            <img src={imageUrlCliente} className="h-10 w-10 object-cover rounded-lg border border-gray-250 dark:border-gray-700 shadow-sm" alt="Preview render cliente" />
                          ) : (
                            <div className="h-10 w-10 bg-gray-250 dark:bg-gray-800 rounded-lg flex items-center justify-center text-[10px] text-gray-400 font-bold border border-dashed border-gray-300 dark:border-gray-700">
                              S/R
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-bold text-gray-800 dark:text-gray-200">Render Personalizado</div>
                            <div className="text-[10px] text-gray-500">Se usará en esta pestaña sin sobreescribir Prospección</div>
                          </div>
                        </div>
                        <input 
                          type="file" 
                          id="render-image-upload-cliente" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUploadCliente}
                        />
                        <label 
                          htmlFor="render-image-upload-cliente" 
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold cursor-pointer transition-all border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1 shadow-sm"
                        >
                          {guardandoImagenCliente ? "Procesando..." : (imageUrlCliente ? "Reemplazar Render" : "Subir Render")}
                        </label>
                      </div>

                      <div className="space-y-1 flex-1 flex flex-col min-h-0">
                        <Label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase">Mensaje (Cuerpo)</Label>
                        <Textarea 
                          value={draftData?.body || ""}
                          onChange={(e: any) => setDraftData(draftData ? { ...draftData, body: e.target.value } : null)}
                          placeholder="Escribe el mensaje para el cliente aquí..." 
                          className="flex-1 resize-none bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800 font-mono text-sm leading-relaxed p-4 custom-scrollbar min-h-0"
                          id="cliente-cuerpo"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button 
                      onClick={() => onOpenChange(false)}
                      className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all text-xs"
                    >
                      DESCARTAR
                    </button>
                    {isEditingTemplateMode ? (
                      <button 
                        onClick={handleSaveTemplateChanges}
                        disabled={guardandoPlantilla}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md text-xs cursor-pointer flex items-center gap-2"
                      >
                        {guardandoPlantilla ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        GUARDAR PLANTILLA
                      </button>
                    ) : (
                      <button 
                        onClick={async () => {
                          const cuerpo = draftData?.body || "";
                          
                          if (!cuerpo) {
                            toast.error("El cuerpo del mensaje está vacío");
                            return;
                          }

                          try {
                            await navigator.clipboard.writeText(cuerpo);
                            toast.success("¡Cuerpo copiado al portapapeles!");
                          } catch (err) {
                            console.error("Error al copiar:", err);
                            toast.error("Error al copiar el cuerpo");
                          }
                        }}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md text-xs cursor-pointer"
                      >
                        COPIAR CUERPO
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
  );
}
