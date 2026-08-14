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
    console.log('Starting purchases RUT normalization audit...');
    
    // 1. Fetch all purchases
    const { data: purchases, error } = await supabase
        .from('compras')
        .select('id, rut_proveedor, folio, tipo_dte, razon_social, monto_total');
        
    if (error) {
        console.error('Error fetching purchases:', error);
        return;
    }
    
    console.log(`Loaded ${purchases.length} purchase documents.`);
    
    const seen = new Set();
    const duplicatesToDelete = [];
    const updates = [];
    
    for (const p of purchases) {
        const normalizedRut = cleanRutForDb(p.rut_proveedor);
        const key = `${normalizedRut}:${p.tipo_dte}:${p.folio}`;
        
        if (seen.has(key)) {
            duplicatesToDelete.push(p);
        } else {
            seen.add(key);
            if (p.rut_proveedor !== normalizedRut) {
                updates.push({
                    id: p.id,
                    oldRut: p.rut_proveedor,
                    newRut: normalizedRut,
                    folio: p.folio,
                    razon: p.razon_social
                });
            }
        }
    }
    
    console.log(`\nAudit Results:`);
    console.log(`- Pre-existing duplicates to delete: ${duplicatesToDelete.length}`);
    console.log(`- Invoices to normalize: ${updates.length}`);
    
    if (duplicatesToDelete.length > 0) {
        console.log('\nDuplicates found:');
        duplicatesToDelete.forEach(d => {
            console.log(`  * Folio ${d.folio} | RUT ${d.rut_proveedor} | ${d.razon_social} | $${d.monto_total}`);
        });
    }

    if (updates.length > 0) {
        console.log('\nSample normalization actions:');
        updates.slice(0, 10).forEach(u => {
            console.log(`  * ID ${u.id}: "${u.oldRut}" -> "${u.newRut}" (Folio ${u.folio} | ${u.razon})`);
        });
    }
    
    // Actually apply the fixes!
    if (duplicatesToDelete.length > 0) {
        console.log(`\nDeleting ${duplicatesToDelete.length} duplicates...`);
        const idsToDelete = duplicatesToDelete.map(d => d.id);
        const { error: delError } = await supabase.from('compras').delete().in('id', idsToDelete);
        if (delError) {
            console.log('Failed to delete duplicates:', delError.message);
        } else {
            console.log('Successfully deleted duplicates.');
        }
    }

    if (updates.length > 0) {
        console.log(`\nUpdating ${updates.length} records to standard RUT format...`);
        let successCount = 0;
        for (const u of updates) {
            const { error: updError } = await supabase
                .from('compras')
                .update({ rut_proveedor: u.newRut })
                .eq('id', u.id);
            if (updError) {
                console.log(`Failed to update ID ${u.id} (${u.oldRut}):`, updError.message);
            } else {
                successCount++;
            }
        }
        console.log(`Successfully normalized ${successCount}/${updates.length} records.`);
    }
    
    console.log('\nNormalization audit complete.');
}

run();
