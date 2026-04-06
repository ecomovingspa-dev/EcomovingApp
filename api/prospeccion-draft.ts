import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { callOllama } from './utils/ollama';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { contactoId } = req.body;

    if (!contactoId) {
        return res.status(400).json({ error: 'Falta contactoId en el body' });
    }

    try {
        // 1. Obtener datos del contacto y su cuenta
        const { data: contact, error: cErr } = await supabase
            .from('contactos')
            .select(`
                *,
                cuentas:cuentas!contactos_cuenta_id_fkey(cliente, sector, segmento)
            `)
            .eq('id', contactoId)
            .single();

        if (cErr || !contact) {
            console.error("Error recuperando contacto:", cErr);
            throw new Error("No pudimos encontrar al contacto especificado.");
        }

        // 2. Obtener la plantilla base de la etapa actual (usar etapa_envio)
        const etapaActual = parseInt(contact.etapa_envio) || 1;
        const { data: config } = await supabase
            .from('configuracion_prospeccion')
            .select('*')
            .eq('orden', etapaActual)
            .maybeSingle();

        const empresa = contact.cuentas?.cliente || "su organización";
        const sector = contact.cuentas?.sector || "su industria";
        const correo = contact.correo || "";
        const dominio = correo.split('@')[1] || "";

        // 3. Construir el prompt para Gemma 3
        const prompt = `
Eres un Experto en Desarrollo de Negocios para Ecomoving SpA (Chile).
Nuestra empresa es líder en soluciones de merchandising corporativo sustentable (mugs, termos, textiles con materiales reciclados).

TAREA: Generar una propuesta de correo de prospección para la empresa "${empresa}" (Rubro: ${sector}).
Es un contacto en frío y no conocemos su nombre, por lo que buscamos que nos deriven al encargado de Compras o Sustentabilidad.

REGLAS DE ORO:
- Idioma: Español de Chile (profesional, sin tuteo excesivo).
- Estructura: Breve (máximo 120 palabras).
- Tono: Consultivo, no desesperado por vender.
- Objetivo: Que respondan indicando quién es la persona a cargo.
- Usa variables si es necesario: {empresa}.

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido que contenga estas dos claves:
{
  "subject": "Asunto atractivo y corto",
  "body": "Cuerpo del mensaje completo, incluyendo el saludo y cierre"
}
`;

        // 4. Llamar a Ollama
        console.log(`🤖 Llamando a Gemma 3 para contacto: ${correo}`);
        const aiResponse = await callOllama(prompt);
        
        // 5. Parsear la respuesta
        let result = {
            subject: `Consulta para ${empresa} - Ecomoving SpA`,
            body: config?.mensaje_intro || "Error al generar contenido con IA."
        };

        try {
            // Limpiar posibles bloques markdown de la IA
            const cleanJson = aiResponse.replace(/```json\s?|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.subject) result.subject = parsed.subject;
            if (parsed.body) result.body = parsed.body;
        } catch (parseErr) {
            console.warn("⚠️ IA no devolvió JSON puro, usando respuesta como cuerpo.");
            result.body = aiResponse;
        }

        return res.status(200).json({
            success: true,
            draft: result,
            debug: {
                empresa,
                sector,
                etapa: etapaActual
            }
        });

    } catch (err: any) {
        console.error("Error en prospeccion-draft:", err);
        return res.status(500).json({ error: err.message });
    }
}
