import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Querying Comercial Cimtec S.A. from Supabase...');
    
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
        `)
        .ilike('correo', '%recepcion@cimtec.cl%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!contacts || contacts.length === 0) {
        console.log('Contact not found by email. Trying by account name...');
        // Try searching by name
        const { data: contactsByName } = await supabase
            .from('contactos')
            .select('*')
            .ilike('nombre', '%cimtec%');
            
        console.log('Matches by name:', contactsByName);
        return;
    }

    const c = contacts[0];
    console.log(`\nCONTACT NAME: "${c.nombre}"`);
    console.log(`EMAIL: "${c.correo}"`);
    console.log(`ETAPA: "${c.etapa}" | ESTADO: "${c.estado}"`);
    console.log(`ETAPA ENVÍO: ${c.etapa_envio}`);
    console.log(`ÚLTIMO ENVÍO: ${c.ultimo_envio}`);
    console.log(`PRÓXIMO ENVÍO: ${c.proximo_envio}`);
    console.log(`ÚLTIMO ESTADO BREVO: ${c.ultimo_estado_brevo}`);
    console.log(`BLOQUEADO: ${c.es_bloqueado}`);

    const { data: history } = await supabase
        .from('trazabilidad_correos')
        .select('*')
        .eq('contacto_id', c.id)
        .order('fecha', { ascending: true });

    console.log('\nHistory in trazabilidad_correos:');
    if (!history || history.length === 0) {
        console.log('  No records.');
    } else {
        history.forEach(h => {
            console.log(`  - Fecha: ${h.fecha} | Estado: ${h.estado} | MsgId: ${h.mensaje_id} | CreatedAt: ${h.created_at}`);
        });
    }
}

run();
