import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 es compatible con la API de S3.
// Docs: https://developers.cloudflare.com/r2/api/s3/api/

const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
// Dominio público (custom domain o r2.dev) usado para armar la URL final del archivo
const PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || '';

let r2Client: S3Client | null = null;

const getR2Client = (): S3Client => {
    if (!r2Client) {
        r2Client = new S3Client({
            region: 'auto',
            endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: ACCESS_KEY_ID,
                secretAccessKey: SECRET_ACCESS_KEY,
            },
        });
    }
    return r2Client;
};

/**
 * Verifica si todas las variables de entorno necesarias para usar R2 están configuradas.
 */
export const isR2Configured = (): boolean => {
    return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET_NAME && PUBLIC_DOMAIN);
};

/**
 * Sube un buffer a Cloudflare R2 y devuelve la URL pública del archivo.
 */
export const uploadToR2 = async (
    fileName: string,
    buffer: Buffer,
    contentType: string
): Promise<{ url: string; key: string }> => {
    if (!isR2Configured()) {
        throw new Error('Cloudflare R2 no está configurado (faltan variables de entorno).');
    }

    const client = getR2Client();

    await client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
        })
    );

    const cleanDomain = PUBLIC_DOMAIN.replace(/\/+$/, '');
    const url = `${cleanDomain}/${fileName}`;

    return { url, key: fileName };
};
