import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './supabase-client.js';
import { isR2Configured, uploadToR2 } from './utils/r2';

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
    const { contacto_id, image_base64, file_name, content_type } = req.body || {};

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
    const uniqueFileName = `contacto_${safeContactoId}_${timestamp}.${extension}`;

    let publicUrl = '';
    let storageEngine = 'supabase';

    // 1. Prioridad: Cloudflare R2 ($0 Egress ilimitado) si está configurado
    if (isR2Configured()) {
      try {
        const r2Result = await uploadToR2(uniqueFileName, buffer, mimeType);
        publicUrl = r2Result.url;
        storageEngine = 'cloudflare-r2';
        console.log(`[UPLOAD-RENDER] Imagen subida exitosamente a Cloudflare R2: ${publicUrl}`);
      } catch (r2Err) {
        console.error('[UPLOAD-RENDER] Error subiendo a Cloudflare R2, recurriendo a Supabase:', r2Err);
      }
    }

    // 2. Fallback: Supabase Storage
    if (!publicUrl) {
      const targetBuckets = ['renders_prospeccion', 'imagenes-marketing', 'logo_ecomoving', 'renders'];
      let uploadedBucket = '';
      let uploadedPath = '';

      for (const bucket of targetBuckets) {
        const filePath = bucket === 'renders_prospeccion' || bucket === 'renders' 
          ? uniqueFileName 
          : `renders_prospeccion/${uniqueFileName}`;

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, buffer, {
            contentType: mimeType,
            cacheControl: '31536000, public',
            upsert: true
          });

        if (!error && data) {
          uploadedBucket = bucket;
          uploadedPath = filePath;
          break;
        }
      }

      if (uploadedBucket && uploadedPath) {
        const { data: pubData } = supabase.storage.from(uploadedBucket).getPublicUrl(uploadedPath);
        publicUrl = pubData.publicUrl;
        storageEngine = `supabase-${uploadedBucket}`;
      } else {
        // Proxy URL
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host || 'ecomoving-app.vercel.app';
        publicUrl = `${protocol}://${host}/api/render-image?contacto_id=${safeContactoId}&v=${timestamp}`;
        storageEngine = 'api-proxy';
      }
    }

    // 3. Guardar la URL pública en la tabla contactos
    if (contacto_id) {
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
