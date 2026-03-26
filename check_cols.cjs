const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkColumns() {
    try {
        const { data, error } = await supabase.from('cotizaciones').select('*').limit(1);
        if (error) {
            console.error("Error al consultar:", error.message);
        } else {
            console.log("Columnas disponibles:", Object.keys(data[0] || {}).join(', '));
        }
    } catch (err) {
        console.error("Error inesperado:", err.message);
    }
}

checkColumns();
