import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_utils/supabase-client.js';

// ============================================================================
// CRON DIARIO - Alertas internas de Compras
// Ejecuta: 12:00 UTC (9:00 AM Chile verano / 8:00 AM invierno)
// ============================================================================

// Configuración Vercel - Extender timeout a 60 segundos
export const config = {
    maxDuration: 60,
};

// Env vars
const CRON_SECRET = process.env.CRON_SECRET!;

// ============================================================================
// UTILIDADES
// ============================================================================

const formatearMonto = (monto: any) => {
    const num = Number(monto) || 0;
    return '$' + num.toLocaleString('es-CL');
};

// ============================================================================
// VERIFICACIÓN DÍA LABORAL (Lunes a Viernes)
// ============================================================================

function getFechaChile(): string {
    const options: any = { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" };
    const formatter = new Intl.DateTimeFormat("en-CA", options);
    const parts = formatter.formatToParts(new Date());

    const yearStr = parts.find(p => p.type === "year")?.value!;
    const monthStr = parts.find(p => p.type === "month")?.value!;
    const dayStr = parts.find(p => p.type === "day")?.value!;
    return `${yearStr}-${monthStr}-${dayStr}`;
}

function esDiaLaboral(): { esLaboral: boolean; mensaje: string; fecha: string } {
    const fechaChile = getFechaChile();
    const nativeDateChile = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const dw = nativeDateChile.getDay();

    // 0 = Domingo, 6 = Sábado
    if (dw === 0 || dw === 6) {
        return {
            esLaboral: false,
            mensaje: 'Fin de semana. Ejecución suspendida.',
            fecha: fechaChile
        };
    }

    return { esLaboral: true, mensaje: 'Día laboral', fecha: fechaChile };
}

// ============================================================================
// MÓDULO ALERTA COMPRAS INTERNAS (Notificación In-App + WhatsApp futuro)
// ============================================================================

async function ejecutarAlertasCompras(supabase: any): Promise<{ total: number; notificacionCreada: boolean; errors: string[] }> {
    const report = { total: 0, notificacionCreada: false, errors: [] as string[] };
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoyStr = hoy.toISOString().split('T')[0];

        // 1. Buscar facturas de compras vencidas
        const { data: compras, error } = await supabase
            .from('compras')
            .select('folio, razon_social, saldo, fecha_vencimiento')
            .gt('saldo', 0)
            .lt('fecha_vencimiento', hoyStr);

        if (error) throw error;
        if (!compras || compras.length === 0) return report;

        report.total = compras.length;
        const deudaTotal = compras.reduce((acc, c) => acc + (c.saldo || 0), 0);

        // 2. Verificar si ya existe una notificación activa del mismo tipo hoy
        const { data: existente } = await supabase
            .from('notificaciones')
            .select('id')
            .eq('tipo', 'alerta_compras_vencidas')
            .eq('resuelta', false)
            .gte('created_at', hoyStr)
            .limit(1);

        if (existente && existente.length > 0) {
            console.log('ℹ️ Ya existe una alerta de compras vencidas para hoy. Omitiendo duplicado.');
            return report;
        }

        // 3. INSERTAR NOTIFICACIÓN INTERNA EN LA APP
        const top3 = compras.slice(0, 3).map(c =>
            `• Folio ${c.folio} - ${c.razon_social}: ${formatearMonto(c.saldo)}`
        ).join('\n');

        const { error: insertError } = await supabase.from('notificaciones').insert({
            tipo: 'alerta_compras_vencidas',
            titulo: `🚨 ${compras.length} Facturas de Compra Vencidas`,
            mensaje: `Deuda total en mora: ${formatearMonto(deudaTotal)}.\n\n${top3}${compras.length > 3 ? `\n... y ${compras.length - 3} más.` : ''}\n\nIngresa al Libro de Compras para gestionar los pagos.`,
            modulo: 'compras',
            enlace: '/compras',
            icono: 'alert-triangle',
            severidad: 'critical',
            leida: false,
            resuelta: false,
            metadata: { count: compras.length, total: deudaTotal, fecha: hoyStr }
        });

        if (insertError) {
            report.errors.push(`Error insertando notificación: ${insertError.message}`);
        } else {
            report.notificacionCreada = true;
            console.log(`🔔 Notificación interna creada: ${compras.length} compras vencidas ($${deudaTotal})`);
        }

    } catch (err: any) {
        report.errors.push(`Error global en alertas compras: ${err.message}`);
    }
    return report;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verificación de seguridad
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Verificar día laboral
    const diaLaboral = esDiaLaboral();
    if (!diaLaboral.esLaboral) {
        return res.status(200).json({
            message: diaLaboral.mensaje,
            fecha: diaLaboral.fecha
        });
    }

    console.log(`✅ Día laboral (${diaLaboral.fecha}). Iniciando revisión de alertas...`);

    const supabase = getSupabase();

    // 3. Ejecutar ALERTAS INTERNAS (Compras)
    const alertasInternas = await ejecutarAlertasCompras(supabase);
    console.log(`🔔 Alertas Internas Compras: ${alertasInternas.notificacionCreada ? 'Creada' : 'Sin cambios'} (${alertasInternas.total} vencidas)`);

    // 4. Reporte final
    return res.status(200).json({
        fecha: diaLaboral.fecha,
        alertasInternas: {
            vencidas: alertasInternas.total,
            notificacionCreada: alertasInternas.notificacionCreada,
            errors: alertasInternas.errors
        }
    });
}
