import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Get the invoice ID for Folio 129
    const { data: venta } = await supabase
        .from('ventas')
        .select('*')
        .eq('folio', 129)
        .single();

    if (!venta) {
        console.log('Invoice 129 not found.');
        return;
    }

    console.log(`Invoice ID for Folio 129: ${venta.id}`);
    console.log(`Total: $${Number(venta.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(venta.saldo).toLocaleString('es-CL')} | Estado: ${venta.estado_deuda}`);

    // Get all abonos for this invoice ID
    const { data: abonos } = await supabase
        .from('abonos')
        .select('*')
        .eq('venta_id', venta.id);

    console.log(`Found ${abonos.length} abonos for Folio 129:`);
    abonos.forEach(a => {
        console.log(` - Abono ID: ${a.id} | Fecha: ${a.fecha_abono} | Monto: $${Number(a.monto_abono).toLocaleString('es-CL')} | Gasto: $${Number(a.gasto_factoring).toLocaleString('es-CL')} | Tipo: ${a.tipo_abono}`);
    });
}
run();
