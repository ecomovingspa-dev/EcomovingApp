const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error, count } = await supabase
        .from('oportunidades')
        .select('*', { count: 'exact' });

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`Total oportunidades en la tabla: ${count}`);
    if (data && data.length > 0) {
        console.log('Primeras 5:');
        data.slice(0, 5).forEach(op => {
            console.log(`  - ${op.id} | ${op.nombre} | Cierre: ${op.fecha_cierre}`);
        });
    } else {
        console.log('La tabla está vacía.');
    }
}

check();
