import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching contacts with name similar to JAIME CERESA...');
    
    const { data: contacts, error } = await supabase
        .from('contactos')
        .select('*');

    if (error) {
        console.error('Error fetching contacts:', error);
        return;
    }

    const target = contacts.filter(c => (c.nombre || '').toLowerCase().includes('ceresa') || (c.correo || '').toLowerCase().includes('ceresa'));
    
    if (target.length === 0) {
        console.log('No contacts found matching Ceresa.');
        return;
    }

    for (const c of target) {
        console.log('==================================================');
        console.log(`ID: ${c.id}`);
        console.log(`Nombre: ${c.nombre}`);
        console.log(`Correo: ${c.correo}`);
        console.log(`Etapa: ${c.etapa} | Estado: ${c.estado}`);
        console.log(`Último Envío: ${c.ultimo_envio}`);
        console.log(`Próximo Envío: ${c.proximo_envio}`);
        console.log(`Último Estado Brevo: ${c.ultimo_estado_brevo}`);
        
        const { data: history, error: hErr } = await supabase
            .from('trazabilidad_correos')
            .select('*')
            .or(`contacto_id.eq.${c.id},email.eq.${c.correo}`)
            .order('fecha', { ascending: true });

        if (hErr) {
            console.error('Error fetching history:', hErr);
        } else {
            console.log(`History records found: ${history.length}`);
            history.forEach(h => {
                console.log(` - ID: ${h.id} | Fecha: ${h.fecha} | Estado: ${h.estado} | MsgId: ${h.mensaje_id} | CreatedAt: ${h.created_at}`);
            });
        }
    }
    console.log('==================================================');
}

run();
