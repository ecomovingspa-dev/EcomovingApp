const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("🚀 Iniciando normalización de Sector y Segmento en Supabase...");
  
  // 1. Obtener todas las cuentas
  const { data: accounts, error } = await supabase
    .from('cuentas')
    .select('id, cliente, sector, segmento');
    
  if (error) {
    console.error("❌ Error al obtener cuentas:", error);
    return;
  }
  
  console.log(`📊 Total cuentas recuperadas: ${accounts.length}`);
  
  let publicCount = 0;
  let privateCount = 0;
  let updatedCount = 0;
  
  for (const account of accounts) {
    let updatedSector = account.sector;
    let updatedSegment = account.segmento;
    let needsUpdate = false;
    
    const name = (account.cliente || '').toLowerCase();
    
    // Clasificar sector
    if (!updatedSector || updatedSector.trim() === '') {
      const isPublic = 
        name.includes('municipal') ||
        name.includes('corporacion municipal') ||
        name.includes('ministerio') ||
        name.includes('gobierno') ||
        name.includes('hospital') ||
        name.includes('servicio de salud') ||
        name.includes('ilustre') ||
        name.includes('carabineros') ||
        name.includes('fuerzas armadas') ||
        name.includes('serviu') ||
        name.includes('intendencia') ||
        name.includes('tesoreria') ||
        name.includes('senado') ||
        name.includes('camara de diputados');
        
      updatedSector = isPublic ? 'público' : 'privado';
      needsUpdate = true;
    }
    
    if (updatedSector === 'público') {
      publicCount++;
    } else {
      privateCount++;
    }
    
    // Clasificar segmento
    if (!updatedSegment || updatedSegment.trim() === '' || updatedSegment === 'Mediana Empresa' || updatedSegment === 'Pequeña Empresa' || updatedSegment === 'Gran Empresa') {
      needsUpdate = true;
      if (updatedSector === 'público') {
        updatedSegment = 'Servicios Públicos';
      } else {
        // Reglas de negocio privadas
        if (
          name.includes('auto') ||
          name.includes('vehiculo') ||
          name.includes('motors') ||
          name.includes('garage') ||
          name.includes('taller') ||
          name.includes('repuesto') ||
          name.includes('kaufmann') ||
          name.includes('chevrolet') ||
          name.includes('toyota') ||
          name.includes('hyundai') ||
          name.includes('ford') ||
          name.includes('automotriz')
        ) {
          updatedSegment = 'Automotoras';
        } else if (
          name.includes('clinica') ||
          name.includes('salud') ||
          name.includes('dental') ||
          name.includes('dent') ||
          name.includes('laboratorio') ||
          name.includes('medico') ||
          name.includes('sanatorio') ||
          name.includes('diagnostico')
        ) {
          updatedSegment = 'Salud';
        } else if (
          name.includes('minera') ||
          name.includes('mineria') ||
          name.includes('cobre') ||
          name.includes('metal') ||
          name.includes('acero') ||
          name.includes('fabrica') ||
          name.includes('industrial') ||
          name.includes('maestranza') ||
          name.includes('aceros') ||
          name.includes('manufactura') ||
          name.includes('fundicion')
        ) {
          updatedSegment = 'Minería / Industria';
        } else if (
          name.includes('constructora') ||
          name.includes('inmobiliaria') ||
          name.includes('obras') ||
          name.includes('edificacion') ||
          name.includes('construccion') ||
          name.includes('ingenieria y construccion')
        ) {
          updatedSegment = 'Constructoras / Inmobiliarias';
        } else if (
          name.includes('transporte') ||
          name.includes('logistica') ||
          name.includes('cargo') ||
          name.includes('flete') ||
          name.includes('bodega') ||
          name.includes('naviera') ||
          name.includes('mudanza') ||
          name.includes('distribucion')
        ) {
          updatedSegment = 'Logística / Transporte';
        } else if (
          name.includes('alimento') ||
          name.includes('agro') ||
          name.includes('frut') ||
          name.includes('gastronomia') ||
          name.includes('catering') ||
          name.includes('viña') ||
          name.includes('agricola') ||
          name.includes('pesquera') ||
          name.includes('restaurante') ||
          name.includes('ccu') ||
          name.includes('soprole') ||
          name.includes('agromarket')
        ) {
          updatedSegment = 'Alimentos / Agrícola';
        } else if (
          name.includes('comercial') ||
          name.includes('distribuidora') ||
          name.includes('retail') ||
          name.includes('importadora') ||
          name.includes('tienda') ||
          name.includes('venta') ||
          name.includes('comercio') ||
          name.includes('supermercado') ||
          name.includes('mall') ||
          name.includes('cencosud') ||
          name.includes('falabella') ||
          name.includes('ripley')
        ) {
          updatedSegment = 'Comercializadores';
        } else if (
          name.includes('servicios') ||
          name.includes('consultora') ||
          name.includes('tecnologia') ||
          name.includes('software') ||
          name.includes('seguridad') ||
          name.includes('aseo') ||
          name.includes('asesor') ||
          name.includes('publicidad') ||
          name.includes('marketing') ||
          name.includes('consultoria') ||
          name.includes('limpieza')
        ) {
          updatedSegment = 'Servicios';
        } else {
          updatedSegment = 'Servicios'; // Default
        }
      }
    }
    
    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('cuentas')
        .update({
          sector: updatedSector,
          segmento: updatedSegment
        })
        .eq('id', account.id);
        
      if (updateError) {
        console.error(`❌ Error actualizando cuenta ${account.cliente}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`\n🎉 Resumen del Proceso:`);
  console.log(` - Cuentas actualizadas: ${updatedCount}`);
  console.log(` - Sector Público total: ${publicCount}`);
  console.log(` - Sector Privado total: ${privateCount}`);
}

run();
