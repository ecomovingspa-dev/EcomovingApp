const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('--- LIMPIEZA: Solo Cuentas Foco conservan historial y ultimo_envio ---');
    
    // 1. Obtener todas las cuentas para clasificar cuáles son Cuentas Foco
    const { data: accounts, error: accErr } = await supabase
        .from('cuentas')
        .select('id, cliente, cuenta_foco');
        
    if (accErr) {
        console.error('Error al obtener cuentas:', accErr);
        return;
    }
    
    const focusAccountIds = new Set(accounts.filter(a => a.cuenta_foco === true).map(a => a.id));
    console.log(`Identificadas ${focusAccountIds.size} Cuentas Foco.`);
    
    // 2. Obtener todos los contactos
    const { data: contacts, error: conErr } = await supabase
        .from('contactos')
        .select('id, nombre, cuenta_id');
        
    if (conErr) {
        console.error('Error al obtener contactos:', conErr);
        return;
    }
    
    console.log(`Total contactos: ${contacts.length}`);
    
    let deletedTraceCount = 0;
    let clearedLastSendCount = 0;
    let skippedFocoCount = 0;
    
    for (const contact of contacts) {
        const isFocus = focusAccountIds.has(contact.cuenta_id);
        
        if (isFocus) {
            // Cuenta Foco: NO SE TOCA NADA
            skippedFocoCount++;
            continue;
        }
        
        // NO es Cuenta Foco: eliminar historial de trazabilidad_correos
        const { error: delErr } = await supabase
            .from('trazabilidad_correos')
            .delete()
            .eq('contacto_id', contact.id);
            
        if (!delErr) deletedTraceCount++;
        
        // NO es Cuenta Foco: limpiar ultimo_envio
        const { error: updateErr } = await supabase
            .from('contactos')
            .update({ ultimo_envio: null })
            .eq('id', contact.id);
            
        if (!updateErr) clearedLastSendCount++;
    }
    
    console.log(`\nLimpieza finalizada.`);
    console.log(`- Contactos Foco conservados intactos: ${skippedFocoCount}`);
    console.log(`- Historial eliminado para ${deletedTraceCount} contactos NO foco.`);
    console.log(`- ultimo_envio limpiado para ${clearedLastSendCount} contactos NO foco.`);
}

run();
