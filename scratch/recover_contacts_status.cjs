const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('--- Database Recovery: Resetting contacts without manual Zoho send records to inactivo ---');
    
    // 1. Get all active contacts in marketing/prospeccion stage
    const { data: activeContacts, error: fetchErr } = await supabase
        .from('contactos')
        .select('id, nombre, correo, estado, etapa, ultimo_envio')
        .eq('estado', 'activo');
        
    if (fetchErr) {
        console.error('Error fetching active contacts:', fetchErr);
        return;
    }
    
    console.log(`Currently there are ${activeContacts.length} active contacts in the database.`);
    
    let deactivatedCount = 0;
    
    for (const contact of activeContacts) {
        // Query if there is ANY manual send or manual template event for this contact
        const { data: manualEvents, error: traceErr } = await supabase
            .from('trazabilidad_correos')
            .select('id, mensaje_id')
            .eq('contacto_id', contact.id)
            .or('mensaje_id.like.manual_send:%,mensaje_id.like.manual_template:%');
            
        if (traceErr) {
            console.error(`Error checking trace for ${contact.nombre}:`, traceErr.message);
            continue;
        }
        
        // If NO manual events found, set the contact back to inactivo
        if (!manualEvents || manualEvents.length === 0) {
            console.log(`Deactivating contact: ${contact.nombre} (${contact.correo || 'No email'}) - No manual Zoho sends found.`);
            const { error: updateErr } = await supabase
                .from('contactos')
                .update({ 
                    estado: 'inactivo'
                })
                .eq('id', contact.id);
                
            if (updateErr) {
                console.error(`Failed to deactivate ${contact.nombre}:`, updateErr.message);
            } else {
                deactivatedCount++;
            }
        }
    }
    
    console.log(`\nRecovery finished. Successfully set ${deactivatedCount} contacts back to inactivo.`);
}

run();
