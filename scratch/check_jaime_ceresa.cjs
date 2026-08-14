const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('Searching for contact JAIME CERESA...');
    const { data: contacts, error } = await supabase
        .from('contactos')
        .select('*')
        .ilike('nombre', '%JAIME CERESA%');
        
    if (error) {
        console.error('Error fetching contact:', error);
        return;
    }
    
    if (!contacts || contacts.length === 0) {
        console.log('Contact not found.');
        return;
    }
    
    const contact = contacts[0];
    console.log('\n--- Contact Details ---');
    console.log({
        id: contact.id,
        nombre: contact.nombre,
        correo: contact.correo,
        estado: contact.estado,
        etapa: contact.etapa,
        ultimo_envio: contact.ultimo_envio,
        ultimo_evento_trazabilidad: contact.ultimo_evento_trazabilidad
    });
    
    console.log('\nSearching trazabilidad_correos for email:', contact.correo, 'or contact_id:', contact.id);
    
    // Look up by email (case-insensitive) or by contact_id
    const { data: history, error: hError } = await supabase
        .from('trazabilidad_correos')
        .select('*')
        .or(`email.ilike.%${contact.correo}%,contacto_id.eq.${contact.id}`)
        .order('fecha', { ascending: false });
        
    if (hError) {
        console.error('Error fetching history:', hError);
        return;
    }
    
    console.log(`\n--- Found ${history.length} email records ---`);
    history.forEach((h, i) => {
        console.log(`[${i+1}] Date: ${h.fecha} | Event: ${h.estado} | MessageID: ${h.mensaje_id} | CreatedAt: ${h.created_at}`);
    });
}

run();
