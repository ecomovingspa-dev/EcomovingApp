import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Testing Pendiente query...');
    const hoyStr = new Date().toISOString().split('T')[0];
    
    // Pendiente is not vencida, not pagada (saldo > 0)
    const { data, error, count } = await supabase
        .from('compras')
        .select('*', { count: 'exact' })
        .eq('estado_pago', 'Pendiente')
        .or(`fecha_vencimiento.gte.${hoyStr},fecha_vencimiento.is.null`);

    if (error) {
        console.error('Error running query:', error);
    } else {
        console.log(`Query succeeded! Found count: ${count}`);
    }
}
run();
