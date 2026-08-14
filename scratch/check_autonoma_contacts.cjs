const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('Fetching account for Universidad Autonoma de Chile...');
    const { data: accounts } = await supabase
        .from('cuentas')
        .select('*')
        .ilike('cliente', '%Universidad Autonoma%');
        
    console.log('Accounts found:', accounts);
    
    if (accounts && accounts.length > 0) {
        const accountId = accounts[0].id;
        const { data: contacts } = await supabase
            .from('contactos')
            .select('*')
            .eq('cuenta_id', accountId);
            
        console.log('\n--- Contacts found in database for this account ---');
        contacts.forEach((c, idx) => {
            console.log(`[${idx + 1}] ID: ${c.id} | Nombre: ${c.nombre} | Correo: ${c.correo} | Cel/Tel: ${c.celular}/${c.telefono} | Estado: ${c.estado} | Etapa: ${c.etapa}`);
        });
    }
}

run();
