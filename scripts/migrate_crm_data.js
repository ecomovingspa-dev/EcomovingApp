import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parser
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan variables de entorno Supabase en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    console.log('--- Iniciando análisis de migración ---');

    const { data: cuentas, error } = await supabase
        .from('cuentas')
        .select('id, cliente, correo, telefono')
        .or('correo.neq."",telefono.neq.""');

    if (error) {
        console.error('Error al obtener cuentas:', error);
        return;
    }

    console.log(`Se encontraron ${cuentas.length} cuentas con correo o teléfono.`);

    let creados = 0;
    let omitidos = 0;
    let errores = 0;

    for (const cuenta of cuentas) {
        if (!cuenta.correo && !cuenta.telefono) continue;

        // Verificar si ya existe un contacto con este correo para esta cuenta
        if (cuenta.correo) {
            const { data: existentes } = await supabase
                .from('contactos')
                .select('id')
                .eq('cuenta_id', cuenta.id)
                .eq('correo', cuenta.correo);

            if (existentes && existentes.length > 0) {
                // console.log(`[Omitido] ${cuenta.cliente}: Ya tiene un contacto con el correo ${cuenta.correo}`);
                omitidos++;
                continue;
            }
        }

        // Crear el nuevo contacto
        const { error: insertError } = await supabase
            .from('contactos')
            .insert({
                nombre: `Contacto Principal - ${cuenta.cliente}`,
                correo: cuenta.correo || null,
                celular: cuenta.telefono || null,
                cuenta_id: cuenta.id,
                estado: 'activo',
                departamento: 'Administración'
            });

        if (insertError) {
            console.error(`[Error] ${cuenta.cliente}:`, insertError.message);
            errores++;
        } else {
            console.log(`[Creado] Contacto para ${cuenta.cliente}`);
            creados++;
        }
    }

    console.log('--- Resumen ---');
    console.log(`Creados: ${creados}`);
    console.log(`Omitidos (ya existen): ${omitidos}`);
    console.log(`Errores: ${errores}`);
}

migrateData();
