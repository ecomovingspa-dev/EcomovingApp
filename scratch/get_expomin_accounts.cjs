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
    .eq("segmento", "Expomin");

  if (error) {
    console.error("Error querying Expomin accounts:", error);
  } else {
    console.log("Cuentas con segmento 'Expomin':", JSON.stringify(data, null, 2));
  }
}

run();
