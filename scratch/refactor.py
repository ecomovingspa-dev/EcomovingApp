import re
import os

filepath = r"c:\Users\Mario\Desktop\Replit\React-Vite-Starter\client\src\pages\marketing\TrazabilidadBrevo.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace('from "@/components/ui/dialog";', 'from "@/components/ui/dialog";\nimport { Copy, Edit2, Loader2, Image as ImageIcon, Settings2 } from "lucide-react";')

# 2. State and helpers
state_target = """  // --- Estados de Plantillas ---
  const [templateFormName, setTemplateFormName] = useState("");
  const [templateFormSubject, setTemplateFormSubject] = useState("");
  const [templateFormBody, setTemplateFormBody] = useState("");"""

state_repl = """  // --- Estados de Plantillas ---
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
      /^(caja de compensación de asignación familiar|caja de compensación|ccaf)\\s+/gi,
      /^(compañía de|compañia de|corp\\.?|corporación|corporacion)\\s+/gi,
      /^(sociedad|asociación|asociacion|federación|federacion|fundación|fundacion)\\s+/gi,
      /^(distribuidora|importadora|exportadora|comercializadora)\\s+/gi,
      /^(servicios|consultoría|consultoria|asesorías|asesorias)\\s+/gi
    ];
    for (const regex of prefixesToRemove) {
      clean = clean.replace(regex, "");
    }
    clean = clean.replace(/,?\\s*(s\\.?a\\.?|spa|limitada|ltda\\.?|s\\.?a\\.?c\\.?|e\\.?i\\.?r\\.?l\\.?|chile|group|grupo|s\\.a\\.s\\.?)\\b/gi, "");
    clean = clean.replace(/^[ ,.\\t]+/, "").replace(/[,.\\s]+$/, "").trim();
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
        .replace(/{\\s*nombre\\s*}/gi, name)
        .replace(/{\\s*nombre_corto\\s*}/gi, firstName)
        .replace(/{\\s*contacto\\s*}/gi, firstName)
        .replace(/{\\s*empresa\\s*}/gi, finalCompany)
        .replace(/{\\s*empresa_corto\\s*}/gi, shortCompany)
        .replace(/{\\s*vendedor\\s*}/gi, vendedorName)
        .replace(/{\\s*telefono\\s*}/gi, telefonoVendedor);
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
          body: `${etapa.mensaje_intro || ""}\\n\\n${etapa.mensaje_cierre || ""}`.trim()
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
"""

content = content.replace(state_target, state_repl)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Part 1 Done.")
