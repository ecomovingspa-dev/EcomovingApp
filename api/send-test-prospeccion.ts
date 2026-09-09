import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './supabase-client.js';
import axios from 'axios';

function generarHtmlProspeccion(params: { intro: string; cierre: string; empresa: string }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
    body { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; background-color: #f8fafc; margin: 0; padding: 0; }
    .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0; }
    .header { padding: 40px 40px 30px; text-align: left; }
    .logo { height: 32px; display: block; border: 0; }
    .content { padding: 0 40px 30px; font-size: 16px; color: #334155; }
    .cta { padding: 0 40px 40px; font-size: 16px; color: #475569; font-weight: 400; }
    .footer { background-color: #fafafa; border-top: 1px solid #f1f5f9; padding: 35px 40px; }
    .signature-title { font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 4px; }
    .signature-dept { color: #64748b; font-size: 12px; margin-bottom: 15px; }
    .logo-footer { height: 20px; opacity: 0.8; display: block; margin-top: 15px; border: 0; }
    .legal-text { font-size: 11px; color: #94a3b8; line-height: 1.5; margin-top: 15px; border-top: 1px dashed #e2e8f0; padding-top: 15px; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" alt="Ecomoving" class="logo" />
      </div>
      <div class="content">
        ${params.intro.replace(/\n/g, '<br>')}
      </div>
      <div class="cta">
        ${params.cierre.replace(/\n/g, '<br>')}
      </div>
      <div class="footer">
        <div class="signature-title">Equipo de Ventas</div>
        <div class="signature-dept">Ecomoving SpA</div>
        <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" alt="Ecomoving Logo" class="logo-footer" />
        <div class="legal-text">
          Este es un correo electrónico enviado de forma automática por Ecomoving SpA.<br>
          Para no recibir más correos de prospección, responda indicando "Darse de baja".
        </div>
      </div>
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
        const supabase = getSupabase();
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

        const dummyContacto = "Mario";

        const intro = (stage.mensaje_intro || "")
            .replace(/{empresa}/g, dummyEmpresa)
            .replace(/{correo}/g, dummyCorreo)
            .replace(/{dominio}/g, dummyDominio)
            .replace(/{contacto}/g, dummyContacto);

        const cierre = (stage.mensaje_cierre || "")
            .replace(/{empresa}/g, dummyEmpresa)
            .replace(/{correo}/g, dummyCorreo)
            .replace(/{dominio}/g, dummyDominio)
            .replace(/{contacto}/g, dummyContacto);

        const subject = (stage.asunto_template || "")
            .replace(/{empresa}/g, dummyEmpresa)
            .replace(/{correo}/g, dummyCorreo)
            .replace(/{contacto}/g, dummyContacto);

        const htmlContent = generarHtmlProspeccion({ intro, cierre, empresa: dummyEmpresa });

        // 3. Send via Brevo
        const emailPayload = {
            sender: { name: "Ecomoving", email: "cobranza@ecomoving.cl" },
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
