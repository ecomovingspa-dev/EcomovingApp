import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getHotLeads() {
    console.log('--- BUSCANDO HOT LEADS (OPENED) ---');
    const { data, error } = await supabase
        .from('contactos')
        .select('nombre, cargo, empresa, ultimo_estado_brevo, ultimo_envio, email')
        .eq('ultimo_estado_brevo', 'opened')
        .order('ultimo_envio', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No se encontraron hot leads con estado "opened".');
    } else {
        console.table(data);
    }

    console.log('\n--- ANALIZANDO REBOTES/BLOQUEOS ---');
    const { data: issues, error: errorIssues } = await supabase
        .from('contactos')
        .select('nombre, empresa, ultimo_estado_brevo, email')
        .in('ultimo_estado_brevo', ['deferred', 'hard_bounce', 'soft_bounce', 'blocked', 'spam'])
        .limit(5);

    if (errorIssues) {
        console.error('Error:', errorIssues);
        return;
    }
    
    if (issues.length === 0) {
        console.log('No hay rebotes o bloqueos críticos recientes.');
    } else {
        console.table(issues);
    }
}

getHotLeads();
