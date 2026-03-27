import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCuentas() {
  const { data, error } = await supabase
    .from('cuentas')
    .select('id, cliente, rut, sector, estado')
    .limit(100);

  if (error) {
    console.error('Error fetching cuentas:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

checkCuentas();
