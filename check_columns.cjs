
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xgdmyjzyejjmwdqkufhp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('--- Verificando columnas de "contactos" ---');
    // Intentamos seleccionar para ver si fallan las columnas
    const { data, error } = await supabase
        .from('contactos')
        .select('id, nombre, cargo, nivel')
        .limit(1);

    if (error) {
        console.log('Error o columnas faltantes:', error.message);
        if (error.message.includes('column "cargo" does not exist')) {
            console.log('Las columnas "cargo" y "nivel" parecen no existir.');
        }
    } else {
        console.log('Las columnas "cargo" y "nivel" ya existen.');
    }
}

checkColumns();
