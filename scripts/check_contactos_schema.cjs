const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Conectando a Supabase...");
    const { data, error } = await supabase
      .from('contactos')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error("Error al consultar contactos:", error);
    } else {
      console.log("Columnas actuales en 'contactos':", Object.keys(data[0] || {}));
      console.log("Registro de muestra:", data[0]);
    }
  } catch (err) {
    console.error("Error general:", err);
  }
}

run();
