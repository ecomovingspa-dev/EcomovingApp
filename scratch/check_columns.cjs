const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('contactos').select('correo_cortesia_enviado').limit(1);
  if (error) {
    console.error("Error selecting column:", error);
  } else {
    console.log("Column exists, data:", data);
  }
}

check();
