const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, cliente, sector")
    .ilike("cliente", "%univer%");
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Cuentas with 'univer' found:", data.length);
    console.log("Matching accounts:", data);
  }
}

test();
