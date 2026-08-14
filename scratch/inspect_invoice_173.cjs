const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    // Find invoice
    const { data: invoice, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('folio', '173')
        .maybeSingle();
        
    if (error) {
        console.error(error);
        return;
    }
    
    if (!invoice) {
        console.log('Invoice folio 173 not found.');
        return;
    }
    
    console.log('Invoice details:', {
        id: invoice.id,
        folio: invoice.folio,
        tipo_dte: invoice.tipo_dte,
        rut_recep: invoice.rut_recep,
        mnt_total: invoice.mnt_total,
        mnt_neto: invoice.mnt_neto,
        mnt_iva: invoice.mnt_iva,
        total_nc: invoice.total_nc,
        saldo: invoice.saldo,
        estado_deuda: invoice.estado_deuda,
        anulada: invoice.anulada
    });
    
    // Find abonos
    const { data: abonos } = await supabase
        .from('abonos')
        .select('*')
        .eq('venta_id', invoice.id);
        
    console.log('Abonos for this invoice:', abonos);
}

run();
