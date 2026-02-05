
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xgdmyjzyejjmwdqkufhp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function enrichEnex() {
    console.log('--- Enriqueciendo cuenta Enex Chile S.A. ---');

    // 1. Encontrar la cuenta
    const { data: accounts, error: accError } = await supabase
        .from('cuentas')
        .select('*')
        .ilike('cliente', '%Enex%');

    if (accError || !accounts || accounts.length === 0) {
        console.error('No se pudo encontrar la cuenta Enex para enriquecer.');
        return;
    }

    const enexAcc = accounts[0];
    console.log(`Actualizando cuenta ID: ${enexAcc.id}`);

    // 2. Actualizar datos de la cuenta
    const { error: updateAccError } = await supabase
        .from('cuentas')
        .update({
            cliente: 'Enex Chile S.A.',
            rut: '92.011.000-2',
            ciudad: 'Santiago',
            sector: 'Energía',
            segmento: 'Comercial/Industrial - Shell Chile'
        })
        .eq('id', enexAcc.id);

    if (updateAccError) {
        console.error('Error actualizando cuenta:', updateAccError);
    } else {
        console.log('✅ Cuenta Enex Chile S.A. actualizada correctamente.');
    }

    // 3. Agregar/Actualizar Contactos Ejecutivos y Administrativos
    const executiveContacts = [
        { nombre: 'Javier Cavagnaro I.', correo: 'javier.cavagnaro@enex.cl', depto: 'Administración y Finanzas', nivel: 'Gerencia' },
        { nombre: 'Juan Eduardo López Q.', correo: 'juan.lopez@enex.cl', depto: 'Asuntos Corporativos', nivel: 'Gerencia' },
        { nombre: 'Alan Sherwin L.', correo: 'alan.sherwin@enex.cl', depto: 'Operaciones', nivel: 'Gerencia' },
        { nombre: 'Francisco Arzubi', correo: 'francisco.arzubi@enex.cl', depto: 'Negocios Chile', nivel: 'Gerencia' },
        { nombre: 'Ricardo Ferrari', correo: 'ricardo.ferrari@enex.cl', depto: 'Estrategia y Planificación', nivel: 'Gerencia' },
        { nombre: 'Ricardo Reyes M.', correo: 'ricardo.reyes@enex.cl', depto: 'Auditoría Interna', nivel: 'Gerencia' },
        { nombre: 'Francisco Pérez Mackenna', correo: 'f.perez@enex.cl', depto: 'Directorio', nivel: 'Directivo' },
        { nombre: 'Rodrigo Hinzpeter', correo: 'r.hinzpeter@enex.cl', depto: 'Directorio', nivel: 'Directivo' }
    ];

    console.log('\n--- Agregando Niveles Ejecutivos y Administrativos ---');

    for (const exec of executiveContacts) {
        // Buscamos si ya existe por correo
        const { data: existing } = await supabase
            .from('contactos')
            .select('*')
            .eq('correo', exec.correo)
            .eq('cuenta_id', enexAcc.id);

        const fullDepto = `${exec.nivel} - ${exec.depto}`;

        if (existing && existing.length > 0) {
            console.log(`[EXISTENTE] Actualizando nivel para ${exec.nombre}...`);
            await supabase
                .from('contactos')
                .update({ departamento: fullDepto })
                .eq('id', existing[0].id);
        } else {
            console.log(`[NUEVO] Agregando ${exec.nombre} (${exec.nivel})...`);
            const { error: insError } = await supabase
                .from('contactos')
                .insert([{
                    nombre: exec.nombre,
                    correo: exec.correo,
                    departamento: fullDepto,
                    cuenta_id: enexAcc.id,
                    estado: 'activo'
                }]);

            if (insError) console.error(`Error insertando ${exec.nombre}:`, insError);
        }
    }
}

enrichEnex();
