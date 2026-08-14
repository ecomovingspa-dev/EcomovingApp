const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    // Get sellers list
    const { data: sellers } = await supabase.from('vendedores').select('id, nombre');
    console.log('--- VENDEDORES ---');
    console.log(sellers);
    
    // Get account for SKC S.A.
    const { data: accounts } = await supabase
        .from('cuentas')
        .select('id, cliente, vendedor_id')
        .ilike('cliente', '%SKC%');
    console.log('\n--- CUENTAS ---');
    console.log(accounts);
    
    if (accounts && accounts.length > 0) {
        const accountId = accounts[0].id;
        const { data: contacts } = await supabase
            .from('contactos')
            .select('id, nombre, cuenta_id, vendedor_id, correo_cortesia_vendedor')
            .eq('cuenta_id', accountId);
        console.log('\n--- CONTACTOS ---');
        console.log(contacts);
    }
}

run();
