import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Querying trazabilidad_correos for 2026-08-07...');
    
    const { data: records, error } = await supabase
        .from('trazabilidad_correos')
        .select('*')
        .eq('fecha', '2026-08-07');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${records.length} records for 2026-08-07:\n`);

    for (const r of records) {
        // Fetch contact details
        const { data: contact } = await supabase
            .from('contactos')
            .select('nombre, etapa')
            .eq('id', r.contacto_id)
            .maybeSingle();

        console.log(`ID: ${r.id}`);
        console.log(`Contacto: ${contact ? contact.nombre : 'N/A'} (Etapa: ${contact ? contact.etapa : 'N/A'})`);
        console.log(`Email Destino: ${r.email}`);
        console.log(`Estado: ${r.estado}`);
        console.log(`MsgId: ${r.mensaje_id}`);
        console.log(`CreatedAt: ${r.created_at}`);
        console.log('-------------------------------------------');
    }
}
run();
