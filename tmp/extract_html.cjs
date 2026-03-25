const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function extractHtml() {
  const { data: stages, error } = await supabase
    .from('marketing')
    .select('*')
    .order('nombre_envio', { ascending: true });

  if (error) {
    console.error(error);
  } else {
    stages.forEach((s, index) => {
      let html = s.cuerpo_html || '';
      // Simulate the replacement done in cron-daily
      if (s.imagen_url) {
        html = html.replace(/IMAGE_PLACEHOLDER/g, s.imagen_url);
      }
      const filename = path.join('c:\\Users\\Mario\\Desktop\\Replit\\React-Vite-Starter\\tmp', `marketing_stage_${s.nombre_envio}.html`);
      fs.writeFileSync(filename, html);
      console.log(`Saved stage ${s.nombre_envio} to ${filename}`);
    });
  }
}

extractHtml();
