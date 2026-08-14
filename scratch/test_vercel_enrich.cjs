const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Buscar el ID de Simma
    const { data: Simma, error } = await supabase
      .from("cuentas")
      .select("id")
      .eq("cliente", "Simma")
      .single();

    if (error || !Simma) {
      console.log("No se encontró la cuenta Simma en la DB.");
      return;
    }

    console.log("ID de Simma:", Simma.id);

    // 2. Invocar la API en Vercel
    console.log("Invocando API en Vercel...");
    const response = await axios.post("https://ecomoving-app.vercel.app/api/enrich-accounts", {
      cuentaId: Simma.id
    });

    console.log("Respuesta Vercel:", JSON.stringify(response.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.error("Vercel HTTP Status:", e.response.status);
      console.error("Vercel Response Data:", JSON.stringify(e.response.data, null, 2));
    } else {
      console.error("Error:", e.message);
    }
  }
}

run();
