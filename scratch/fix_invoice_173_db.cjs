const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.log('Updating invoice Folio 173 balance and status...');
    
    const { error } = await supabase
        .from('ventas')
        .update({
            saldo: 0,
            anulada: true,
            estado_deuda: 'Anulada',
            updated_at: new Date().toISOString()
        })
        .eq('folio', '173');
        
    if (error) {
        console.error('Error updating invoice:', error);
    } else {
        console.log('Invoice Folio 173 successfully updated to Saldo $0 and Anulada = true.');
    }
}

run();
