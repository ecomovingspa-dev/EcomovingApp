// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const transparentGif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', transparentGif.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        res.status(200).send(transparentGif);
        return;
    }

    const { contacto_id, template_id } = req.query || {};
    const referer = (req.headers.referer || req.headers.referrer || '').toLowerCase();
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    
    const isSelfComposer = referer.includes('zoho.com/mail') || referer.includes('zoho.cl/mail');
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

    if (contacto_id && typeof contacto_id === 'string' && !isSelfComposer && !isAutomatedBot) {
        try {
            const { data: contacto, error: contactError } = await supabase
                .from('contactos')
                .select('id, correo, nombre, ultimo_evento_trazabilidad, ultimo_estado_brevo')
                .eq('id', contacto_id)
                .single();

            if (!contactError && contacto && contacto.correo) {
                const now = new Date();
                const localDate = now.toISOString().split('T')[0];
                const templateSuffix = (template_id && typeof template_id === 'string' && template_id.trim()) ? `${template_id.trim()}:` : 'unknown:';
                const uniqueMsgId = `manual_open:${contacto_id}:${templateSuffix}${now.getTime()}`;

                await supabase.from('trazabilidad_correos').insert({
                    contacto_id: contacto.id,
                    email: contacto.correo.toLowerCase(),
                    fecha: localDate,
                    estado: 'opened',
                    mensaje_id: uniqueMsgId
                });

                await supabase.from('contactos').update({
                    ultimo_estado_brevo: 'opened',
                    ultimo_evento_trazabilidad: now.toISOString()
                }).eq('id', contacto_id);
            }
        } catch (err) {
            console.error('[SENTINEL-PIXEL] Error:', err);
        }
    }

    return res.status(200).send(transparentGif);
}
