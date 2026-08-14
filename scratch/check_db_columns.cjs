const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Check one row of accounts
  const { data: accounts, error: err1 } = await supabase
    .from("cuentas")
    .select("*")
    .limit(1);

  if (err1) {
    console.error("Error reading accounts table:", err1);
  } else {
    console.log("Cuentas columns:", Object.keys(accounts[0] || {}));
  }

  // Check one row of contactos
  const { data: contactos, error: err2 } = await supabase
    .from("contactos")
    .select("*")
    .limit(1);

  if (err2) {
    console.error("Error reading contactos table:", err2);
  } else {
    console.log("Contactos columns:", Object.keys(contactos[0] || {}));
  }
}

run();
