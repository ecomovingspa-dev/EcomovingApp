import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Querying abonos with factoring references...');
    
    // Fetch all abonos related to factoring
    const { data: abonos, error: aErr } = await supabase
        .from('abonos')
        .select('*')
        .or('tipo_abono.eq.factoring,gasto_factoring.gt.0');

    if (aErr) {
        console.error('Error fetching abonos:', aErr);
        return;
    }

    console.log(`Found ${abonos.length} abonos with factoring:`);
    
    // Fetch corresponding invoices
    for (const a of abonos) {
        const { data: venta, error: vErr } = await supabase
            .from('ventas')
            .select('*')
            .eq('id', a.venta_id)
            .maybeSingle();

        if (vErr) {
            console.error(`Error fetching venta for abono ${a.id}:`, vErr);
            continue;
        }

        console.log('--------------------------------------------------');
        console.log(`ABONO ID: ${a.id}`);
        console.log(`Fecha Abono: ${a.fecha_abono}`);
        console.log(`Monto Abono: $${Number(a.monto_abono).toLocaleString('es-CL')}`);
        console.log(`Gasto Factoring: $${Number(a.gasto_factoring || 0).toLocaleString('es-CL')}`);
        console.log(`Tipo: ${a.tipo_abono}`);
        
        if (venta) {
            console.log(`FACTURA (VENTA) FOLIO: ${venta.folio}`);
            console.log(`Cliente: ${venta.cliente}`);
            console.log(`Monto Total Factura: $${Number(venta.mnt_total).toLocaleString('es-CL')}`);
            console.log(`Saldo Restante: $${Number(venta.saldo).toLocaleString('es-CL')}`);
            console.log(`Estado Deuda: ${venta.estado_deuda}`);
        } else {
            console.log(`Venta ID ${a.venta_id} not found.`);
        }
    }
    console.log('--------------------------------------------------');
}

run();
