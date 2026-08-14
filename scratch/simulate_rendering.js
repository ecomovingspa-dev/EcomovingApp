import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Generate calendar days for June 2026 (Month index 5)
    const days = [];
    const year = 2026;
    const month = 5; // June
    
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push({
          date: date.toISOString().split('T')[0],
          label: `${date.getDate()}`,
          isWorkingDay: true
        });
      }
      date.setDate(date.getDate() + 1);
    }

    console.log('Generated Days (sample):', days.slice(0, 10));

    // 2. Fetch contacts (prospeccion/marketing)
    const { data: contactsData } = await supabase
      .from("contactos")
      .select("*")
      .in("etapa", ["prospeccion", "marketing"])
      .eq("estado", "activo")
      .not("correo", "is", null)
      .neq("correo", "")
      .order("nombre", { ascending: true });

    // 3. Fetch history
    const { data: hData } = await supabase
      .from("trazabilidad_correos")
      .select("*")
      .gte("fecha", days[0]?.date || '2026-03-01');

    console.log(`\nFetched ${contactsData?.length} contacts.`);
    console.log(`Fetched ${hData?.length} history records.`);

    // Find Cimtec
    const cimtec = contactsData?.find(c => c.correo.includes('recepcion@cimtec.cl'));
    if (!cimtec) {
        console.log('Cimtec not found in active contacts!');
        return;
    }

    console.log('\nFound Cimtec in active contacts:');
    console.log(cimtec);

    // Merge history
    const historyForCimtec = (hData || []).filter(h => h.email === cimtec.correo || h.contacto_id === cimtec.id);
    console.log(`\nFiltered history for Cimtec (count: ${historyForCimtec.length}):`);
    console.log(historyForCimtec);

    // Check match for each day
    console.log('\nMatching against calendar days:');
    days.forEach(d => {
        const matchingEvents = historyForCimtec.filter(h => h.fecha === d.date);
        if (matchingEvents.length > 0) {
            console.log(`  - Day ${d.date}: matches event status: "${matchingEvents[0].estado}"`);
        }
    });
}

run();
