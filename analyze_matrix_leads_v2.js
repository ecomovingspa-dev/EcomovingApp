import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeHotLeads() {
    console.log('--- ANALIZANDO HOT LEADS (OPENED/CLICK) ---');
    const { data: contacts, error: errC } = await supabase
        .from('contactos')
        .select('*')
        .in('ultimo_estado_brevo', ['opened', 'click'])
        .order('ultimo_envio', { ascending: false })
        .limit(20);

    if (errC) { console.error(errC); return; }

    const cuentaIds = [...new Set(contacts.map(c => c.cuenta_id).filter(Boolean))];
    const { data: cuentas, error: errQ } = await supabase
        .from('cuentas')
        .select('id, cliente')
        .in('id', cuentaIds);

    const cuentasMap = (cuentas || []).reduce((acc, c) => ({ ...acc, [c.id]: c.cliente }), {});

    if (contacts.length === 0) {
        console.log('No se detectaron Hot Leads recientes.');
    } else {
        const formatted = contacts.map(c => ({
            Nombre: c.nombre,
            Empresa: cuentasMap[c.cuenta_id] || 'N/A',
            Estado: c.ultimo_estado_brevo,
            'Último Envío': c.ultimo_envio ? new Date(c.ultimo_envio).toLocaleString() : 'N/A'
        }));
        console.table(formatted);
    }
}

analyzeHotLeads();
