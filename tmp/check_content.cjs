const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContent() {
  const { data, error } = await supabase
    .from('marketing')
    .select('*')
    .eq('nombre_envio', 1)
    .maybeSingle();

  if (error) {
    console.error(error);
  } else if (data) {
    console.log('--- CONTENIDO ETAPA 1 ---');
    console.log(`Asunto: ${data.asunto}`);
    console.log(`Imagen URL: ${data.imagen_url}`);
    console.log(`HTML Length: ${data.cuerpo_html?.length || 0}`);
    console.log('--- PREVIEW HTML (Primeros 200 caracteres) ---');
    console.log(data.cuerpo_html?.substring(0, 200));
  }
}

checkContent();
