const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_DOMAINS = ['www.yapur.cl', 'www.blastpaint.cl', 'www.grupoinl.com', 'www.dipro-tec.cl', 'www.milanfabjanovic.cl'];
const TEST_EMAILS = ['contacto@yapur.cl', 'ventas@blastpaint.cl', 'info@grupoinl.com', 'ventas@dipro-tec.cl', 'contacto@milanfabjanovic.cl'];

async function updateOrigen() {
  console.log("⚡ Iniciando actualización de registros de prueba con origen = 'AI'...");
  
  try {
    // 1. Actualizar Cuentas
    const { data: updatedCuentas, error: errorCuentas } = await supabase
      .from('cuentas')
      .update({ origen: 'AI' })
      .in('web', TEST_DOMAINS)
      .select('id, cliente');
      
    if (errorCuentas) {
      console.error("❌ Error actualizando origen en cuentas:", errorCuentas.message);
    } else {
      console.log(`✅ Cuentas actualizadas con origen 'AI' (${updatedCuentas.length} registros):`, updatedCuentas.map(c => c.cliente));
    }
    
    // 2. Actualizar Contactos
    const { data: updatedContactos, error: errorContactos } = await supabase
      .from('contactos')
      .update({ origen: 'AI' })
      .in('correo', TEST_EMAILS)
      .select('id, correo');
      
    if (errorContactos) {
      console.error("❌ Error actualizando origen en contactos:", errorContactos.message);
    } else {
      console.log(`✅ Contactos actualizados con origen 'AI' (${updatedContactos.length} registros):`, updatedContactos.map(c => c.correo));
    }
    
  } catch (e) {
    console.error("❌ Error general:", e);
  }
}

updateOrigen();
