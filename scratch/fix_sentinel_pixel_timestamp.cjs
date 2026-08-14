const fs = require('fs');

const cuentasPath = 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/client/src/pages/cuentas/CuentasPage.tsx';
let cuentasContent = fs.readFileSync(cuentasPath, 'utf8');

// Normalize line endings
cuentasContent = cuentasContent.replace(/\r\n/g, '\n');

// Replace the RLS-failing block in CuentasPage.tsx with RLS-safe update of ultimo_evento_trazabilidad
const oldCopyBlock = `                        // 3. Marcar en base de datos que se envió una cortesía (para trazabilidad opcional)
                        await supabase.from('contactos').update({
                          ultimo_envio: new Date().toISOString()
                        }).eq('id', selectedContactoDraft.id);

                        // Registrar un evento 'sent' con precisión timestamptz en la tabla trazabilidad_correos
                        await supabase.from('trazabilidad_correos').insert({
                          contacto_id: selectedContactoDraft.id,
                          email: selectedContactoDraft.correo.toLowerCase(),
                          fecha: new Date().toISOString().split('T')[0],
                          estado: 'sent',
                          mensaje_id: \`manual_send:\${selectedContactoDraft.id}:\${new Date().getTime()}\`
                        });`;

const newCopyBlock = `                        // 3. Marcar en base de datos que se envió una cortesía (para trazabilidad opcional)
                        // Guardamos la hora exacta con precisión de milisegundos en ultimo_evento_trazabilidad
                        // para que el píxel de rastreo pueda calcular los 120 segundos de gracia y evitar el composer de Zoho.
                        await supabase.from('contactos').update({
                          ultimo_envio: new Date().toISOString(),
                          ultimo_evento_trazabilidad: new Date().toISOString()
                        }).eq('id', selectedContactoDraft.id);`;

if (cuentasContent.includes(oldCopyBlock)) {
  cuentasContent = cuentasContent.replace(oldCopyBlock, newCopyBlock);
  console.log("Successfully updated CuentasPage.tsx to use RLS-safe update!");
} else {
  console.error("Could not find old copy block in CuentasPage.tsx!");
}

fs.writeFileSync(cuentasPath, cuentasContent, 'utf8');

// Now rewrite api/sentinel-pixel.ts to check contacts.ultimo_evento_trazabilidad
const pixelPath = 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/api/sentinel-pixel.ts';
const newPixelCode = `import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client with Service Role Key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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

    const { contacto_id } = req.query;
    const referer = (req.headers.referer || req.headers.referrer || '').toLowerCase();
    
    // Si la petición proviene de Zoho Mail (remitente redactando/viendo correos) o de la propia app, no registrar evento
    const isSelfOrSender = referer.includes('zoho.com') || 
                           referer.includes('zoho.cl') || 
                           referer.includes('localhost') || 
                           referer.includes('ecomoving');

    if (contacto_id && typeof contacto_id === 'string' && !isSelfOrSender) {
        try {
            // 1. Obtener los datos del contacto y su marca temporal de copia/envío manual (ultimo_evento_trazabilidad)
            const { data: contacto, error: contactError } = await supabase
                .from('contactos')
                .select('id, correo, nombre, ultimo_evento_trazabilidad, ultimo_estado_brevo')
                .eq('id', contacto_id)
                .single();

            if (!contactError && contacto && contacto.correo) {
                // Filtro temporal: si la petición llega en menos de 120 segundos (2 minutos)
                // desde que se copió/envió el correo en la CRM (ultimo_evento_trazabilidad),
                // la ignoramos para evitar los prefetchings del servidor de Zoho o del antivirus.
                // NOTA: Solo aplicamos el bloqueo si el contacto NO estaba previamente marcado como "opened",
                // para evitar bloquear aperturas reales rápidas posteriores, aunque 120s es un margen muy seguro.
                if (contacto.ultimo_evento_trazabilidad && contacto.ultimo_estado_brevo !== 'opened') {
                    const sendTime = new Date(contacto.ultimo_evento_trazabilidad).getTime();
                    const nowTime = new Date().getTime();
                    const diffSeconds = Math.abs(nowTime - sendTime) / 1000;
                    
                    if (diffSeconds < 120) {
                        console.log(\`[SENTINEL-PIXEL] Petición ignorada: Demasiado cercana al envío manual (\${Math.round(diffSeconds)}s). Posible prefetch/composer.\`);
                        return res.status(200).send(transparentGif);
                    }
                }

                const now = new Date();
                const localDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
                const uniqueMsgId = \`manual_open:\${contacto_id}:\${now.getTime()}\`;

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

                console.log(\`[SENTINEL-PIXEL] Apertura registrada para: \${contacto.correo} (\${contacto_id})\`);
            } else {
                console.error(\`[SENTINEL-PIXEL] Contacto no encontrado o no tiene correo. ID: \${contacto_id}\`, contactError);
            }
        } catch (err) {
            console.error('[SENTINEL-PIXEL] Error en la base de datos:', err);
        }
    } else {
        console.warn(\`[SENTINEL-PIXEL] Petición omitida de registrar. ID: \${contacto_id}, Referer: \${referer}\`);
    }

    return res.status(200).send(transparentGif);
}
`;

fs.writeFileSync(pixelPath, newPixelCode, 'utf8');
console.log("Successfully rewrote api/sentinel-pixel.ts to check ultimo_evento_trazabilidad!");
