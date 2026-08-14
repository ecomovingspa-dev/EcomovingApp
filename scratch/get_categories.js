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

async function getCategories() {
  const { data, error } = await supabase
    .from('banco_categorias')
    .select('*');

  if (error) {
    console.error(error);
    return;
  }

  console.log("Current categories:", data);
}

getCategories();
