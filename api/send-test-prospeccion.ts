import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function generarHtmlProspeccion(params: { intro: string; cierre: string; empresa: string }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; color: #1e293b; line-height: 1.6; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .content { font-size: 16px; margin-bottom: 25px; color: #334155; }
    .cta { font-size: 16px; color: #475569; margin-bottom: 30px; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">${params.intro.replace(/\n/g, '<br>')}</div>
    <div class="cta">${params.cierre.replace(/\n/g, '<br>')}</div>
    <div class="footer">
      <strong>Equipo Ecomoving SpA</strong><br>
      Santiago, Chile
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Sanitize Key (Remove quotes or spaces)
    const rawKey = process.env.BREVO_API_KEY || "";
    const BREVO_KEY_CLEAN = rawKey.trim().replace(/^['"]|['"]$/g, '');

    if (!BREVO_KEY_CLEAN) {
        return res.status(500).json({ error: "Config Error: BREVO_API_KEY is MISSING in Vercel." });
    }

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

    const { email, etapaId } = req.body;

    if (!email || !etapaId) {
        return res.status(400).json({ error: 'Missing email or etapaId' });
    }

    try {
        // 1. Fetch Stage Template
        const { data: stage, error: err } = await supabase
            .from('configuracion_prospeccion')
            .select('*')
            .eq('id', etapaId)
            .single();

        if (err || !stage) {
            return res.status(404).json({ error: "Etapa de prospección no encontrada" });
        }

        // 2. Format Variables
        const dummyEmpresa = "Empresa Ejemplo S.A.";
        const dummyCorreo = email;
        const dummyDominio = email.split('@')[1] || "ejemplo.cl";

        const intro = (stage.mensaje_intro || "")
            .replace(/{empresa}/g, dummyEmpresa)
            .replace(/{correo}/g, dummyCorreo)
            .replace(/{dominio}/g, dummyDominio);

        const cierre = (stage.mensaje_cierre || "")
            .replace(/{empresa}/g, dummyEmpresa)
            .replace(/{correo}/g, dummyCorreo)
            .replace(/{dominio}/g, dummyDominio);

        const subject = (stage.asunto_template || "")
            .replace(/{empresa}/g, dummyEmpresa)
            .replace(/{correo}/g, dummyCorreo);

        const htmlContent = generarHtmlProspeccion({ intro, cierre, empresa: dummyEmpresa });

        // 3. Send via Brevo
        const emailPayload = {
            sender: { name: "Ecomoving", email: "ventas@ecomoving.cl" },
            to: [{ email: email }],
            subject: `[TEST PROSPECCIÓN] ${subject}`,
            htmlContent: htmlContent,
            textContent: `${intro}\n\n${cierre}`
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
            headers: {
                'api-key': BREVO_KEY_CLEAN,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        return res.status(200).json({ success: true, message: "Correo de prueba enviado correctamente" });

    } catch (err: any) {
        console.error('Test Prospeccion Email Error:', err);
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const data = err.response?.data;
            return res.status(status || 500).json({
                error: "Upstream Error from Brevo (Send Step)",
                details: data,
                status: status
            });
        }
        return res.status(500).json({ error: err.message });
    }
}
