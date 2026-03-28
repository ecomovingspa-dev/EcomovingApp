import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeHotLeads() {
    let output = '--- ANALIZANDO HOT LEADS (OPENED/CLICK) ---\n';
    const { data: contacts, error: errC } = await supabase
        .from('contactos')
        .select('*')
        .in('ultimo_estado_brevo', ['opened', 'click'])
        .order('ultimo_envio', { ascending: false })
        .limit(20);

    if (errC) { output += JSON.stringify(errC); fs.writeFileSync('C:/Users/Mario/Desktop/Replit/React-Vite-Starter/hot_leads_report.txt', output); return; }

    const cuentaIds = [...new Set(contacts.map(c => c.cuenta_id).filter(Boolean))];
    const { data: cuentas, error: errQ } = await supabase
        .from('cuentas')
        .select('id, cliente')
        .in('id', cuentaIds);

    const cuentasMap = (cuentas || []).reduce((acc, c) => ({ ...acc, [c.id]: c.cliente }), {});

    if (contacts.length === 0) {
        output += 'No se detectaron Hot Leads recientes.\n';
    } else {
        contacts.forEach(c => {
            output += `Nombre: ${c.nombre} | Empresa: ${cuentasMap[c.cuenta_id] || 'N/A'} | Estado: ${c.ultimo_estado_brevo} | Envío: ${c.ultimo_envio}\n`;
        });
    }
    
    fs.writeFileSync('C:/Users/Mario/Desktop/Replit/React-Vite-Starter/hot_leads_report.txt', output);
}

analyzeHotLeads();
