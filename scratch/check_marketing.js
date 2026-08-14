import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('marketing').select('*').order('nombre_envio');
    if (error) {
        console.error(error);
    } else {
        console.log(data.map(d => ({
            id: d.id,
            nombre_envio: d.nombre_envio,
            asunto: d.asunto,
            activo: d.activo
        })));
    }
}
run();
