const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const targetContactIds = [
  'd5e4a7ea-6136-4601-a1d1-b6ef38a64955', // Tomas Osorio (marioosorio2408@gmail.com)
  'ee245be4-82b3-48e2-acca-e18d750cd38c', // Ignacio Osorio (tinypuertecillospa@gmail.com)
  'fe81fbe6-b1d9-42f2-a96b-87bdf35df8c4', // Carol Yevenes (carol.yevenes@proingas.cl)
  '7107af62-40b6-4cc2-95aa-7561d126ad96', // ecomovingspa@gmail.com contact
  'b40bf0be-6fd1-44ea-8ed5-88f57ae30a1e'  // jimena@ecomoving.cl contact
];

async function run() {
  console.log("Starting cleanup for test contacts...");

  // 1. Delete events in trazabilidad_correos for target contact IDs
  const { data: delData, error: delError } = await supabase
    .from("trazabilidad_correos")
    .delete()
    .in("contacto_id", targetContactIds);

  if (delError) {
    console.error("Error deleting trazabilidad events:", delError);
  } else {
    console.log("Successfully cleared tracking events in trazabilidad_correos!");
  }

  // 2. Reset the fields on the contactos table
  const { data: upData, error: upError } = await supabase
    .from("contactos")
    .update({
      ultimo_envio: null,
      ultimo_estado_brevo: null,
      ultimo_evento_trazabilidad: null
    })
    .in("id", targetContactIds);

  if (upError) {
    console.error("Error resetting contact statuses:", upError);
  } else {
    console.log("Successfully reset CRM stats for the test contacts!");
  }
}

run();
