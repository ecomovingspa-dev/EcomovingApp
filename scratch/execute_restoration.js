import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('=== INICIANDO RESTITUCIÓN DE FACTURA FOLIO 130 ===');

    // 1. Obtener la factura para validar el monto original
    const { data: venta, error: vErr } = await supabase
        .from('ventas')
        .select('*')
        .eq('folio', 130)
        .single();

    if (vErr) {
        console.error('Error al buscar la factura Folio 130:', vErr);
        return;
    }

    const montoOriginal = venta.mnt_total;
    console.log(`Factura encontrada: Folio ${venta.folio} | Monto original: $${Number(montoOriginal).toLocaleString('es-CL')}`);

    // 2. Eliminar el abono ID 194 de la tabla abonos
    console.log('Eliminando Abono ID 194 (pago de factoring con error)...');
    const { error: delErr } = await supabase
        .from('abonos')
        .delete()
        .eq('id', 194);

    if (delErr) {
        console.error('Error al eliminar el abono:', delErr);
        return;
    }
    console.log('Abono ID 194 eliminado correctamente.');

    // 3. Actualizar la factura en la tabla ventas
    console.log(`Actualizando factura Folio 130: saldo = $${Number(montoOriginal).toLocaleString('es-CL')}, estado_deuda = 'Vencida'...`);
    const { data: updatedVenta, error: upErr } = await supabase
        .from('ventas')
        .update({
            saldo: montoOriginal,
            estado_deuda: 'Vencida'
        })
        .eq('id', venta.id)
        .select()
        .single();

    if (upErr) {
        console.error('Error al actualizar la factura:', upErr);
        return;
    }

    console.log('Factura actualizada con éxito:');
    console.log(` - Folio: ${updatedVenta.folio}`);
    console.log(` - Nuevo Saldo: $${Number(updatedVenta.saldo).toLocaleString('es-CL')}`);
    console.log(` - Estado Deuda: ${updatedVenta.estado_deuda}`);
    console.log('=== RESTITUCIÓN COMPLETADA SIN ERRORES ===');
}

run();
