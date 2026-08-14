const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking and cleaning up catalogo_segmentos in Supabase...");
  
  // 1. Delete 'Mineras' and 'Expomin' from catalogo_segmentos
  const { data: delData, error: delError } = await supabase
    .from("catalogo_segmentos")
    .delete()
    .in("nombre", ["Mineras", "Expomin"]);

  if (delError) {
    console.error("Error deleting obsolete segments:", delError);
  } else {
    console.log("Successfully deleted 'Mineras' and 'Expomin' from catalog table.");
  }

  // 2. Fetch remaining segments to verify
  const { data: segments, error: getError } = await supabase
    .from("catalogo_segmentos")
    .select("nombre");

  if (getError) {
    console.error("Error fetching catalog segments:", getError);
  } else {
    console.log("Remaining segments in DB catalog:", segments.map(s => s.nombre));
  }
}

run();
