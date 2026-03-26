const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProducts() {
    try {
        // Try common names for product tables
        const tables = ['productos', 'items', 'catalogo'];
        for (const t of tables) {
            const { data, error } = await supabase.from(t).select('*').limit(3);
            if (!error && data.length > 0) {
                console.log(`Productos en ${t}:`, data);
                return;
            }
        }
        console.log("No se encontraron tablas de productos con datos.");
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkProducts();
