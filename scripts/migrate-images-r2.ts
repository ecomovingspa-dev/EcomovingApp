import { createClient } from '@supabase/supabase-js';
import { uploadToR2 } from '../api/utils/r2.ts';

const supabase = createClient(
  'https://xgdmyjzyejjmwdqkufhp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E'
);

async function migrateAllBase64Images() {
  const { data: contacts } = await supabase
    .from('contactos')
    .select('id, nombre, imagen');

  for (const c of contacts || []) {
    if (c.imagen && c.imagen.startsWith('data:')) {
      try {
        const matches = c.imagen.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = mimeType.includes('png') ? 'png' : 'jpg';
          const fileName = `contacto_${c.id}_${Date.now()}.${ext}`;
          const r2Res = await uploadToR2(fileName, buffer, mimeType);
          console.log(`Uploaded to R2 for ${c.nombre}:`, r2Res.url);

          await supabase
            .from('contactos')
            .update({ imagen: r2Res.url })
            .eq('id', c.id);
          console.log(`Updated Supabase imagen to R2 URL for ${c.nombre}`);
        }
      } catch (err) {
        console.error(`Error migrating image for ${c.nombre}:`, err);
      }
    }
  }
}

migrateAllBase64Images();
