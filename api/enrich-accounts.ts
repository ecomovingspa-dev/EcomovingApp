import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './utils/supabase';
import axios from 'axios';

// Sanitización de la API Key de Gemini
const rawApiKey = process.env.VITE_GEMINI_API_KEY || "AIzaSyC7bM_4Fr_Z2DDFMhZPqCTnA7oQLrKBV2I";
const GEMINI_API_KEY = rawApiKey.replace(/['"]/g, "").trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { cuentaId, mode } = req.body;

    if (!cuentaId) {
        return res.status(400).json({ error: 'Se requiere cuentaId' });
    }

    try {
        // Obtener la cuenta
        const { data: account, error: accountError } = await supabase
            .from('cuentas')
            .select('*')
            .eq('id', cuentaId)
            .single();

        if (accountError || !account) {
            return res.status(404).json({ error: `No se encontró la cuenta con ID: ${cuentaId}` });
        }

        const companyName = account.cliente;
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        if (mode === 'similar') {
            // BUSCAR EMPRESAS SIMILARES Y RETORNARLAS (SIN INSERTAR)
            console.log(`🤖 Buscando 5 empresas competidoras/similares a "${companyName}" en Chile...`);
            const sector = account.sector || 'privado';
            const segmento = account.segmento || 'Servicios';
            const prompt = `
Encuentra 5 empresas competidoras directas o muy similares a "${companyName}" que operen en Chile.
El sector es "${sector}" y el segmento es "${segmento}".

Responde estrictamente en formato JSON válido, con la siguiente estructura exacta:
{
  "similares": [
    {
      "cliente": "Nombre oficial de la empresa competidora",
      "web": "URL completa del sitio web oficial de la empresa o null",
      "ciudad": "Ciudad de su casa matriz en Chile o null"
    }
  ]
}
`;
            const response = await axios.post(geminiUrl, {
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.3 }
            });

            const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            let cleaned = rawText.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "");
            }
            const data = JSON.parse(cleaned.trim());
            return res.status(200).json({ success: true, mode: 'similar', data });

        } else {
            // ENRIQUECER DATOS BASICOS DE LA CUENTA Y RETORNARLOS (SIN GUARDAR)
            console.log(`🤖 Enriqueciendo datos básicos para "${companyName}"...`);
            const prompt = `
Encuentra información pública oficial sobre la empresa "${companyName}".
Necesito:
1. Su sitio web oficial (URL completa, ej: www.empresa.cl).
2. Su teléfono central de contacto o principal.
3. Su ciudad de casa matriz o sucursal principal en Chile.
4. Clasifica la empresa en uno de los siguientes segmentos comerciales según su giro principal (elige estrictamente una opción de esta lista):
   - "Automotoras"
   - "Salud"
   - "Comercializadores"
   - "Minería / Industria"
   - "Constructoras / Inmobiliarias"
   - "Servicios"
   - "Logística / Transporte"
   - "Alimentos / Agrícola"

Responde estrictamente en formato JSON válido, con la siguiente estructura exacta:
{
  "web": "URL completa del sitio web o null",
  "telefono": "Teléfono corporativo o null",
  "ciudad": "Ciudad principal en Chile o null",
  "segmento": "Escribe exactamente una de las 8 categorías mencionadas"
}
`;
            const response = await axios.post(geminiUrl, {
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.2 }
            });

            const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            let cleaned = rawText.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "");
            }
            const data = JSON.parse(cleaned.trim());
            return res.status(200).json({ success: true, mode: 'basic', data });
        }

    } catch (err: any) {
        console.error("Error en enrich-accounts:", err);
        const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        return res.status(500).json({ error: errMsg });
    }
}
