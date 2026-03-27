import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function countAll() {
  const { count, error } = await supabase
    .from('cuentas')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total Cuentas: ${count}`);
}

countAll();
