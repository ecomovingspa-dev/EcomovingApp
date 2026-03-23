const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnonFetch() {
    console.log('Testing anon fetch from banco_categorias...');
    const { data, error } = await supabase
        .from('banco_categorias')
        .select('*');
    
    if (error) {
        console.error('ANON FETCH ERROR:', error);
    } else {
        console.log('ANON FETCH SUCCESS (Rows: ' + data.length + ')');
    }
}

checkAnonFetch();
