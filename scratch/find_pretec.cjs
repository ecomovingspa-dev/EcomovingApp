const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, cliente, segmento, sector")
    .ilike("cliente", "%pretec%");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Cuentas que contienen 'Pretec':", data);
  }
}

run();
