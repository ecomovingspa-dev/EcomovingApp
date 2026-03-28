import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeHotLeads() {
    console.log('--- ANALIZANDO HOT LEADS (OPENED) ---');
    // Fetch contacts with 'opened' status joining with cuentas
    const { data: hotLeads, error } = await supabase
        .from('contactos')
        .select('nombre, departamento, correo, ultimo_estado_brevo, ultimo_envio, cuentas(cliente)')
        .eq('ultimo_estado_brevo', 'opened')
        .order('ultimo_envio', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    if (hotLeads.length === 0) {
        console.log('No se detectaron Hot Leads (aberturas recientes) en la base de datos.');
    } else {
        const formatted = hotLeads.map(l => ({
            Contacto: l.nombre,
            Cargo: l.departamento || 'No especificado',
            Empresa: l.cuentas?.cliente || 'Personal/Sin cuenta',
            Estado: l.ultimo_estado_brevo,
            'Último Envío': l.ultimo_envio ? new Date(l.ultimo_envio).toLocaleString() : 'N/A'
        }));
        console.table(formatted);
    }

    console.log('\n--- CONTACTOS CON PROBLEMAS DE ENTREGA ---');
    const { data: issues, error: errorIssues } = await supabase
        .from('contactos')
        .select('nombre, correo, ultimo_estado_brevo, cuentas(cliente)')
        .in('ultimo_estado_brevo', ['deferred', 'hard_bounce', 'soft_bounce', 'blocked', 'spam'])
        .limit(5);

    if (errorIssues) {
        console.error('Error fetching issues:', errorIssues);
        return;
    }

    if (issues.length === 0) {
        console.log('No hay rebotes o bloqueos críticos detectados.');
    } else {
        const formattedIssues = issues.map(i => ({
            Contacto: i.nombre,
            Email: i.correo,
            Empresa: i.cuentas?.cliente || 'N/A',
            Problema: i.ultimo_estado_brevo
        }));
        console.table(formattedIssues);
    }
}

analyzeHotLeads();
