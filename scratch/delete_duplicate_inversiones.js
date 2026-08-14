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

async function removeDuplicate() {
  const { data, error } = await supabase
    .from('compras')
    .delete()
    .eq('id', 463)
    .select();

  if (error) {
    console.error("Error deleting record:", error);
    return;
  }

  console.log("Successfully deleted record:", JSON.stringify(data, null, 2));
}

removeDuplicate();
