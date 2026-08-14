const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    console.log('--- Database Cleanup: trazabilidad_correos ---');
    
    // 1. Get total count
    const { count: totalCount, error: countErr1 } = await supabase
        .from('trazabilidad_correos')
        .select('*', { count: 'exact', head: true });
        
    if (countErr1) {
        console.error('Error getting total count:', countErr1);
        return;
    }
    console.log('Total records currently in table:', totalCount);
    
    // 2. Get count of records to delete (<= 2026-06-30)
    const cutoffDate = '2026-06-30';
    const { count: deleteCount, error: countErr2 } = await supabase
        .from('trazabilidad_correos')
        .select('*', { count: 'exact', head: true })
        .lte('fecha', cutoffDate);
        
    if (countErr2) {
        console.error('Error getting records to delete count:', countErr2);
        return;
    }
    console.log(`Records dated ${cutoffDate} and older to be deleted:`, deleteCount);
    
    if (deleteCount === 0) {
        console.log('No records found to delete. Cleanup complete.');
        return;
    }
    
    // 3. Perform delete
    console.log(`Executing DELETE from trazabilidad_correos where fecha <= '${cutoffDate}'...`);
    const { data, error: delErr } = await supabase
        .from('trazabilidad_correos')
        .delete()
        .lte('fecha', cutoffDate);
        
    if (delErr) {
        console.error('Error executing delete:', delErr);
        return;
    }
    
    console.log('Delete operation completed successfully.');
    
    // 4. Get final count
    const { count: finalCount } = await supabase
        .from('trazabilidad_correos')
        .select('*', { count: 'exact', head: true });
        
    console.log('Remaining records in table:', finalCount);
}

run();
