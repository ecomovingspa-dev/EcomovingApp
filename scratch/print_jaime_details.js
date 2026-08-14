import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: contacts, error } = await supabase
        .from('contactos')
        .select('*')
        .eq('id', 'e1ac148e-94a1-4c44-85d2-eed48cad179f')
        .single();

    if (error) {
        console.error(error);
    } else {
        console.log(contacts);
    }
}
run();
