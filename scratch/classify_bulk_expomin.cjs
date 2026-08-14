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
  console.log("Fetching accounts with segment 'Expomin'...");
  const { data: accounts, error } = await supabase
    .from("cuentas")
    .select("id, cliente")
    .eq("segmento", "Expomin");

  if (error) {
    console.error("Error fetching accounts:", error);
    return;
  }

  console.log(`Found ${accounts.length} accounts to reclassify.`);
  if (accounts.length === 0) return;

  const batchSize = 25;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    console.log(`\n--- Processing batch ${i / batchSize + 1} / ${Math.ceil(accounts.length / batchSize)} ---`);

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
${batch.map(a => `ID: ${a.id} | Nombre: ${a.cliente}`).join("\n")}

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
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        tools: [
          {
            google_search: {}
          }
        ],
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
      const classifs = resultObj.clasificaciones || [];

      console.log(`Received classifications for ${classifs.length} companies.`);

      for (const item of classifs) {
        if (VALID_SEGMENTS.includes(item.segmento)) {
          console.log(`Updating "${item.nombre}" (${item.id}) -> Segmento: "${item.segmento}"`);
          const { error: updateErr } = await supabase
            .from("cuentas")
            .update({ segmento: item.segmento, origen: "AI" })
            .eq("id", item.id);

          if (updateErr) {
            console.error(`Failed to update ${item.id}:`, updateErr.message);
          }
        } else {
          console.warn(`Warning: Invalid segment "${item.segmento}" returned for ${item.nombre}`);
        }
      }
    } catch (e) {
      console.error("Error processing batch:", e.message || e);
    }
  }

  console.log("\nFinished bulk reclassification.");
}

run();
