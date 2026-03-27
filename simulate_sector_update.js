import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PUBLIC_KEYWORDS = [
  "MUNICIPALIDAD", "MUNI", "MINISTERIO", "SUBSECRETARIA", "HOSPITAL", 
  "SERVICIO DE SALUD", "BIBLIOTECA DEL CONGRESO", "CARABINEROS", 
  "EJERCITO", "ARMADA", "FUERZA AEREA", "PDI", "CONTRALORIA", 
  "TESORERIA", "SII", "SENCE", "JUNJI", "INTEGRA", "UNIVERSIDAD DE CHILE", 
  "UNIVERSIDAD DE SANTIAGO", "USACH", "DEMRE", "PODER JUDICIAL", 
  "CORTE SUPREMA", "SENADO", "CAMARA DE DIPUTADOS", "GOBIERN", "FISCALIA"
];

function classify(name) {
  if (!name) return "Privado";
  const upper = name.toUpperCase();
  if (PUBLIC_KEYWORDS.some(k => upper.includes(k))) return "Público";
  return "Privado";
}

async function simulate() {
  const { data, error } = await supabase
    .from('cuentas')
    .select('id, cliente, sector')
    .limit(200);

  if (error) {
    console.error(error);
    return;
  }

  const result = {
    total: data.length,
    toPublic: [],
    toPrivate: [],
    alreadyCorrect: 0,
    changed: 0
  };

  data.forEach(c => {
    const suggested = classify(c.cliente);
    if (c.sector === suggested) {
      result.alreadyCorrect++;
    } else {
      result.changed++;
      if (suggested === "Público") {
        result.toPublic.push({ name: c.cliente, old: c.sector });
      } else {
        result.toPrivate.push({ name: c.cliente, old: c.sector });
      }
    }
  });

  console.log(JSON.stringify(result, null, 2));
}

simulate();
