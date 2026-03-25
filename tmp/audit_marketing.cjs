const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAudit() {
  console.log('--- AUDITORÍA DE MARKETING ---');
  
  const { data: marketing, error: mError } = await supabase
    .from('marketing')
    .select('*')
    .order('nombre_envio', { ascending: true });
    
  if (mError) {
    console.error('Error marketing:', mError);
  } else {
    console.log(`Contenidos en tabla marketing: ${marketing?.length || 0}`);
    marketing?.forEach(m => {
      console.log(`Etapa ${m.nombre_envio}: ${m.asunto} (Activo: ${m.activo})`);
    });
  }

  // Find the specific user email: mario@ecomoving.cl
  const { data: userContact, error: uError } = await supabase
    .from('contactos')
    .select('*')
    .eq('correo', 'mario@ecomoving.cl')
    .maybeSingle();

  if (uError) {
    console.error('Error buscando usuario:', uError);
  } else if (userContact) {
    console.log('\n--- ESTADO DEL USUARIO (mario@ecomoving.cl) ---');
    console.log(`ID: ${userContact.id}`);
    console.log(`Nombre: ${userContact.nombre}`);
    console.log(`Estado: ${userContact.estado}`);
    console.log(`Etapa de envío: ${userContact.etapa_envio}`);
    console.log(`Último envío: ${userContact.ultimo_envio}`);
    console.log(`Próximo envío: ${userContact.proximo_envio}`);
  } else {
    console.log('\nUsuario mario@ecomoving.cl no encontrado en la tabla de contactos.');
  }

  // Count distribution of stages
  const { data: stats, error: sError } = await supabase
    .from('contactos')
    .select('etapa_envio');
    
  if (!sError && stats) {
    const distribution = stats.reduce((acc, curr) => {
      acc[curr.etapa_envio] = (acc[curr.etapa_envio] || 0) + 1;
      return acc;
    }, {});
    console.log('\nDistribución de Etapas (Contactos Totales):', distribution);
  }
}

checkAudit();
