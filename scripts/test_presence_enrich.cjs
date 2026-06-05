const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("🚀 Iniciando prueba de Validación de Presencia y Corrección de Segmentos...");

  try {
    // ----------------------------------------------------
    // TEST 1: Empresa internacional sin presencia en Chile
    // ----------------------------------------------------
    const companyNoPresence = "Shenzhen Heavy Industries";
    console.log(`\n➕ [TEST 1] Creando cuenta de prueba sin filial chilena: "${companyNoPresence}"...`);
    
    await supabase.from('cuentas').delete().eq('cliente', companyNoPresence);
    
    const { data: acc1, error: err1 } = await supabase
      .from('cuentas')
      .insert([
        {
          cliente: companyNoPresence,
          estado: 'activo',
          ciudad: 'Santiago',
          origen: 'manual'
        }
      ])
      .select('id')
      .single();

    if (err1) throw err1;
    console.log(`✅ Cuenta temporal para Test 1 creada con ID: ${acc1.id}`);

    // invocar API
    console.log(`📡 Invocando API local para "${companyNoPresence}"...`);
    const resp1 = await axios.post('http://localhost:3001/api/enrich-accounts', {
      cuentaId: acc1.id
    });
    console.log("✨ Respuesta de la API:", JSON.stringify(resp1.data, null, 2));

    // Verificar en DB
    const { data: res1 } = await supabase
      .from('cuentas')
      .select('*')
      .eq('id', acc1.id)
      .single();

    console.log("🔍 Resultado en Base de Datos para Test 1:");
    console.log(` - Cliente: ${res1.cliente}`);
    console.log(` - Estado (debe ser inactivo): ${res1.estado}`);
    console.log(` - Segmento (debe ser 'Internacional (Sin filial)'): ${res1.segmento}`);
    console.log(` - Origen: ${res1.origen}`);

    // ----------------------------------------------------
    // TEST 2: Empresa local con segmento previo incorrecto
    // ----------------------------------------------------
    const companyCorrectSegment = "Salfa Motors";
    console.log(`\n➕ [TEST 2] Creando cuenta con segmento previo incorrecto: "${companyCorrectSegment}"...`);
    
    await supabase.from('cuentas').delete().eq('cliente', companyCorrectSegment);
    
    const { data: acc2, error: err2 } = await supabase
      .from('cuentas')
      .insert([
        {
          cliente: companyCorrectSegment,
          estado: 'activo',
          segmento: 'Gran Empresa', // Segmento incorrecto/antiguo
          ciudad: 'Santiago',
          origen: 'manual'
        }
      ])
      .select('id')
      .single();

    if (err2) throw err2;
    console.log(`✅ Cuenta temporal para Test 2 creada con ID: ${acc2.id}`);

    // invocar API
    console.log(`📡 Invocando API local para "${companyCorrectSegment}"...`);
    const resp2 = await axios.post('http://localhost:3001/api/enrich-accounts', {
      cuentaId: acc2.id
    });
    console.log("✨ Respuesta de la API:", JSON.stringify(resp2.data, null, 2));

    // Verificar en DB
    const { data: res2 } = await supabase
      .from('cuentas')
      .select('*')
      .eq('id', acc2.id)
      .single();

    console.log("🔍 Resultado en Base de Datos para Test 2:");
    console.log(` - Cliente: ${res2.cliente}`);
    console.log(` - Estado (debe seguir activo/prospecto): ${res2.estado}`);
    console.log(` - Segmento (debe corregirse a 'Automotoras'): ${res2.segmento}`);
    console.log(` - Origen: ${res2.origen}`);

    // Limpieza
    console.log("\n🧹 Limpiando cuentas temporales de prueba...");
    await supabase.from('cuentas').delete().eq('cliente', companyNoPresence);
    await supabase.from('cuentas').delete().eq('cliente', companyCorrectSegment);
    console.log("✅ Limpieza completada.");

  } catch (err) {
    console.error("❌ Error durante la ejecución del test:", err.message);
    if (err.response) {
      console.error("Detalle error API:", err.response.data);
    }
  }
}

runTest();
