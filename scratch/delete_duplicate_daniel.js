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

async function processDaniel() {
  // 1. Delete duplicate records 438, 406, 456 FIRST to avoid unique constraint violations
  const { data: deleteData, error: deleteError } = await supabase
    .from('compras')
    .delete()
    .in('id', [438, 406, 456])
    .select();

  if (deleteError) {
    console.error("Error deleting duplicate records:", deleteError);
    return;
  }
  console.log("Successfully deleted duplicate records:", JSON.stringify(deleteData, null, 2));

  // 2. Update ID 449 tipo_dte to 33
  const { data: updateData, error: updateError } = await supabase
    .from('compras')
    .update({ tipo_dte: 33 })
    .eq('id', 449)
    .select();

  if (updateError) {
    console.error("Error updating record 449:", updateError);
    return;
  }
  console.log("Successfully updated record 449:", JSON.stringify(updateData, null, 2));
}

processDaniel();
