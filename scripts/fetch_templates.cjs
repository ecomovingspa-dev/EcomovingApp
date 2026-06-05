const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("--- PLANTILLAS DE PROSPECCIÓN (configuracion_prospeccion) ---");
    const { data: prospeccion, error: err1 } = await supabase
      .from('configuracion_prospeccion')
      .select('*')
      .order('orden', { ascending: true });

    if (err1) {
      console.error(err1);
    } else {
      prospeccion.forEach(p => {
        console.log(`\nOrden ${p.orden}: ${p.asunto_template}`);
        console.log(`Intro: ${p.mensaje_intro}`);
        console.log(`Cierre: ${p.mensaje_cierre}`);
      });
    }

    console.log("\n--- PLANTILLAS DE MARKETING (marketing) ---");
    const { data: marketing, error: err2 } = await supabase
      .from('marketing')
      .select('nombre_envio, asunto, cuerpo')
      .order('nombre_envio', { ascending: true });

    if (err2) {
      console.error(err2);
    } else {
      marketing.forEach(m => {
        console.log(`\nEtapa ${m.nombre_envio}: ${m.asunto}`);
        console.log(`Cuerpo: ${m.cuerpo}`);
      });
    }

  } catch (err) {
    console.error(err);
  }
}

run();
