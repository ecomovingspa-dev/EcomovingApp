
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    try {
        const { data, error } = await supabase
            .from('oportunidades')
            .select('*')
            .ilike('organismo', '%delegacion presidencial%')
            .limit(10);

        if (error) throw error;
        console.log("DB Matches:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error DB:", err.message);
    }
}

checkDb();
