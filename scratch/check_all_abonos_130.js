import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Get the invoice ID for Folio 130
    const { data: venta, error: vErr } = await supabase
        .from('ventas')
        .select('*')
        .eq('folio', 130)
        .single();

    if (vErr) {
        console.error('Error fetching invoice 130:', vErr);
        return;
    }

    console.log(`Invoice ID for Folio 130: ${venta.id}`);
    console.log(`Total: $${Number(venta.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(venta.saldo).toLocaleString('es-CL')} | Estado: ${venta.estado_deuda}`);

    // 2. Get all abonos for this invoice ID
    const { data: abonos, error: aErr } = await supabase
        .from('abonos')
        .select('*')
        .eq('venta_id', venta.id);

    if (aErr) {
        console.error('Error fetching abonos:', aErr);
        return;
    }

    console.log(`Found ${abonos.length} abonos for Folio 130:`);
    abonos.forEach(a => {
        console.log(` - Abono ID: ${a.id} | Fecha: ${a.fecha_abono} | Monto: $${Number(a.monto_abono).toLocaleString('es-CL')} | Gasto Factoring: $${Number(a.gasto_factoring).toLocaleString('es-CL')} | Tipo: ${a.tipo_abono}`);
    });
}
run();
