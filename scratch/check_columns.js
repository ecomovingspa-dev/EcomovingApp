const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('check_columns', {}, { head: true });
  
  // Or we can just fetch one contact row and print the keys!
  const { data: contacts, error: cErr } = await supabase.from('contactos').select('*').limit(1);
  if (cErr) {
    console.error(cErr);
  } else {
    console.log("Contact columns:", Object.keys(contacts[0] || {}));
  }
}

check();
