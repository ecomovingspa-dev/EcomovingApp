import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const calcularEstado = (
    saldo,
    fchVenc,
    estadoActual
) => {
    if (saldo <= 0) return "Pagada";

    if (fchVenc) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaVenc = new Date(fchVenc);
        fechaVenc.setHours(0, 0, 0, 0);

        if (fechaVenc < hoy) return "Vencida";
        return "Pendiente";
    }

    return estadoActual || "Pendiente";
};

async function run() {
    const { data: sData, error } = await supabase
        .from("compras")
        .select("monto_total, saldo, fecha_vencimiento, estado_pago, fecha_emision");

    if (error) {
        console.error(error);
        return;
    }

    const summary = sData.reduce(
        (acc, compra) => {
            const saldo = compra.saldo !== undefined ? compra.saldo : compra.monto_total;
            const estado = calcularEstado(saldo, compra.fecha_vencimiento, compra.estado_pago || "");

            if (estado === "Pendiente") {
                acc.pendientes.count++;
                acc.pendientes.total += saldo || 0;
            } else if (estado === "Vencida") {
                acc.vencidas.count++;
                acc.vencidas.total += saldo || 0;
            }
            return acc;
        },
        {
            pendientes: { count: 0, total: 0 },
            vencidas: { count: 0, total: 0 },
            mensual: { count: 0, total: 0 },
        }
    );

    // Compras del mes
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    sData.forEach((compra) => {
        if (compra.fecha_emision) {
            const parts = compra.fecha_emision.split("-");
            if (parts.length === 3) {
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                if (y === currentYear && m === currentMonth) {
                    summary.mensual.count++;
                    summary.mensual.total += compra.monto_total || 0;
                }
            }
        }
    });

    console.log('--- SIMULATED SUMMARY ---');
    console.log('Pendientes (Por Pagar):', summary.pendientes);
    console.log('Vencidas:', summary.vencidas);
    console.log('Mensual:', summary.mensual);
}
run();
