import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: contacts, error } = await supabase
    .from('contactos')
    .select('*')
    .eq('correo', 'info@buseshualpen.cl');

  if (error) {
    console.error(error);
    return;
  }

  console.log('Contacts found:', contacts);
  for (const c of contacts) {
    if (c.cuenta_id) {
      const { data: acc } = await supabase
        .from('cuentas')
        .select('*')
        .eq('id', c.cuenta_id)
        .maybeSingle();
      console.log('Account for', c.correo, ':', acc);
    } else {
      console.log('No cuenta_id for', c.correo);
    }
  }
}

run();
