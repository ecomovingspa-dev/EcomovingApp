import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching sales invoices from June and July 2026...');
    const { data: sales, error } = await supabase
        .from('ventas')
        .select('*')
        .gte('fch_emis', '2026-05-01')
        .lte('fch_emis', '2026-07-31')
        .order('fch_emis', { ascending: false });

    if (error) {
        console.error(error);
    } else {
        console.log(`Found ${sales.length} sales in the range:`);
        sales.forEach(v => {
            console.log(`Folio: ${v.folio} | Cliente: ${v.rzn_soc_recep} | RUT: ${v.rut_recep} | Fecha: ${v.fch_emis} | Total: $${Number(v.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(v.saldo).toLocaleString('es-CL')} | Estado: ${v.estado_deuda} | Conciliado: ${v.conciliado}`);
        });
    }
}
run();
