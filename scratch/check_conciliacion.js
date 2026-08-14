import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: invoices, error } = await supabase
        .from('ventas')
        .select('folio, rzn_soc_recep, conciliado, estado_deuda')
        .in('folio', [128, 130]);

    if (error) {
        console.error(error);
        return;
    }

    invoices.forEach(inv => {
        console.log(`Folio: ${inv.folio}`);
        console.log(`  Cliente: ${inv.rzn_soc_recep}`);
        console.log(`  Estado Deuda: ${inv.estado_deuda}`);
        console.log(`  Conciliado: ${inv.conciliado}`);
        console.log('---------------------------------');
    });
}
run();
