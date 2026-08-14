const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, count, error } = await supabase
    .from("cuentas")
    .select("id, cliente, segmento", { count: 'exact' })
    .eq("segmento", "Expomin");

  if (error) {
    console.error("Error querying Expomin accounts:", error);
  } else {
    console.log(`Total Cuentas con segmento 'Expomin': ${count}`);
    console.log("Muestra de primeras 10 cuentas:");
    console.log(data.slice(0, 10));
  }
}

run();
