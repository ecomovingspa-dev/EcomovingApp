const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const { data, error } = await supabase
        .from('compras')
        .select('tipo_dte, folio, razon_social')
        .order('tipo_dte');
        
    if (error) {
        console.error(error);
        return;
    }
    
    const types = {};
    data.forEach(d => {
        types[d.tipo_dte] = (types[d.tipo_dte] || 0) + 1;
    });
    
    console.log('Unique DTE Types in Compras table:', types);
}

run();
