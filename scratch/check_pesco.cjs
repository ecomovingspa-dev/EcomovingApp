const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('Searching for Pesco S.A. account...');
    const { data: accounts } = await supabase
        .from('cuentas')
        .select('*')
        .ilike('cliente', '%Pesco%');
        
    console.log('Accounts found:', accounts);
    
    if (accounts && accounts.length > 0) {
        const accountId = accounts[0].id;
        const { data: contacts } = await supabase
            .from('contactos')
            .select('*')
            .eq('cuenta_id', accountId);
            
        console.log('\n--- Contacts found in database for Pesco S.A. ---');
        contacts.forEach((c, idx) => {
            console.log(`[${idx + 1}] ID: ${c.id} | Nombre: ${c.nombre} | Correo: ${c.correo} | Estado: ${c.estado} | Etapa: ${c.etapa} | Ultimo Envio: ${c.ultimo_envio}`);
        });

        // Also query the trazabilidad_correos table for events related to these contacts
        const contactEmails = contacts.map(c => c.correo).filter(Boolean);
        if (contactEmails.length > 0) {
            const { data: traceEvents } = await supabase
                .from('trazabilidad_correos')
                .select('*')
                .in('email', contactEmails);
            console.log('\n--- Trace events found for Pesco S.A. contacts ---');
            console.log(traceEvents);
        }
    }
}

run();
