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

async function addCategories() {
  const { data, error } = await supabase
    .from('banco_categorias')
    .insert([
      { nombre: 'Traspaso de cuenta' },
      { nombre: 'Sin respaldo' }
    ])
    .select();

  if (error) {
    console.error("Error inserting categories:", error);
    return;
  }

  console.log("Successfully added categories:", data);
}

addCategories();
