import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client with Service Role Key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { contacto_id } = req.query;
    const referer = (req.headers.referer || req.headers.referrer || '').toLowerCase();
    
    // Si la petición proviene de Zoho Mail (remitente redactando/viendo correos) o de la propia app, no registrar evento
    const isSelfOrSender = referer.includes('zoho.com') || 
                           referer.includes('zoho.cl') || 
                           referer.includes('localhost') || 
                           referer.includes('ecomoving');

    if (contacto_id && typeof contacto_id === 'string' && !isSelfOrSender) {
        try {
            // 1. Obtener los datos del contacto
            const { data: contacto, error: contactError } = await supabase
                .from('contactos')
                .select('id, correo, nombre')
                .eq('id', contacto_id)
                .single();

            if (!contactError && contacto && contacto.correo) {
                const now = new Date();
                const localDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
                const uniqueMsgId = `manual_open:${contacto_id}:${now.getTime()}`;

                // 2. Registrar en la tabla trazabilidad_correos
                await supabase.from('trazabilidad_correos').insert({
                    contacto_id: contacto.id,
                    email: contacto.correo.toLowerCase(),
                    fecha: localDate,
                    estado: 'opened',
                    mensaje_id: uniqueMsgId
                });

                // 3. Actualizar estado y fecha de la última apertura del contacto
                await supabase.from('contactos').update({
                    ultimo_estado_brevo: 'opened',
                    ultimo_evento_trazabilidad: now.toISOString()
                }).eq('id', contacto_id);

                console.log(`[SENTINEL-PIXEL] Apertura registrada para: ${contacto.correo} (${contacto_id})`);
            } else {
                console.error(`[SENTINEL-PIXEL] Contacto no encontrado o no tiene correo. ID: ${contacto_id}`, contactError);
            }
        } catch (err) {
            console.error('[SENTINEL-PIXEL] Error en la base de datos:', err);
        }
    } else {
        console.warn('[SENTINEL-PIXEL] Petición recibida sin contacto_id válido.');
    }

    // 4. Retornar imagen GIF transparente de 1x1 píxeles
    const transparentGif = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', transparentGif.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).send(transparentGif);
}
