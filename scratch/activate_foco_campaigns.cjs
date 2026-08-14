const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('--- Activar campaña en contactos Foco con fecha_envio_foco ---');
    
    // Obtener contactos que tienen fecha_envio_foco (no null)
    const { data: contacts, error } = await supabase
        .from('contactos')
        .select('id, nombre, estado, etapa, fecha_envio_foco, cuenta_id')
        .not('fecha_envio_foco', 'is', null)
        .neq('fecha_envio_foco', '');
    
    if (error) { console.error(error); return; }
    
    console.log(`Contactos con fecha_envio_foco: ${contacts.length}`);
    
    let activatedCount = 0;
    let alreadyActiveCount = 0;
    
    for (const c of contacts) {
        if (c.estado === 'activo') {
            console.log(`  ⏭️  ${c.nombre} ya está activo`);
            alreadyActiveCount++;
            continue;
        }
        
        const { error: upErr } = await supabase
            .from('contactos')
            .update({ estado: 'activo', etapa: 'marketing' })
            .eq('id', c.id);
        
        if (!upErr) {
            console.log(`  ✅ ${c.nombre} → CAMPAÑA ACTIVA (fecha: ${c.fecha_envio_foco})`);
            activatedCount++;
        } else {
            console.error(`  ❌ Error en ${c.nombre}:`, upErr.message);
        }
    }
    
    console.log(`\nFinalizado.`);
    console.log(`- Activados: ${activatedCount}`);
    console.log(`- Ya estaban activos: ${alreadyActiveCount}`);
}

run();
