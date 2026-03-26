const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
    try {
        const { data, error } = await supabase.rpc('get_tables'); // Hope this exists or use info_schema
        if (error) {
            // Fallback to querying public schema info
            const { data: tables, error: err2 } = await supabase.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');
             if (err2) {
                // Try direct select from a common table just to check
                console.log("Error listing tables, trying direct schema query...");
                const { data: info, error: err3 } = await supabase.rpc('get_schema_info');
                console.log(err3 || info);
             } else {
                console.log("Tablas:", tables.map(t => t.tablename).join(', '));
             }
        } else {
            console.log("Tablas:", data);
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

listTables();
