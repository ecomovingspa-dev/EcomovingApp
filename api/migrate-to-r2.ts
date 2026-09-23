import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isR2Configured, uploadToR2 } from './_utils/r2.js';

// Endpoint interno de un solo uso: sube un archivo a una ruta (key) EXACTA de R2.
// A diferencia de /api/upload-render (que genera nombres de archivo), este
// respeta la carpeta/nombre indicados, para poder migrar contenido preservando
// su estructura de carpetas original.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Use POST.' });
  }

  try {
    const { image_base64, content_type, key } = req.body || {};

    if (!image_base64 || !key) {
      return res.status(400).json({ error: 'Faltan image_base64 o key en la solicitud' });
    }

    // key debe ser una ruta relativa segura (sin .. ni empezar con /)
    const safeKey = String(key).replace(/^\/+/, '');
    if (safeKey.includes('..') || !/^[a-zA-Z0-9_\-./]+$/.test(safeKey)) {
      return res.status(400).json({ error: 'key inválida' });
    }

    let mimeType = content_type || 'image/jpeg';
    let base64Data = image_base64;
    if (image_base64.startsWith('data:')) {
      const matches = image_base64.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = image_base64.split(',')[1] || image_base64;
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');

    if (!isR2Configured()) {
      return res.status(500).json({ error: 'Cloudflare R2 no está configurado' });
    }

    const r2Result = await uploadToR2(safeKey, buffer, mimeType);

    return res.status(200).json({ success: true, url: r2Result.url, key: r2Result.key });
  } catch (err: any) {
    console.error('[MIGRATE-TO-R2] Error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
