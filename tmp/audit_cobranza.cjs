const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditCobranza() {
  console.log('--- AUDITORÍA DE CONFIGURACIÓN DE COBRANZA ---');
  
  const { data: config, error: cError } = await supabase
    .from('configuracion_cobranza')
    .select('*')
    .eq('activo', true)
    .order('dias_min', { ascending: true });
    
  if (cError) {
    console.error('Error config cobranza:', cError);
  } else {
    console.log(`Configuraciones ACTIVAS: ${config?.length || 0}`);
    config?.forEach(c => {
      console.log(`- [${c.etiqueta}] Range: ${c.dias_min} to ${c.dias_max} days. Template: "${c.asunto_template}"`);
    });
  }

  // Check for any bills that might be sent tomorrow
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const { data: bills, error: bError } = await supabase
    .from('ventas')
    .select('folio, fch_venc, mnt_total, correo_cobranza, estado_deuda')
    .neq('estado_deuda', 'Pagada')
    .gt('saldo', 0)
    .limit(5);

  if (bError) {
    console.error('Error facturas:', bError);
  } else {
    console.log('\n--- FACTURAS PENDIENTES (Muestra de 5) ---');
    bills?.forEach(b => {
      const fchVenc = new Date(b.fch_venc);
      const diff = Math.floor((hoy - fchVenc) / (1000 * 60 * 60 * 24));
      console.log(`Folio: ${b.folio}, Venc: ${b.fch_venc}, Atraso: ${diff} días, Correo: ${b.correo_cobranza}`);
    });
  }
}

auditCobranza();
