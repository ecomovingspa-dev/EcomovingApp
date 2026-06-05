const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    try {
        console.log("Connecting to Supabase at:", supabaseUrl);
        const { data, error } = await supabase
            .from('contactos')
            .select('*')
            .limit(1);

        if (error) {
            console.error("Error querying contactos:", error);
        } else {
            console.log("Contact record keys:", Object.keys(data[0] || {}));
            console.log("Full record sample:", data[0]);
        }
    } catch (e) {
        console.error("Exec error:", e);
    }
}

checkColumns();
