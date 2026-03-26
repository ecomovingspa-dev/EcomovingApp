const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applySql() {
    const sql = `
        ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;
        ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS id_mercado_publico TEXT;
    `;

    try {
        const { data, error } = await supabase.rpc('run_sql', { sql_query: sql });
        if (error) {
            console.error("Error al ejecutar SQL:", error.message);
        } else {
            console.log("Columnas 'fecha' e 'id_mercado_publico' agregadas con éxito.");
        }
    } catch (err) {
        console.error("Error inesperado:", err.message);
    }
}

applySql();
