const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('Querying table information/schema from Supabase...');
    
    // Let's list tables by running a query or trying to select from web_contenido
    const { data: tableData, error: err } = await supabase
        .from('web_contenido')
        .select('*')
        .limit(5);
        
    if (err) {
        console.error('Error selecting from web_contenido:', err);
    } else {
        console.log('--- Columns/Data found in web_contenido ---');
        console.log(tableData);
    }

    // Let's also check if there is an RPC or another way to see the schema
    const { data: schemaData, error: schemaErr } = await supabase.rpc('get_tables_info');
    if (schemaErr) {
        // If no RPC, let's query postgres internal tables via SQL if we have query access, 
        // but Supabase JS client doesn't let us run raw SQL directly unless we use an RPC.
        console.log('RPC get_tables_info not available or errored:', schemaErr.message);
    } else {
        console.log('Tables info:', schemaData);
    }
}

run();
