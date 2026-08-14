const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('--- Copiar fecha del 1er correo de Cuentas Foco a columna fecha_envio_foco ---');
    
    // 1. Obtener Cuentas Foco
    const { data: accounts, error: accErr } = await supabase
        .from('cuentas')
        .select('id, cliente, cuenta_foco');
    if (accErr) { console.error(accErr); return; }
    
    const focoAccounts = accounts.filter(a => a.cuenta_foco === true);
    const focoIds = new Set(focoAccounts.map(a => a.id));
    console.log(`Cuentas Foco: ${focoAccounts.length}`);
    
    // 2. Obtener contactos de Cuentas Foco
    const { data: contacts, error: conErr } = await supabase
        .from('contactos')
        .select('id, nombre, cuenta_id');
    if (conErr) { console.error(conErr); return; }
    
    const focoContacts = contacts.filter(c => focoIds.has(c.cuenta_id));
    console.log(`Contactos pertenecientes a Cuentas Foco: ${focoContacts.length}`);
    
    let copiedCount = 0;
    let emptyCount = 0;
    
    for (const contact of focoContacts) {
        // Buscar registro manual_send del primer correo (builtin-prospeccion-1)
        const { data: traces, error: trErr } = await supabase
            .from('trazabilidad_correos')
            .select('created_at, fecha, mensaje_id')
            .eq('contacto_id', contact.id)
            .like('mensaje_id', 'manual_send:builtin-prospeccion-1:%')
            .order('created_at', { ascending: true })
            .limit(1);
        
        if (trErr) {
            console.error(`Error buscando historial de ${contact.nombre}:`, trErr.message);
            continue;
        }
        
        if (traces && traces.length > 0) {
            const dateVal = traces[0].fecha || traces[0].created_at;
            const { error: upErr } = await supabase
                .from('contactos')
                .update({ fecha_envio_foco: dateVal })
                .eq('id', contact.id);
            
            if (!upErr) {
                const accountName = focoAccounts.find(a => a.id === contact.cuenta_id)?.cliente || '?';
                console.log(`✅ ${contact.nombre} (${accountName}) → fecha_envio_foco: ${dateVal}`);
                copiedCount++;
            }
        } else {
            emptyCount++;
        }
    }
    
    console.log(`\nFinalizado.`);
    console.log(`- Fechas copiadas: ${copiedCount}`);
    console.log(`- Cuentas Foco sin fecha (vacías): ${emptyCount}`);
}

run();
