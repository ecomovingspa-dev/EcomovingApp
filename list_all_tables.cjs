const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listAll() {
    try {
        const { data: tables, error } = await supabase.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');
        if (error) {
           // If pg_tables is not accessbile, try a manual list of common names that might exist
           const targets = ['marketing', 'contactos', 'ventas', 'compras', 'marketing_tracking', 'marketing_logs', 'email_logs', 'seguimiento_marketing'];
           for (const t of targets) {
               const { error: err } = await supabase.from(t).select('id').limit(1);
               if (!err) console.log(`Encontrada: ${t}`);
           }
        } else {
            console.log("Tablas:", tables.map(t => t.tablename).join(', '));
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

listAll();
