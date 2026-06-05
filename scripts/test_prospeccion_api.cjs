const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch first stage
    const { data: stages, error } = await supabase
      .from('configuracion_prospeccion')
      .select('id, etiqueta')
      .order('orden', { ascending: true })
      .limit(1);

    if (error) throw error;
    if (!stages || stages.length === 0) {
      console.log("No stages found in configuracion_prospeccion");
      return;
    }

    const etapaId = stages[0].id;
    console.log(`Found stage: ${stages[0].etiqueta} (ID: ${etapaId})`);

    // 2. Call send-test-prospeccion local API
    console.log("Calling local API send-test-prospeccion...");
    const response = await axios.post('http://localhost:3001/api/send-test-prospeccion', {
      email: 'mario@ecomoving.cl',
      etapaId: etapaId
    });

    console.log("API Response:", response.data);
  } catch (err) {
    console.error("Test failed:", err.response ? err.response.data : err.message);
  }
}

run();
