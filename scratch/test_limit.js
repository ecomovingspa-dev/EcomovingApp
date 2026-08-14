import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Counting total records in trazabilidad_correos...');
    
    const { count, error } = await supabase
        .from('trazabilidad_correos')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total records in trazabilidad_correos: ${count}`);

    // Try fetching with pagination (range)
    let allHistory = [];
    let from = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error: hError } = await supabase
            .from('trazabilidad_correos')
            .select('*')
            .gte('fecha', '2026-06-01')
            .range(from, from + limit - 1);

        if (hError) {
            console.error('Error fetching range:', hError);
            break;
        }

        if (!data || data.length === 0) break;
        allHistory = allHistory.concat(data);
        if (data.length < limit) break;
        from += limit;
    }

    console.log(`Fetched ${allHistory.length} records with paginated .range() for June 2026.`);

    // Check if Cimtec is in these records
    const cimtecRecords = allHistory.filter(h => h.email === 'recepcion@cimtec.cl');
    console.log(`Cimtec records in fetched data (count: ${cimtecRecords.length}):`);
    console.log(cimtecRecords);
}

run();
