
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncCuentas() {
    console.log('🔄 Iniciando sincronización de estados de cuentas...');

    try {
        // 1. Obtener todas las cuentas y todos los IDs de cuenta que tienen contactos
        const { data: cuentas, error: errorCuentas } = await supabase
            .from('cuentas')
            .select('id, cliente, estado');

        if (errorCuentas) throw errorCuentas;

        const { data: contactos, error: errorContactos } = await supabase
            .from('contactos')
            .select('cuenta_id');

        if (errorContactos) throw errorContactos;

        const idsConContactos = new Set(contactos.map(c => c.cuenta_id));

        console.log(`📊 Total cuentas: ${cuentas.length}`);
        console.log(`👥 Cuentas con contactos: ${idsConContactos.size}`);

        let actualizadasAActivo = 0;
        let actualizadasAProspecto = 0;

        for (const cuenta of cuentas) {
            const tieneContactos = idsConContactos.has(cuenta.id);
            const nuevoEstado = tieneContactos ? 'activo' : 'prospecto';

            if (cuenta.estado !== nuevoEstado) {
                const { error: updateError } = await supabase
                    .from('cuentas')
                    .update({ estado: nuevoEstado })
                    .eq('id', cuenta.id);

                if (updateError) {
                    console.error(`❌ Error al actualizar cuenta ${cuenta.cliente} (${cuenta.id}):`, updateError.message);
                } else {
                    if (nuevoEstado === 'activo') actualizadasAActivo++;
                    else actualizadasAProspecto++;
                }
            }
        }

        console.log('✅ Sincronización completada.');
        console.log(`✨ Cuentas cambiadas a "activo": ${actualizadasAActivo}`);
        console.log(`✨ Cuentas cambiadas a "prospecto": ${actualizadasAProspecto}`);

    } catch (err) {
        console.error('💥 Error crítico durante la sincronización:', err.message);
    }
}

syncCuentas();
