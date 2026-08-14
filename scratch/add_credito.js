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

async function addCredito() {
  const { data, error } = await supabase
    .from('banco_categorias')
    .insert([
      { id: 18, nombre: 'Crédito' }
    ])
    .select();

  if (error) {
    console.error("Error inserting category 'Crédito':", error);
    return;
  }

  console.log("Successfully added category 'Crédito':", data);
}

addCredito();
