import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_utils/supabase-client.js';
import { isR2Configured, uploadToR2 } from './_utils/r2.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Use POST.' });
  }

  try {
    const supabase = getSupabase();
    const { contacto_id, image_base64, file_name, content_type, prefix } = req.body || {};

    if (!image_base64) {
      return res.status(400).json({ error: 'Falta image_base64 en la solicitud' });
    }

    // Extraer datos base64 y tipo de contenido
    let mimeType = content_type || 'image/jpeg';
    let base64Data = image_base64;

    if (image_base64.startsWith('data:')) {
      const matches = image_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = image_base64.split(',')[1] || image_base64;
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const safeContactoId = contacto_id ? String(contacto_id).replace(/[^a-zA-Z0-9_-]/g, '') : 'general';
    // Prefijo del archivo en R2 (contacto por defecto; 'cotizacion', 'marketing', etc.)
    const safePrefix = prefix ? String(prefix).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'contacto' : 'contacto';
    const uniqueFileName = safePrefix === 'contacto'
      ? `renders-contactos/contacto_${safeContactoId}_${timestamp}.${extension}`
      : `${safePrefix}/${safePrefix}_${timestamp}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

    let publicUrl = '';
    let storageEngine = 'supabase';

    // 1. Cloudflare R2 ($0 egress)
    if (isR2Configured()) {
      try {
        const r2Result = await uploadToR2(uniqueFileName, buffer, mimeType);
        publicUrl = r2Result.url;
        storageEngine = 'cloudflare-r2';
        console.log(`[UPLOAD-RENDER] Imagen subida exitosamente a Cloudflare R2: ${publicUrl}`);
      } catch (r2Err) {
        console.error('[UPLOAD-RENDER] Error subiendo a Cloudflare R2:', r2Err);
      }
    }

    // Solo Cloudflare R2: nunca Supabase Storage ni base64 (evita consumo de egress en Supabase)
    if (!publicUrl) {
      return res.status(500).json({ error: 'No se pudo subir la imagen a Cloudflare R2. Intenta nuevamente.' });
    }

    // 3. Guardar la URL pública en la tabla contactos
    if (contacto_id && safePrefix === 'contacto') {
      const { error: dbError } = await supabase
        .from('contactos')
        .update({ imagen: publicUrl })
        .eq('id', contacto_id);

      if (dbError) {
        console.error('[UPLOAD-RENDER] Error actualizando contacto:', dbError);
      }
    }

    return res.status(200).json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
      contentType: mimeType,
      storageEngine
    });

  } catch (err: any) {
    console.error('[UPLOAD-RENDER] Error general:', err);
    return res.status(500).json({ error: err.message || 'Error interno al procesar render' });
  }
}
