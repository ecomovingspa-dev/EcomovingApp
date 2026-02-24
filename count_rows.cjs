
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log("URL:", supabaseUrl ? "Found" : "Not Found");
console.log("Key:", supabaseKey ? "Found" : "Not Found");

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableCounts() {
    const tables = ['cotizaciones', 'compras', 'ventas', 'marketing'];

    for (const table of tables) {
        console.log(`Checking ${table}...`);
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`Error ${table}: ${error.message}`);
        } else {
            console.log(`${table}: ${count} rows`);
        }
    }
}

checkTableCounts().catch(console.error);
