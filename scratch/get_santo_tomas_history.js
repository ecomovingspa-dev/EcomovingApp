import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSantoTomasHistory() {
  console.log("=== INICIANDO BÚSQUEDA PARA UNIVERSIDAD SANTO TOMÁS ===\n");

  // 1. Buscar la cuenta
  const { data: cuentas, error: errCuentas } = await supabase
    .from('cuentas')
    .select('*')
    .or('cliente.ilike.%Santo Tomás%,cliente.ilike.%Santo Tomas%');

  if (errCuentas) {
    console.error("Error al buscar cuentas:", errCuentas);
    return;
  }

  if (!cuentas || cuentas.length === 0) {
    console.log("No se encontraron cuentas con el nombre 'Santo Tomás'.");
    return;
  }

  console.log(`Se encontraron ${cuentas.length} cuentas:`);
  cuentas.forEach(c => {
    console.log(`- ID: ${c.id} | Cliente: ${c.cliente} | RUT: ${c.rut} | Sector: ${c.sector} | Segmento: ${c.segmento}`);
  });
  console.log("\n--------------------------------------------------\n");

  const cuentaIds = cuentas.map(c => c.id);
  const ruts = cuentas.map(c => c.rut).filter(Boolean);

  // 2. Buscar cotizaciones asociadas a las cuentas encontradas
  const { data: cotizaciones, error: errCotizaciones } = await supabase
    .from('cotizaciones')
    .select('*')
    .in('cuenta_id', cuentaIds)
    .order('created_at', { ascending: false });

  if (errCotizaciones) {
    console.error("Error al buscar cotizaciones:", errCotizaciones);
  } else {
    console.log(`Se encontraron ${cotizaciones ? cotizaciones.length : 0} cotizaciones:`);
    if (cotizaciones && cotizaciones.length > 0) {
      cotizaciones.forEach(cot => {
        console.log(`- Nº: ${cot.numero_cotizacion} | Nombre: ${cot.nombre} | Estado: ${cot.estado_cotizacion} | Total Neto: $${cot.total_neto} | Total: $${cot.total} | Fecha: ${cot.created_at}`);
      });
    } else {
      console.log("Sin cotizaciones registradas.");
    }
  }
  console.log("\n--------------------------------------------------\n");

  // 3. Buscar ventas asociadas
  const { data: ventas, error: errVentas } = await supabase
    .from('ventas')
    .select('*');

  if (errVentas) {
    console.error("Error al buscar ventas:", errVentas);
  } else {
    // Filtrar en memoria por Universidad Santo Tomás
    const filteredVentas = ventas.filter(v => {
      const nameMatch = v.rzn_soc_recep && (v.rzn_soc_recep.toLowerCase().includes('santo tomás') || v.rzn_soc_recep.toLowerCase().includes('santo tomas'));
      const rutMatch = ruts.some(r => {
        const cleanR = r.replace(/\./g, '').replace(/-/g, '').toLowerCase().trim();
        const cleanV = v.rut_recep ? v.rut_recep.replace(/\./g, '').replace(/-/g, '').toLowerCase().trim() : '';
        return cleanV.includes(cleanR) || cleanR.includes(cleanV);
      });
      return nameMatch || rutMatch;
    });

    console.log(`Se encontraron ${filteredVentas.length} ventas (facturas):`);
    if (filteredVentas.length > 0) {
      filteredVentas.forEach(v => {
        console.log(`- Folio: ${v.folio} | Razón Social: ${v.rzn_soc_recep} | RUT: ${v.rut_recep} | Total Facturado: $${v.mnt_total} | Saldo Pendiente: $${v.saldo} | Estado: ${v.estado_deuda} | Emisión: ${v.fch_emis}`);
      });
    } else {
      console.log("Sin facturas registradas en la tabla ventas.");
    }
  }
  console.log("\n======================================================\n");
}

getSantoTomasHistory();
