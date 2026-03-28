import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listColumns() {
    console.log('--- REVISANDO COLUMNAS DE CONTACTOS ---');
    const { data, error } = await supabase
        .from('contactos')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching columns:', error);
        return;
    }

    if (data.length > 0) {
        console.log('Columnas encontradas:', Object.keys(data[0]));
        console.log('Primer registro:', data[0]);
    } else {
        console.log('La tabla está vacía.');
    }
}

listColumns();
