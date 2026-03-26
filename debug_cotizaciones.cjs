const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase
        .from('cotizaciones')
        .select('id, numero_cotizacion, items, total_neto')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Sample Cotizaciones:');
    data.forEach(c => {
        console.log(`- ${c.numero_cotizacion}: Items count = ${c.items ? c.items.length : 0}, Neto = ${c.total_neto}`);
    });
}

checkData();
