
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase autocontenido para evitar fallos de resolución de módulos ESM en Vercel y servidor local
const DEFAULT_SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Transparent GIF 1x1 pixels
const transparentGif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Configurar cabeceras de respuesta para el GIF (siempre se retorna un GIF)
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', transparentGif.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        res.status(200).send(transparentGif);
        return;
    }

    const { contacto_id, template_id } = req.query;
    const referer = (req.headers.referer || req.headers.referrer || '').toLowerCase();
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    
    // Si la petición proviene de la ventana de redacción de Zoho Mail (remitente tipeando el correo), omitir
    const isSelfComposer = referer.includes('zoho.com/mail') || referer.includes('zoho.cl/mail');

    // Detectar herramientas automáticas de scraping y bots (curl, wget, scripts)
    // Nota: NUNCA marcar GoogleImageProxy ni proxies legítimos de webmails como bots
    const isGoogleProxy = userAgent.includes('googleimageproxy') || userAgent.includes('ggpht.com');
    const isAutomatedBot = !isGoogleProxy && (
        userAgent.includes('bingpreview') || 
        userAgent.includes('http-client') || 
        userAgent.includes('curl') || 
        userAgent.includes('wget') ||
        userAgent.includes('headless') ||
        userAgent.includes('spider') ||
        (userAgent.includes('bot') && !userAgent.includes('google'))
    );

    if (isAutomatedBot) {
        console.log(`[SENTINEL-PIXEL] Petición omitida (Bot detectado): ID=${contacto_id}, User-Agent=${userAgent}`);
    }

    if (contacto_id && typeof contacto_id === 'string' && !isSelfComposer && !isAutomatedBot) {
        try {
            // 1. Obtener los datos del contacto
            const { data: contacto, error: contactError } = await supabase
                .from('contactos')
                .select('id, correo, nombre, ultimo_evento_trazabilidad, ultimo_estado_brevo')
                .eq('id', contacto_id)
                .single();

            if (!contactError && contacto && contacto.correo) {
                // Filtro temporal mínimo de 2 segundos para evitar pre-renders instantáneos al pegar en composer
                if (contacto.ultimo_evento_trazabilidad && contacto.ultimo_estado_brevo !== 'opened') {
                    const sendTime = new Date(contacto.ultimo_evento_trazabilidad).getTime();
                    const nowTime = new Date().getTime();
                    const diffSeconds = Math.abs(nowTime - sendTime) / 1000;
                    
                    if (diffSeconds < 2 && isSelfComposer) {
                        console.log(`[SENTINEL-PIXEL] Petición ignorada: Demasiado cercana al envío manual (${Math.round(diffSeconds)}s) en composer.`);
                        return res.status(200).send(transparentGif);
                    }
                }

                const now = new Date();
                const localDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
                const templateSuffix = (template_id && typeof template_id === 'string' && template_id.trim()) ? `${template_id.trim()}:` : 'unknown:';
                const uniqueMsgId = `manual_open:${contacto_id}:${templateSuffix}${now.getTime()}`;

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

                console.log(`[SENTINEL-PIXEL] Apertura registrada exitosamente para: ${contacto.correo} (${contacto_id}) - Template: ${template_id || 'N/A'}`);
            } else {
                console.error(`[SENTINEL-PIXEL] Contacto no encontrado o no tiene correo. ID: ${contacto_id}`, contactError);
            }
        } catch (err) {
            console.error('[SENTINEL-PIXEL] Error en la base de datos:', err);
        }
    } else {
        console.warn(`[SENTINEL-PIXEL] Petición no registrada. ID: ${contacto_id}, Referer: ${referer}, Bot: ${isAutomatedBot}`);
    }

    return res.status(200).send(transparentGif);
}
