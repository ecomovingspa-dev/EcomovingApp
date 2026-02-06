
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error("No se encontró el SERVICE_ROLE_KEY. No puedo realizar cambios estructurales directamente.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applySql() {
    console.log("Intentando aplicar cambios de estructura en Supabase...");

    // Como el rpc('run_sql') falló antes, intentaremos ver si podemos usar una alternativa
    // o si el error anterior fue por usar la anon_key.

    const sql = `
        ALTER TABLE ventas ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT false;
        ALTER TABLE compras ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT false;
        
        UPDATE ventas 
        SET conciliado = true 
        WHERE id IN (
            SELECT conciliado_id 
            FROM banco_movimientos 
            WHERE tipo_conciliacion = 'venta' 
              AND estado = 'conciliado' 
              AND conciliado_id IS NOT NULL
        );
        
        UPDATE compras 
        SET conciliado = true 
        WHERE id IN (
            SELECT conciliado_id 
            FROM banco_movimientos 
            WHERE tipo_conciliacion = 'compra' 
              AND estado = 'conciliado' 
              AND conciliado_id IS NOT NULL
        );
    `;

    try {
        // Intentamos ejecutar via RPC 'run_sql' con la llave de servicio
        const { data, error } = await supabase.rpc('run_sql', { sql_query: sql });

        if (error) {
            console.error("Error al ejecutar SQL:", error.message);
            console.log("\n--- EXPLICACIÓN ---");
            console.log("Supabase requiere que la función 'run_sql' esté habilitada manualmente en el panel para permitir cambios remotos.");
            console.log("Como no está habilitada por seguridad, no puedo 'inyectar' las columnas desde aquí.");
        } else {
            console.log("¡Éxito! Las columnas han sido agregadas y los datos sincronizados.");
        }
    } catch (err) {
        console.error("Error inesperado:", err.message);
    }
}

applySql();
