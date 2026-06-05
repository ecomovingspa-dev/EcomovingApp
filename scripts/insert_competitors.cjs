const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPETITORS = [
  {
    cliente: 'Yapur S.A.',
    web: 'www.yapur.cl',
    domain: 'yapur.cl',
    sector: 'Venta de equipos de pintado industrial (Graco)',
    segmento: 'Mediana Empresa',
    correoContacto: 'contacto@yapur.cl'
  },
  {
    cliente: 'BlastPaint',
    web: 'www.blastpaint.cl',
    domain: 'blastpaint.cl',
    sector: 'Equipos de granallado y pintura industrial',
    segmento: 'Pequeña Empresa',
    correoContacto: 'ventas@blastpaint.cl'
  },
  {
    cliente: 'Grupo INL',
    web: 'www.grupoinl.com',
    domain: 'grupoinl.com',
    sector: 'Equipos industriales de pintado y acabados (Sames Kremlin)',
    segmento: 'Mediana Empresa',
    correoContacto: 'info@grupoinl.com'
  },
  {
    cliente: 'Dipro-Tec',
    web: 'www.dipro-tec.cl',
    domain: 'dipro-tec.cl',
    sector: 'Sistemas de pintura y mantenimiento Airless',
    segmento: 'Pequeña Empresa',
    correoContacto: 'ventas@dipro-tec.cl'
  },
  {
    cliente: 'Milan Fabjanovic y Cía Ltda',
    web: 'www.milanfabjanovic.cl',
    domain: 'milanfabjanovic.cl',
    sector: 'Pistolas de pulverización y herramientas SATA',
    segmento: 'Pequeña Empresa',
    correoContacto: 'contacto@milanfabjanovic.cl'
  }
];

async function insertWithoutDuplicating() {
  console.log("🚀 Iniciando inserción de competidores de prueba...");
  
  for (const comp of COMPETITORS) {
    try {
      console.log(`\n--------------------------------------------`);
      console.log(`🔎 Verificando existencia de: ${comp.cliente} (dominio: ${comp.domain})...`);
      
      // 1. Verificar si existe la cuenta por nombre o sitio web
      const { data: existingAccounts, error: searchError } = await supabase
        .from('cuentas')
        .select('id, cliente, web')
        .or(`cliente.ilike.%${comp.cliente.split(' ')[0]}%,web.ilike.%${comp.domain}%`);
        
      if (searchError) {
        console.error(`❌ Error al buscar cuenta ${comp.cliente}:`, searchError.message);
        continue;
      }
      
      let cuentaId;
      
      if (existingAccounts && existingAccounts.length > 0) {
        // Encontró coincidencia
        const match = existingAccounts[0];
        console.log(`⚠️ Cuenta ya existe en Supabase: "${match.cliente}" (ID: ${match.id}). Evitando duplicación.`);
        cuentaId = match.id;
      } else {
        // 2. Si no existe, insertar la cuenta
        console.log(`➕ Creando cuenta potencial: "${comp.cliente}"...`);
        const { data: newAccount, error: insertError } = await supabase
          .from('cuentas')
          .insert([
            {
              cliente: comp.cliente,
              web: comp.web,
              sector: comp.sector,
              segmento: comp.segmento,
              estado: 'prospecto', // Valor por defecto en la base de datos para cuentas en prospección
              ciudad: 'Santiago'
            }
          ])
          .select('id')
          .single();
          
        if (insertError) {
          console.error(`❌ Error al crear la cuenta ${comp.cliente}:`, insertError.message);
          continue;
        }
        
        cuentaId = newAccount.id;
        console.log(`✅ Cuenta creada exitosamente con ID: ${cuentaId}`);
      }
      
      // 3. Verificar si ya existe un contacto con el mismo correo corporativo
      const { data: existingContacts, error: contactSearchError } = await supabase
        .from('contactos')
        .select('id, nombre, correo')
        .eq('correo', comp.correoContacto);
        
      if (contactSearchError) {
        console.error(`❌ Error al buscar contacto con correo ${comp.correoContacto}:`, contactSearchError.message);
        continue;
      }
      
      if (existingContacts && existingContacts.length > 0) {
        const matchContact = existingContacts[0];
        console.log(`⚠️ El contacto con correo "${matchContact.correo}" (${matchContact.nombre}) ya existe. No se duplicará.`);
      } else {
        // 4. Crear el contacto 'Prospección' inactivo
        console.log(`➕ Creando contacto 'Prospección' asociado para: ${comp.correoContacto}...`);
        const { data: newContact, error: contactInsertError } = await supabase
          .from('contactos')
          .insert([
            {
              nombre: 'Prospección',
              correo: comp.correoContacto,
              estado: 'inactivo', // Siempre inactivo como acordamos
              etapa: 'prospeccion', // Etapa inicial de prospección
              cuenta_id: cuentaId,
              ciudad: 'Santiago'
            }
          ])
          .select('id');
          
        if (contactInsertError) {
          console.error(`❌ Error al crear contacto para ${comp.cliente}:`, contactInsertError.message);
        } else {
          console.log(`✅ Contacto 'Prospección' insertado correctamente.`);
        }
      }
      
    } catch (e) {
      console.error(`❌ Excepción al procesar ${comp.cliente}:`, e);
    }
  }
  
  console.log(`\n🎉 Proceso finalizado.`);
}

insertWithoutDuplicating();
