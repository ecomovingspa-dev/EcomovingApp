import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './utils/supabase';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    const rawKey = process.env.BREVO_API_KEY || "";
    const BREVO_KEY_CLEAN = rawKey.trim().replace(/^['"]|['"]$/g, '');

    if (!BREVO_KEY_CLEAN) {
        return res.status(500).json({ error: "Config Error: BREVO_API_KEY is MISSING in Vercel." });
    }

    // CORS Headers
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

    const { email, subject, body, vendedorEmail } = req.body;

    if (!email || !subject || !body) {
        return res.status(400).json({ error: 'Missing email, subject, or body' });
    }

    try {
        const senderName = "Ecomoving SpA";
        const senderEmail = "cobranza@ecomoving.cl";

        // Preparamos los destinatarios (con copia oculta BCC al vendedor si está disponible)
        const emailPayload: any = {
            sender: { name: senderName, email: senderEmail },
            to: [{ email: email }],
            subject: subject,
            // Convertimos saltos de línea a HTML para que mantenga el formato en el correo
            htmlContent: `
                <html>
                <body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">
                    ${body.replace(/\n/g, '<br>')}
                </body>
                </html>
            `,
            textContent: body
        };

        // Si tenemos el correo del vendedor, enviamos una copia oculta (BCC) para confirmación nativa
        if (vendedorEmail && vendedorEmail.includes('@')) {
            emailPayload.bcc = [{ email: vendedorEmail }];
        }

        const brevoRes = await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
            headers: {
                'api-key': BREVO_KEY_CLEAN,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        const messageId = brevoRes.data?.messageId || `manual:${Date.now()}`;

        return res.status(200).json({ success: true, messageId });
    } catch (err: any) {
        console.error('Send Cortesia Email Error:', err);
        if (axios.isAxiosError(err)) {
            return res.status(err.response?.status || 500).json({
                error: "Upstream Error from Brevo (Send Step)",
                details: err.response?.data
            });
        }
        return res.status(500).json({ error: err.message });
    }
}
