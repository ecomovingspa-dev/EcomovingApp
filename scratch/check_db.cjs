const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking DB connection...");
  const { data: catalog, error: catalogError } = await supabase
    .from("catalogo_segmentos")
    .select("*")
    .limit(5);

  if (catalogError) {
    console.error("Error querying catalogo_segmentos:", catalogError);
  } else {
    console.log("catalogo_segmentos table exists. Rows:", catalog);
  }

  const { data: cuentas, error: cuentasError } = await supabase
    .from("cuentas")
    .select("id, cliente, segmento")
    .limit(5);

  if (cuentasError) {
    console.error("Error querying cuentas:", cuentasError);
  } else {
    console.log("cuentas table exists. Rows:", cuentas);
  }
}

check();
