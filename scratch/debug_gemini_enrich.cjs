const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

async function run() {
  const companyName = "Simma";
  const prompt = `
Encuentra información pública oficial sobre la empresa "${companyName}".
Necesito:
1. Su sitio web oficial (URL completa, ej: www.empresa.cl).
2. Su teléfono central de contacto (o el principal si no está en Chile).
3. Determina si la empresa tiene presencia, representación comercial, oficina local o está operativa de forma directa en Chile (responde true o false).
4. Clasifica la empresa en uno de los siguientes segmentos comerciales según su giro principal (elige estrictamente una opción de esta lista):
   - "Automotoras": Concesionarias, venta de vehículos (autos, camiones, motos), repuestos y talleres.
   - "Salud": Clínicas privadas, centros médicos, centros dentales, laboratorios clínicos.
   - "Comercializadores": Empresas que venden productos físicos, distribuidores, retail, importadoras.
   - "Minería / Industria": Mineras, metalúrgicas, maestranzas, manufactura y fábricas industriales.
   - "Constructoras / Inmobiliarias": Constructoras de obras, desarrollo de proyectos inmobiliarios, arquitectura.
   - "Servicios": Consultoras, empresas de software/TI, empresas de seguridad, aseo, agencias.
   - "Logística / Transporte": Empresas de transporte de carga, navieras, bodegaje, distribución.
   - "Alimentos / Agrícola": Procesadoras de alimentos, packing, viñas, exportadoras agrícolas, cadenas gastronómicas.
5. Correos de contacto y nombres de personas a cargo en las áreas de Adquisiciones, Compras, Sustentabilidad, Finanzas o en su defecto, el correo general de contacto comercial.

Responde estrictamente en formato JSON válido, con la siguiente estructura:
{
  "web": "URL completa del sitio web o null",
  "telefono": "Teléfono formateado en lo posible como +56... o null",
  "presencia_chile": true o false,
  "segmento": "Escribe exactamente una de las 8 categorías del segmento anterior",
  "contactos": [
    {
      "nombre": "Nombre de la persona (deja null si es genérico o no se encuentra)",
      "correo": "correo electrónico corporativo de la persona o del área",
      "cargo": "Cargo o área de desempeño (ej: Compras, Adquisiciones, Sustentabilidad)"
    }
  ]
}
`;
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
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
        temperature: 0.2
      }
    });

    console.log("Success!");
    console.log(response.data?.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (e) {
    if (e.response) {
      console.error("Gemini API Error 400 Details:", JSON.stringify(e.response.data, null, 2));
    } else {
      console.error("Error:", e.message);
    }
  }
}

run();
