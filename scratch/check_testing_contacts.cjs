const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: contacts, error } = await supabase
    .from("contactos")
    .select("id, nombre, correo, etapa, estado, correo_cortesia_vendedor, ultimo_estado_brevo, ultimo_evento_trazabilidad, imagen")
    .or("nombre.ilike.%Cristian Caldera%,nombre.ilike.%Carol Yevenes%");

  if (error) {
    console.error("Error fetching testing contacts:", error);
  } else {
    console.log("Testing contacts data:", contacts);
  }

  // Also let's check recent rows in trazabilidad_correos
  const { data: events, error: err2 } = await supabase
    .from("trazabilidad_correos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (err2) {
    console.error("Error fetching recent events:", err2);
  } else {
    console.log("Recent trazabilidad events:", events);
  }
}

run();
