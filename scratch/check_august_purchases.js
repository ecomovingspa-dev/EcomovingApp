import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('compras')
        .select('fecha_emision, monto_total')
        .gte('fecha_emision', '2026-08-01')
        .lte('fecha_emision', '2026-08-31');

    if (error) {
        console.error(error);
    } else {
        console.log(`Found ${data.length} purchases in August 2026:`, data);
    }
}
run();
