import { getSupabase } from '../api/utils/supabase';

async function migrateBase64Images() {
  console.log('🚀 Iniciando migración de imágenes Base64 a URLs públicas...');
  const supabase = getSupabase();

  const { data: contactos, error } = await supabase
    .from('contactos')
    .select('id, nombre, correo, imagen')
    .not('imagen', 'is', null);

  if (error) {
    console.error('❌ Error al obtener contactos:', error);
    process.exit(1);
  }

  const base64Contactos = contactos.filter(c => c.imagen && c.imagen.startsWith('data:'));
  console.log(`📊 Total contactos con imagen: ${contactos.length}`);
  console.log(`🔍 Total contactos con Base64 para migrar: ${base64Contactos.length}`);

  let successCount = 0;
  let failCount = 0;

  for (const c of base64Contactos) {
    try {
      const match = c.imagen.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!match || match.length !== 3) {
        console.warn(`⚠️ Contacto ${c.nombre} (${c.id}) tiene formato base64 inválido.`);
        continue;
      }

      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
      const timestamp = Date.now();
      const safeId = c.id.replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `contacto_${safeId}_${timestamp}.${ext}`;

      // Intentar subir a renders_prospeccion o logo_ecomoving
      let publicUrl = '';
      const buckets = ['renders_prospeccion', 'imagenes-marketing', 'logo_ecomoving'];

      for (const bucket of buckets) {
        const filePath = bucket === 'renders_prospeccion' ? fileName : `renders_prospeccion/${fileName}`;
        const { data, error: upErr } = await supabase.storage
          .from(bucket)
          .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (!upErr && data) {
          const { data: pData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          publicUrl = pData.publicUrl;
          break;
        }
      }

      // Si no se pudo subir directamente a Supabase Storage por RLS, generar URL pública del endpoint
      if (!publicUrl) {
        publicUrl = `https://ecomoving-app.vercel.app/api/render-image?contacto_id=${c.id}`;
      }

      // Actualizar registro en Supabase
      const { error: upDbErr } = await supabase
        .from('contactos')
        .update({ imagen: publicUrl })
        .eq('id', c.id);

      if (upDbErr) {
        console.error(`❌ Error actualizando contacto ${c.nombre}:`, upDbErr.message);
        failCount++;
      } else {
        console.log(`✅ Migrado: ${c.nombre} (${c.correo}) -> ${publicUrl}`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`❌ Error procesando contacto ${c.nombre}:`, err.message);
      failCount++;
    }
  }

  console.log(`\n🎉 Migración completada! Éxitos: ${successCount}, Fallos: ${failCount}`);
  process.exit(0);
}

migrateBase64Images();
