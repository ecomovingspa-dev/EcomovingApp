import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Querying invoices with dte_cesion or factoring references...');

    // 1. Query invoices where dte_cesion is true or not null/empty
    const { data: cededInvoices, error: cErr } = await supabase
        .from('ventas')
        .select('*')
        .not('dte_cesion', 'is', null);

    if (cErr) {
        console.error('Error fetching ceded invoices:', cErr);
        return;
    }

    console.log(`\n--- INVOICES WITH dte_cesion (${cededInvoices.length} found) ---`);
    cededInvoices.forEach(v => {
        console.log(`FOLIO: ${v.folio} | Cliente: ${v.rzn_soc_recep} | RUT: ${v.rut_recep}`);
        console.log(`  Monto Total: $${Number(v.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(v.saldo).toLocaleString('es-CL')}`);
        console.log(`  Estado Deuda: ${v.estado_deuda} | Cesión: ${v.dte_cesion}`);
        console.log('  -----------------------------------------');
    });

    // 2. Query abonos related to factoring
    const { data: abonos, error: aErr } = await supabase
        .from('abonos')
        .select('*')
        .or('tipo_abono.eq.factoring,gasto_factoring.gt.0');

    if (aErr) {
        console.error('Error fetching abonos:', aErr);
        return;
    }

    console.log(`\n--- PAYMENTS (ABONOS) LINKED TO FACTORING (${abonos.length} found) ---`);
    for (const a of abonos) {
        const { data: v } = await supabase
            .from('ventas')
            .select('*')
            .eq('id', a.venta_id)
            .maybeSingle();

        console.log(`ABONO ID: ${a.id} | Fecha: ${a.fecha_abono}`);
        console.log(`  Monto Abono: $${Number(a.monto_abono).toLocaleString('es-CL')} | Gasto Factoring: $${Number(a.gasto_factoring || 0).toLocaleString('es-CL')}`);
        console.log(`  Tipo: ${a.tipo_abono}`);
        if (v) {
            console.log(`  FACTURA FOLIO: ${v.folio} | Cliente: ${v.rzn_soc_recep} | Saldo: $${Number(v.saldo).toLocaleString('es-CL')}`);
        }
        console.log('  -----------------------------------------');
    }
}

run();
