import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listColumns() {
    console.log('--- COLUMNAS DE CONTACTOS ---');
    const { data, error } = await supabase
        .from('contactos')
        .select('*')
        .limit(1);

    if (error) {
        fs.writeFileSync('C:/Users/Mario/Desktop/Replit/React-Vite-Starter/tmp_cols.json', JSON.stringify(error, null, 2));
        return;
    }

    if (data.length > 0) {
        fs.writeFileSync('C:/Users/Mario/Desktop/Replit/React-Vite-Starter/tmp_cols.json', JSON.stringify(Object.keys(data[0]), null, 2));
    }
}

listColumns();
