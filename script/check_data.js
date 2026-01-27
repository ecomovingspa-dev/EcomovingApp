
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xgdmyjzyejjmwdqkufhp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data: movs, error: errMovs } = await supabase
        .from('banco_movimientos')
        .select('*')
        .limit(10);

    if (errMovs) console.error(errMovs);
    else console.log("Movimientos Sample:", JSON.stringify(movs, null, 2));

    const { count } = await supabase
        .from('banco_movimientos')
        .select('*', { count: 'exact', head: true });
    console.log("Total movements count:", count);

    const { data: cartolas } = await supabase.from('banco_cartolas').select('*');
    console.log("Cartolas count:", cartolas?.length);
    console.log("Cartolas sample:", JSON.stringify(cartolas?.slice(0, 3), null, 2));
}

checkData();
