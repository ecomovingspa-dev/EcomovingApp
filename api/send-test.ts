import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BREVO_API_KEY = process.env.BREVO_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Debug Key Presence & Prefix
    const keyPrefix = BREVO_API_KEY ? BREVO_API_KEY.substring(0, 5) : "NONE";
    const keyStatus = !BREVO_API_KEY ? "MISSING" : `PRESENT (Start: ${keyPrefix}...)`;

    console.log(`[DEBUG] Brevo Key Status: ${keyStatus}`);

    if (!BREVO_API_KEY || BREVO_API_KEY.trim() === '') {
        return res.status(500).json({ error: `Config Error: Key is MISSING. Status: ${keyStatus}` });
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

    const { messageId, targetEmail } = req.body;

    if (!messageId || !targetEmail) {
        return res.status(400).json({ error: 'Missing messageId or targetEmail' });
    }

    try {
        // 1. Fetch Message Logic (Factory Logic)
        let { data: messageData, error: msgError } = await supabase
            .from('marketing')
            .select('*')
            .eq('id', messageId)
            .single();

        if (msgError || !messageData) {
            return res.status(404).json({ error: "Message not found" });
        }

        // 2. Prepare Assets
        const bucketName = 'imagenes-marketing';
        let imageUrl = messageData.imagen_url;

        // Fallback if manual URL is missing
        if (!imageUrl && messageData.nombre_imagen) {
            imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${messageData.nombre_imagen}`;
        }

        const logoUrl = `${supabaseUrl}/storage/v1/object/public/configuracion/logo.png`;

        // 3. Build HTML
        let finalHtml = messageData.cuerpo_html || '';
        if (imageUrl) {
            finalHtml = finalHtml.replace('IMAGE_PLACEHOLDER', imageUrl);
        }

        const signatureHtml = `
      <br><br>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
      <div style="font-family: Arial, sans-serif; color: #666;">
        <img src="${logoUrl}" alt="Ecomoving Logo" style="width:150px; margin-bottom:10px;"><br>
        <strong>Equipo Ecomoving</strong><br>
        <a href="https://www.ecomoving.cl" style="color: #007bff; text-decoration: none;">www.ecomoving.cl</a>
      </div>
      <br>
      <small style="color:#999;">[Email de Prueba enviado desde el Panel de Control]</small>
    `;
        finalHtml += signatureHtml;

        // 4. Send via Brevo
        const emailPayload = {
            sender: { name: "Ecomoving (Prueba)", email: "ventas@ecomoving.cl" },
            to: [{ email: targetEmail }],
            subject: `[TEST] ${messageData.asunto}`,
            htmlContent: finalHtml,
            textContent: messageData.cuerpodetalle || "Vista de prueba HTML"
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
            headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        return res.status(200).json({ success: true, message: "Test email sent successfully" });

    } catch (err: any) {
        console.error('Test Email Error:', err);

        // Extract detailed Axios error info if available
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const data = err.response?.data;
            console.error('Upstream Error Details:', { status, data });
            return res.status(status || 500).json({
                error: "Upstream Error from Brevo",
                details: data,
                status: status
            });
        }

        return res.status(500).json({ error: err.message, stack: err.stack });
    }
}
