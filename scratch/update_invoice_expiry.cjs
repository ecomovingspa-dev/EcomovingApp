const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.log('Searching for invoice Folio 179...');
    
    // Find the invoice
    const { data: invoice, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('folio', '179')
        .maybeSingle();
        
    if (error) {
        console.error('Error fetching invoice:', error);
        return;
    }
    
    if (!invoice) {
        console.log('Invoice with folio 179 not found.');
        return;
    }
    
    console.log(`Found invoice: ID ${invoice.id} | Client: ${invoice.rzn_soc_recep} | Emission: ${invoice.fch_emis} | Expiry: ${invoice.fch_venc} | Status: ${invoice.estado_deuda}`);
    
    // Update expiry to 30 days from emission (2026-08-04 -> 2026-09-03)
    const newExpiry = '2026-09-03';
    const newStatus = 'Pendiente';
    
    console.log(`Updating expiry to ${newExpiry} and status to ${newStatus}...`);
    
    const { error: updateError } = await supabase
        .from('ventas')
        .update({
            fch_venc: newExpiry,
            estado_deuda: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);
        
    if (updateError) {
        console.error('Error updating invoice:', updateError);
        return;
    }
    
    console.log('Invoice updated successfully.');
}

run();
