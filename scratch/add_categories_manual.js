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

async function run() {
  // Sync the sequence
  const { data: seqData, error: seqError } = await supabase.rpc('execute_sql_temp', {
    sql_query: "SELECT setval(pg_get_serial_sequence('banco_categorias', 'id'), coalesce(max(id), 0)) FROM banco_categorias;"
  });
  
  // Wait, if RPC execute_sql_temp doesn't exist, we can run direct SQL using supabase.rpc if a custom function exists, 
  // or we can just specify the IDs manually when inserting to bypass the sequence!
  // Specifying IDs manually: since the max ID is 15, we can insert with IDs 16 and 17!
  console.log("Attempting manual insertion with IDs 16 and 17...");
  const { data, error } = await supabase
    .from('banco_categorias')
    .insert([
      { id: 16, nombre: 'Traspaso de cuenta' },
      { id: 17, nombre: 'Sin respaldo' }
    ])
    .select();

  if (error) {
    console.error("Error inserting categories:", error);
    return;
  }

  console.log("Successfully added categories manually:", data);
}

run();
