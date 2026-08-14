const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const cleanRutForDb = (rut) => {
    if (!rut) return "";
    const clean = String(rut).replace(/[^0-9kK]/g, "").trim().toLowerCase();
    if (clean.length > 1) {
        const body = clean.slice(0, -1);
        const dv = clean.slice(-1);
        return `${body}-${dv}`;
    }
    return clean;
};

async function run() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.log('Starting sales RUT normalization audit...');
    
    // 1. Fetch all sales
    const { data: sales, error } = await supabase
        .from('ventas')
        .select('id, rut_recep, folio, tipo_dte, rzn_soc_recep, mnt_total');
        
    if (error) {
        console.error('Error fetching sales:', error);
        return;
    }
    
    console.log(`Loaded ${sales.length} sales documents.`);
    
    const updates = [];
    
    for (const s of sales) {
        if (!s.rut_recep) continue;
        const normalizedRut = cleanRutForDb(s.rut_recep);
        if (s.rut_recep !== normalizedRut) {
            updates.push({
                id: s.id,
                oldRut: s.rut_recep,
                newRut: normalizedRut,
                folio: s.folio,
                razon: s.rzn_soc_recep
            });
        }
    }
    
    console.log(`- Sales documents to normalize: ${updates.length}`);
    
    if (updates.length > 0) {
        console.log('\nSample normalization actions:');
        updates.slice(0, 10).forEach(u => {
            console.log(`  * ID ${u.id}: "${u.oldRut}" -> "${u.newRut}" (Folio ${u.folio} | ${u.razon})`);
        });

        console.log(`\nUpdating ${updates.length} records to standard RUT format...`);
        let successCount = 0;
        for (const u of updates) {
            const { error: updError } = await supabase
                .from('ventas')
                .update({ rut_recep: u.newRut })
                .eq('id', u.id);
            if (updError) {
                console.error(`Failed to update ID ${u.id} (${u.oldRut}):`, updError.message);
            } else {
                successCount++;
            }
        }
        console.log(`Successfully normalized ${successCount}/${updates.length} sales records.`);
    }
    
    console.log('\nSales normalization audit complete.');
}

run();
