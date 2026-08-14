const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('--- One-Time Migration: Activating contacts with valid historical emails ---');
    
    // 1. Get all inactive contacts
    const { data: contacts, error: fetchErr } = await supabase
        .from('contactos')
        .select('id, nombre, correo, estado, etapa, ultimo_envio')
        .eq('estado', 'inactivo');
        
    if (fetchErr) {
        console.error('Error fetching inactive contacts:', fetchErr);
        return;
    }
    
    console.log(`Found ${contacts.length} inactive contacts in the database.`);
    
    let activatedCount = 0;
    
    for (const contact of contacts) {
        let shouldActivate = false;
        let reason = '';
        
        // Check 1: If they have a valid ultimo_envio date
        if (contact.ultimo_envio && contact.ultimo_envio.trim() !== '') {
            shouldActivate = true;
            reason = `valid ultimo_envio date (${contact.ultimo_envio})`;
        } else {
            // Check 2: If they have records in trazabilidad_correos
            const { data: traceEvents, error: traceErr } = await supabase
                .from('trazabilidad_correos')
                .select('id')
                .or(`email.ilike.%${contact.correo}%,contacto_id.eq.${contact.id}`)
                .limit(1);
                
            if (!traceErr && traceEvents && traceEvents.length > 0) {
                shouldActivate = true;
                reason = 'found email events in trazabilidad_correos';
            }
        }
        
        if (shouldActivate) {
            console.log(`Activating contact: ${contact.nombre} (${contact.correo || 'No email'}) - Reason: ${reason}`);
            const { error: updateErr } = await supabase
                .from('contactos')
                .update({ 
                    estado: 'activo', 
                    etapa: 'marketing' 
                })
                .eq('id', contact.id);
                
            if (updateErr) {
                console.error(`Failed to update ${contact.nombre}:`, updateErr.message);
            } else {
                activatedCount++;
            }
        }
    }
    
    console.log(`\nMigration finished. Successfully activated ${activatedCount} contacts.`);
}

run();
