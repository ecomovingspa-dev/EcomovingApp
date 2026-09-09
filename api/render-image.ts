import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { contacto_id, id } = req.query;
  const targetId = (contacto_id || id) as string;

  if (!targetId) {
    return res.status(400).send('Falta id o contacto_id');
  }

  try {
    const { data: contacto, error } = await supabase
      .from('contactos')
      .select('id, imagen')
      .eq('id', targetId)
      .single();

    if (error || !contacto || !contacto.imagen) {
      return res.status(404).send('Imagen no encontrada');
    }

    const img = contacto.imagen;

    // Si ya es una URL HTTP(S) de Supabase Storage, redirigir
    if (img.startsWith('http://') || img.startsWith('https://')) {
      // Si apunta a este mismo endpoint, evitamos bucle infinito
      if (img.includes('/api/render-image')) {
        // Nada que hacer
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.redirect(302, img);
      }
    }

    // Si es Base64, servir los bytes directamente con las cabeceras adecuadas
    if (img.startsWith('data:')) {
      const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length.toString());
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).send(buffer);
      }
    }

    return res.status(400).send('Formato de imagen no reconocido');
  } catch (err: any) {
    console.error('[RENDER-IMAGE] Error:', err);
    return res.status(500).send('Error interno');
  }
}
