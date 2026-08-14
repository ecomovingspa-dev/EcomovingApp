import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Searching for Thyssenkrupp sales invoices and abonos...');
    
    // 1. Search by client name
    const { data: salesByName, error: errName } = await supabase
        .from('ventas')
        .select('*')
        .ilike('rzn_soc_recep', '%Thyssenkrupp%');

    if (errName) {
        console.error('Error querying by name:', errName);
    } else {
        console.log(`Found ${salesByName.length} sales matching name "Thyssenkrupp":`);
        salesByName.forEach(v => {
            console.log(`- Folio: ${v.folio} | Fecha: ${v.fch_emis} | Total: $${Number(v.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(v.saldo).toLocaleString('es-CL')} | Estado: ${v.estado_deuda} | Conciliado: ${v.conciliado}`);
        });
    }

    // 2. Search by exact or close amount ($3.072.643)
    const targetAmount = 3072643;
    const { data: salesByAmount, error: errAmount } = await supabase
        .from('ventas')
        .select('*')
        .gte('mnt_total', targetAmount - 100)
        .lte('mnt_total', targetAmount + 100);

    if (errAmount) {
        console.error('Error querying by amount:', errAmount);
    } else if (salesByAmount.length > 0) {
        console.log(`\nFound ${salesByAmount.length} sales matching amount close to $3.072.643:`);
        salesByAmount.forEach(v => {
            console.log(`- Folio: ${v.folio} | Cliente: ${v.rzn_soc_recep} | Total: $${Number(v.mnt_total).toLocaleString('es-CL')} | Saldo: $${Number(v.saldo).toLocaleString('es-CL')} | Estado: ${v.estado_deuda}`);
        });
    }

    // 3. Search abonos for the exact amount just in case they were registered
    const { data: abonos, error: errAbonos } = await supabase
        .from('abonos')
        .select('*, ventas(*)')
        .gte('monto_abono', targetAmount - 5)
        .lte('monto_abono', targetAmount + 5);

    if (errAbonos) {
        console.error('Error querying abonos:', errAbonos);
    } else if (abonos.length > 0) {
        console.log(`\nFound ${abonos.length} registered abonos close to $3.072.643:`);
        abonos.forEach(a => {
            const v = a.ventas;
            console.log(`- Abono ID: ${a.id} | Fecha: ${a.fecha_abono} | Monto: $${Number(a.monto_abono).toLocaleString('es-CL')} | Folio Venta: ${v?.folio} | Cliente: ${v?.rzn_soc_recep}`);
        });
    }
}
run();
