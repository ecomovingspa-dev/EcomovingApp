import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

dotenv.config({ path: '.env.local' });


const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching contacts and history from Supabase...');
    
    // Find contacts whose accounts or names might match the screenshot
    const { data: contacts, error } = await supabase
        .from('contactos')
        .select(`
            id,
            nombre,
            correo,
            etapa,
            estado,
            etapa_envio,
            ultimo_envio,
            proximo_envio,
            ultimo_estado_brevo,
            es_bloqueado,
            cuenta_id
        `);

    if (error) {
        console.error('Error fetching contacts:', error);
        return;
    }

    // Also get account names to identify them
    const { data: accounts } = await supabase.from('cuentas').select('id, cliente');
    const accMap = {};
    accounts?.forEach(a => { accMap[a.id] = a.cliente; });

    // Filter contacts that match our interest
    const targetTerms = ['metalbert', 'trucco', 'michilla', 'hca', 'minera'];
    const filteredContacts = contacts.filter(c => {
        const name = (c.nombre || '').toLowerCase();
        const email = (c.correo || '').toLowerCase();
        const accName = (accMap[c.cuenta_id] || '').toLowerCase();
        return targetTerms.some(term => name.includes(term) || email.includes(term) || accName.includes(term));
    });

    console.log(`Found ${filteredContacts.length} matching contacts:`);
    for (const c of filteredContacts) {
        console.log(`\n========================================`);
        console.log(`CONTACT: ${c.nombre} (${c.correo})`);
        console.log(`Empresa: ${accMap[c.cuenta_id] || 'N/A'}`);
        console.log(`Etapa: ${c.etapa} | Estado: ${c.estado}`);
        console.log(`Etapa Envío (número): ${c.etapa_envio}`);
        console.log(`Último Envío: ${c.ultimo_envio}`);
        console.log(`Próximo Envío: ${c.proximo_envio}`);
        console.log(`Último Estado Brevo: ${c.ultimo_estado_brevo}`);
        console.log(`Bloqueado: ${c.es_bloqueado}`);

        // Fetch history
        const { data: history, error: hError } = await supabase
            .from('trazabilidad_correos')
            .select('*')
            .eq('contacto_id', c.id)
            .order('fecha', { ascending: true });

        if (hError) {
            console.error(`Error fetching history for ${c.nombre}:`, hError);
        } else {
            console.log('Trazabilidad Correos (History):');
            if (!history || history.length === 0) {
                console.log('  No records in trazabilidad_correos');
            } else {
                console.table(history.map(h => ({
                    id: h.id,
                    fecha: h.fecha,
                    estado: h.estado,
                    mensaje_id: h.mensaje_id,
                    created_at: h.created_at
                })));
            }
        }
    }
}

run();
