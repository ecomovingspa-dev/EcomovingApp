import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './supabase-client.js';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    // 0. Sanitize Key (Remove quotes or spaces)
    const rawKey = process.env.BREVO_API_KEY || "";
    const BREVO_KEY_CLEAN = rawKey.trim().replace(/^['"]|['"]$/g, '');

    const keyPrefix = BREVO_KEY_CLEAN ? BREVO_KEY_CLEAN.substring(0, 5) : "NONE";
    console.log(`[DEBUG] Key Used: ${keyPrefix}... (Len: ${BREVO_KEY_CLEAN.length})`);

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

    const { messageId, targetEmail } = req.body;

    if (!messageId || !targetEmail) {
        return res.status(400).json({ error: 'Missing messageId or targetEmail' });
    }

    try {
        // --- STEP 0: Verify Brevo Connection & Auth ---
        try {
            await axios.get('https://api.brevo.com/v3/account', {
                headers: { 'api-key': BREVO_KEY_CLEAN }
            });
            console.log("[DEBUG] Auth Check Passed");
        } catch (authErr: any) {
            console.error("[DEBUG] Auth Check Failed:", authErr.response?.data);
            if (axios.isAxiosError(authErr) && authErr.response?.status === 401) {
                return res.status(401).json({
                    error: "Brevo Auth Failed: Invalid API Key. Please check Vercel Env Vars.",
                    details: authErr.response?.data
                });
            }
            // If other error, let logic continue or fail later
        }

        // 1. Fetch Message Logic
        let { data: messageData, error: msgError } = await supabase
            .from('marketing')
            .select('*')
            .eq('id', messageId)
            .single();

        if (msgError || !messageData) {
            return res.status(404).json({ error: "Message not found" });
        }

        // ... (Asset Prep)
        const bucketName = 'imagenes-marketing';
        let imageUrl = messageData.imagen_url;
        if (!imageUrl && messageData.nombre_imagen) {
            imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${messageData.nombre_imagen}`;
        }
        const logoUrl = `${supabaseUrl}/storage/v1/object/public/configuracion/logo.png`;

        let finalHtml = messageData.cuerpo_html || '';

        // --- LOGIC MEJORADA: LA IMAGEN ES OBLIGATORIA ---
        const isValidUrl = (url: string) => {
            try { return Boolean(new URL(url)); } catch (e) { return false; }
        };

        if (!imageUrl || !isValidUrl(imageUrl)) {
            // CRITICAL ERROR: Sin imagen no hay marketing válido.
            const expectedUrl = imageUrl || `(Vacío - bucket: ${bucketName}, file: ${messageData.nombre_imagen})`;
            return res.status(400).json({
                error: "Error Crítico de Imagen",
                details: `No se encontró una URL válida para la imagen. El envío fue cancelado para evitar correos rotos.`,
                debugUrl: expectedUrl
            });
        }

        // Si llegamos aqui, la URL es sintácticamente válida.
        // Opcional: Podríamos hacer un 'head' request rápido para ver si da 200 OK, pero puede ser lento.
        // Asumimos que si hay URL, intentamos usarla.

        finalHtml = finalHtml
            .replace(/IMAGE_PLACEHOLDER/g, imageUrl)
            .replace(/\{\{IMG_URL\}\}/g, imageUrl);

        const signatureHtml = `
      <br>
      <div style="text-align: center;">
        <small style="color:#999;">[Email de Prueba enviado desde el Panel de Control]</small>
      </div>
    `;
        finalHtml += signatureHtml;

        // 4. Send via Brevo
        const emailPayload = {
            sender: { name: "Ecomoving", email: "cobranza@ecomoving.cl" },
            to: [{ email: targetEmail }],
            subject: `[TEST] ${messageData.asunto}`,
            htmlContent: finalHtml,
            textContent: messageData.cuerpodetalle || "Vista de prueba HTML"
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
            headers: {
                'api-key': BREVO_KEY_CLEAN,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        return res.status(200).json({ success: true, message: "Test email sent successfully" });

    } catch (err: any) {
        console.error('Test Email Error:', err);
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
