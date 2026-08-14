const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

const VALID_SEGMENTS = [
  "Servicios",
  "Mineras",
  "Educación",
  "Comercializadores",
  "Alimentos / Agrícola",
  "Corporación",
  "Salud",
  "Gran Empresa",
  "Municipalidad",
  "Servicios Públicos",
  "Gobierno Central",
  "Laboratorios",
  "Comercial/Industrial - Shell Chile",
  "Pequeña Empresa",
  "Caja de Compensación",
  "Minería / Industria"
];

async function run() {
  console.log("Fetching test accounts...");
  const { data: accounts, error } = await supabase
    .from("cuentas")
    .select("id, cliente")
    .eq("segmento", "Expomin")
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  // Also include Pretec to verify
  const { data: pretec } = await supabase
    .from("cuentas")
    .select("id, cliente")
    .ilike("cliente", "%pretec%")
    .limit(1);

  if (pretec && pretec.length > 0 && !accounts.some(a => a.id === pretec[0].id)) {
    accounts.push(pretec[0]);
  }

  console.log("Test accounts:", accounts);

  const prompt = `
Clasifica cada una de las siguientes empresas chilenas/internacionales en su rubro o segmento comercial principal.
Debes elegir estrictamente una categoría de esta lista oficial de segmentos para cada empresa:
${VALID_SEGMENTS.map(s => `- "${s}"`).join("\n")}

Criterios de guía:
- "Mineras": Solo para compañías mineras mandantes/dueñas de faenas (ej. BHP, Codelco, Anglo American, Collahuasi, Antofagasta Minerals).
- "Minería / Industria": Proveedores de servicios industriales, repuestos, calderas, automatización, ingeniería industrial, metalúrgicas, maestranzas (ej. Pretec, Tmc Transformers, Veto, Leis, Fitflow, Indelta).
- "Servicios": Consultoras, empresas de TI/software, agencias, seguridad, aseo.
- "Comercializadores": Empresas distribuidoras de productos físicos de consumo masivo, retail.
- "Alimentos / Agrícola": Empresas del sector alimenticio, agrícolas, viñas, exportadoras de fruta.

Empresas a clasificar:
${accounts.map(a => `ID: ${a.id} | Nombre: ${a.cliente}`).join("\n")}

Responde estrictamente en formato JSON plano con la siguiente estructura:
{
  "clasificaciones": [
    {
      "id": "ID de la empresa",
      "nombre": "Nombre de la empresa",
      "segmento": "Nombre exacto de la categoría seleccionada"
    }
  ]
}
`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.1
      }
    });

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(json)?/i, "");
      cleaned = cleaned.replace(/```$/, "");
    }
    const resultObj = JSON.parse(cleaned.trim());
    console.log("Classifications result:", JSON.stringify(resultObj, null, 2));
  } catch (e) {
    console.error("Error details:", e.response ? e.response.data : e.message);
  }
}

run();
