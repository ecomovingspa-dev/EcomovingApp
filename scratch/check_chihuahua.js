import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChihuahua() {
  const { data, error } = await supabase
    .from('compras')
    .select('*')
    .eq('rut_proveedor', '76678895-5')
    .in('folio', ['1552', '1553']);

  if (error) {
    console.error(error);
    return;
  }

  console.log("Found records for Chihuahua:");
  console.log(JSON.stringify(data, null, 2));
}

checkChihuahua();
