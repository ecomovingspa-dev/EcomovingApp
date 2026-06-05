const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEnrich() {
  console.log("🚀 Iniciando Test de Integración End-to-End del Endpoint de Enriquecimiento...");
  
  try {
    // 1. Crear una nueva cuenta de prueba en estado 'activo'
    const testCompanyName = "Bridon Bekaert Chile";
    console.log(`➕ Creando cuenta temporal de prueba: "${testCompanyName}"...`);
    
    // Primero, limpiar si ya existe
    await supabase.from('cuentas').delete().eq('cliente', testCompanyName);
    
    const { data: newAccount, error: createError } = await supabase
      .from('cuentas')
      .insert([
        {
          cliente: testCompanyName,
          estado: 'activo', // Gatillante de búsqueda
          ciudad: 'Santiago',
          origen: 'manual'
        }
      ])
      .select('id')
      .single();
      
    if (createError) {
      throw new Error(`Error al crear cuenta: ${createError.message}`);
    }
    
    const cuentaId = newAccount.id;
    console.log(`✅ Cuenta de prueba creada con ID: ${cuentaId}`);
    
    // 2. Invocar el endpoint de enriquecimiento local
    console.log(`📡 Invocando API local: http://localhost:3001/api/enrich-accounts...`);
    const response = await axios.post('http://localhost:3001/api/enrich-accounts', {
      cuentaId: cuentaId
    });
    
    console.log("✨ Respuesta de la API de Enriquecimiento:");
    console.log(JSON.stringify(response.data, null, 2));
    
    // 3. Consultar los datos finales en Supabase para verificar
    console.log("\n🔎 Verificando datos guardados en Supabase...");
    const { data: updatedAccount } = await supabase
      .from('cuentas')
      .select('*')
      .eq('id', cuentaId)
      .single();
      
    console.log("Cuenta en DB:", {
      cliente: updatedAccount.cliente,
      web: updatedAccount.web,
      telefono: updatedAccount.telefono,
      sector: updatedAccount.sector,
      segmento: updatedAccount.segmento,
      origen: updatedAccount.origen
    });
    
    const { data: contacts } = await supabase
      .from('contactos')
      .select('*')
      .eq('cuenta_id', cuentaId);
      
    console.log("Contactos creados en DB:");
    contacts.forEach(c => {
      console.log(` - Nombre: ${c.nombre} | Correo: ${c.correo} | Estado: ${c.estado} | Etapa: ${c.etapa} | Origen: ${c.origen}`);
    });
    
  } catch (err) {
    console.error("❌ Error en la prueba de integración:", err.message);
    if (err.response) {
      console.error("Detalle error API:", err.response.data);
    }
  }
}

testEnrich();
