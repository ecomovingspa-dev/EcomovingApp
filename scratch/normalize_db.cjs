const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Normalizing etapa_prospeccion values in database...");
  
  // Update all NULL or non-Verificado values to 'Sin Verificar'
  try {
    const { error: updErr } = await supabase
      .from("cuentas")
      .update({ etapa_prospeccion: "Sin Verificar" })
      .or("etapa_prospeccion.is.null,etapa_prospeccion.neq.Verificado");
    
    if (updErr) throw updErr;
    console.log("Database normalized successfully!");
  } catch (error) {
    console.error("Error during normalization:", error);
  }
}

run();
