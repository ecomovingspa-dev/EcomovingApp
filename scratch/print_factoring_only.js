import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('=== AUDITORÍA DE FACTORING EN ECOMOVING ===');

    // 1. Facturas que tienen dte_cesion = true
    const { data: cededInvoices, error: cErr } = await supabase
        .from('ventas')
        .select('*')
        .eq('dte_cesion', true);

    if (cErr) {
        console.error('Error al consultar dte_cesion:', cErr);
    } else {
        console.log(`\n1. Facturas marcadas con Cesión DTE (dte_cesion = true) [Total: ${cededInvoices.length}]:`);
        cededInvoices.forEach(v => {
            console.log(` - Folio: ${v.folio} | Cliente: ${v.rzn_soc_recep || 'N/A'}`);
            console.log(`   Monto Total: $${Number(v.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(v.saldo).toLocaleString('es-CL')} | Estado: ${v.estado_deuda}`);
        });
    }

    // 2. Abonos relacionados con Factoring
    const { data: abonos, error: aErr } = await supabase
        .from('abonos')
        .select('*')
        .or('tipo_abono.eq.factoring,gasto_factoring.gt.0');

    if (aErr) {
        console.error('Error al consultar abonos:', aErr);
    } else {
        console.log(`\n2. Abonos/Pagos registrados bajo Factoring [Total: ${abonos.length}]:`);
        for (const a of abonos) {
            const { data: v } = await supabase
                .from('ventas')
                .select('*')
                .eq('id', a.venta_id)
                .maybeSingle();

            console.log(` - Abono ID: ${a.id} | Fecha: ${a.fecha_abono}`);
            console.log(`   Monto Recibido (Abono): $${Number(a.monto_abono).toLocaleString('es-CL')}`);
            console.log(`   Gasto Factoring (Descuento Comisión): $${Number(a.gasto_factoring || 0).toLocaleString('es-CL')}`);
            console.log(`   Total Descontado de la Factura: $${(Number(a.monto_abono) + Number(a.gasto_factoring || 0)).toLocaleString('es-CL')}`);
            if (v) {
                console.log(`   Factura Asociada: Folio ${v.folio} | Cliente: ${v.rzn_soc_recep} | Saldo Restante Factura: $${Number(v.saldo).toLocaleString('es-CL')} (Estado: ${v.estado_deuda})`);
            }
            console.log('   -------------------------------------------------');
        }
    }
    console.log('\n=== FIN DE AUDITORÍA ===');
}

run();
