import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let r2Client: S3Client | null = null;

const DEFAULT_ACCOUNT_ID = '03e367d3871b20278a4334d39d82c0ef';
const DEFAULT_ACCESS_KEY_ID = 'b1c71b2729cbf533787c06f50a3f80b9';
const DEFAULT_SECRET_ACCESS_KEY = 'cc59a42be93f2eee30b7535bac891481db86c539da65dd4eda6bc8636d88c340';
const DEFAULT_BUCKET_NAME = 'renders-ecomoving';
const DEFAULT_PUBLIC_DOMAIN = 'pub-87fc17275b644a46b4c63c1ef06d4966.r2.dev';

export function isR2Configured(): boolean {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || DEFAULT_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || DEFAULT_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || DEFAULT_BUCKET_NAME;

  return !!(accountId && accessKeyId && secretAccessKey && bucketName);
}

export function getR2Client(): S3Client {
  if (!r2Client) {
    const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || DEFAULT_ACCOUNT_ID).trim();
    const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || DEFAULT_ACCESS_KEY_ID).trim();
    const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || DEFAULT_SECRET_ACCESS_KEY).trim();

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Variables de entorno de Cloudflare R2 no configuradas');
    }

    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return r2Client;
}

export async function uploadToR2(
  fileName: string,
  buffer: Buffer,
  contentType = 'image/jpeg'
): Promise<{ url: string; key: string }> {
  const client = getR2Client();
  const bucketName = (process.env.CLOUDFLARE_R2_BUCKET_NAME || DEFAULT_BUCKET_NAME).trim();
  const publicDomain = (process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || DEFAULT_PUBLIC_DOMAIN).trim();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await client.send(command);

  let url = '';
  if (publicDomain) {
    const cleanDomain = publicDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    url = `https://${cleanDomain}/${fileName}`;
  } else {
    // Si no se configuró dominio público, usar URL por defecto del bucket
    url = `https://${bucketName}.r2.cloudflarestorage.com/${fileName}`;
  }

  return { url, key: fileName };
}

