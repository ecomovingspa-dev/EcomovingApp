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

async function removeDuplicates() {
  const { data, error } = await supabase
    .from('compras')
    .delete()
    .in('id', [432, 442])
    .select();

  if (error) {
    console.error("Error deleting records:", error);
    return;
  }

  console.log("Successfully deleted records:", JSON.stringify(data, null, 2));
}

removeDuplicates();
