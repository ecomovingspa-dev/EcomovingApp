const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: accounts, error } = await supabase
    .from("cuentas")
    .select("cliente, web, ciudad, sector, segmento, estado, etapa_prospeccion, origen")
    .eq("origen", "AI")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching accounts:", error);
    return;
  }

  console.log("Recently created AI accounts:");
  accounts.forEach(a => {
    console.log(` - Cliente: ${a.cliente} | Web: ${a.web} | Segmento: ${a.segmento} | Etapa: ${a.etapa_prospeccion} | Estado: ${a.estado}`);
  });
}

run();
