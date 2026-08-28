import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './utils/supabase';
import axios from 'axios';

// ============================================================================
// CRON ORQUESTADOR DIARIO - Cobranza + Marketing
// Ejecuta: 12:00 UTC (9:00 AM Chile verano / 8:00 AM invierno)
// Límites: 300 emails/día Brevo Free, 60s timeout Vercel Hobby
// ============================================================================

// Configuración Vercel - Extender timeout a 60 segundos
export const config = {
    maxDuration: 60,
};

// Env vars
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

// Constantes de límites
const BREVO_DAILY_LIMIT = 300;
const MAX_COBRANZA_EMAILS = 50; // Prioridad, reservar espacio
const DELAY_BETWEEN_EMAILS_MS = 30; // 30ms entre emails para optimizar tiempo y evitar timeout

// ============================================================================
// UTILIDADES
// ============================================================================

function parsearFecha(fechaStr: string | null): Date | null {
    if (!fechaStr) return null;
    return new Date(fechaStr);
}

const formatearMonto = (monto: any) => {
    const num = Number(monto) || 0;
    return '$' + num.toLocaleString('es-CL');
};

const formatearFechaCL = (fechaStr: string | null) => {
    const date = parsearFecha(fechaStr);
    return date ? date.toLocaleDateString('es-CL') : 'N/A';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
            mensaje: 'Fin de semana. Envíos suspendidos.',
            fecha: fechaChile
        };
    }

    return { esLaboral: true, mensaje: 'Día laboral', fecha: fechaChile };
}

/**
 * Suma días hábiles (omitiendo solo fines de semana por solicitud del usuario)
 */
function sumarDiasHabiles(fecha: Date, diasASumar: number): Date {
    const nuevaFecha = new Date(fecha.getTime());
    let diasContados = 0;
    while (diasContados < diasASumar) {
        nuevaFecha.setDate(nuevaFecha.getDate() + 1);
        const ds = nuevaFecha.getDay();
        if (ds !== 0 && ds !== 6) {
            diasContados++;
        }
    }
    return nuevaFecha;
}

// ============================================================================
// MÓDULO COBRANZA
// ============================================================================

async function ejecutarCobranza(supabase: any, maxEmails: number): Promise<{
    total: number;
    processed: number;
    sent: number;
    skipped: number;
    errors: string[];
}> {
    const report = { total: 0, processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

    try {
        // Cargar configuración de rangos
        const { data: rangosDb, error: configError } = await supabase
            .from('configuracion_cobranza')
            .select('*')
            .eq('activo', true)
            .order('dias_min', { ascending: true });

        if (configError) throw new Error(`Error config cobranza: ${configError.message}`);
        if (!rangosDb || rangosDb.length === 0) return report;

        const RANGOS = rangosDb.map(r => ({
            ...r,
            min: r.dias_min,
            max: r.dias_max,
            tipo: r.etiqueta,
            getAsunto: (folio: string, dias: number) =>
                r.asunto_template
                    .replace('{folio}', String(folio))
                    .replace('{dias}', String(Math.abs(dias)))
        }));

        // Obtener facturas impagas
        const { data: ventas, error: dbError } = await supabase
            .from('ventas')
            .select('*')
            .neq('estado_deuda', 'Pagada')
            .gt('saldo', 0)
            .limit(maxEmails);

        if (dbError) throw dbError;
        if (!ventas || ventas.length === 0) return report;

        report.total = ventas.length;

        const CHUNK_SIZE = 5;
        for (let i = 0; i < ventas.length; i += CHUNK_SIZE) {
            const chunk = ventas.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (factura) => {
                try {
                    report.processed++;
                    const folio = factura.folio || 'N/A';
                    const correo = factura.correo_cobranza;
                    const contacto = factura.contacto_cobranza;

                    if (!correo || !correo.includes('@') || !contacto?.trim()) {
                        report.skipped++;
                        return;
                    }

                    const hoy = new Date();
                    const fchVenc = parsearFecha(factura.fch_venc);
                    if (!fchVenc) return;

                    fchVenc.setHours(0, 0, 0, 0);
                    hoy.setHours(0, 0, 0, 0);
                    const diffDias = Math.floor((hoy.getTime() - fchVenc.getTime()) / (1000 * 60 * 60 * 24));

                    let rangoActual = RANGOS.find(r => diffDias >= r.min && diffDias <= r.max);

                    if (!rangoActual || factura.ultimo_tipo_aviso === rangoActual.nombre) {
                        report.skipped++;
                        return;
                    }

                    const htmlContent = generarHtmlCobranza({
                        contacto, folio,
                        fechaEmision: formatearFechaCL(factura.fch_emis),
                        fechaVencimiento: formatearFechaCL(factura.fch_venc),
                        montoTotal: formatearMonto(factura.mnt_total),
                        diffDias,
                        introMsg: rangoActual.mensaje_intro.replace('{dias}', String(Math.abs(diffDias))),
                        cierreMsg: rangoActual.mensaje_cierre.replace('{dias}', String(Math.abs(diffDias)))
                    });

                    const ccList = (factura.correo_vendedor || '').split(',').map((c: string) => c.trim().toLowerCase()).filter((c: string) => c.includes('@')).map((email: string) => ({ email }));

                    await axios.post('https://api.brevo.com/v3/smtp/email', {
                        sender: { name: "Departamento Cobranzas", email: "cobranza@ecomoving.cl" },
                        to: [{ email: correo, name: contacto }],
                        cc: ccList.length > 0 ? ccList : undefined,
                        subject: rangoActual.getAsunto(String(folio), diffDias),
                        htmlContent
                    }, {
                        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
                    });

                    await supabase.from('ventas').update({
                        ultimo_tipo_aviso: rangoActual.nombre,
                        fecha_ultimo_aviso: new Date().toISOString()
                    }).eq('folio', folio);

                    report.sent++;
                } catch (err: any) {
                    report.errors.push(`Cobranza ${factura.folio}: ${err.message}`);
                }
            }));

            await sleep(DELAY_BETWEEN_EMAILS_MS);
        }
    } catch (err: any) {
        report.errors.push(`Error global cobranza: ${err.message}`);
    }

    return report;
}

// ============================================================================
// MÓDULO MARKETING (ELIMINADO - SÓLO ENVIOS MANUALES DESDE CRM)
// ============================================================================

// ============================================================================
// TEMPLATE HTML COBRANZA
// ============================================================================

function generarHtmlCobranza(params: {
    contacto: string;
    folio: string;
    fechaEmision: string;
    fechaVencimiento: string;
    montoTotal: string;
    diffDias: number;
    introMsg: string;
    cierreMsg: string;
}): string {
    const { contacto, folio, fechaEmision, fechaVencimiento, montoTotal, diffDias, introMsg, cierreMsg } = params;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #334155; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: #0f172a; padding: 40px 30px; text-align: left; border-bottom: 4px solid #3b82f6; }
    .header h1 { margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; }
    .header p { margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; }
    .content { padding: 40px; }
    .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 20px; }
    .message { font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 30px; }
    .info-block { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 25px; }
    .info-title { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 1px; display: block; border-left: 3px solid #3b82f6; padding-left: 12px; }
    .info-item { font-size: 13px; margin-bottom: 10px; color: #475569; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .info-item:last-child { border-bottom: none; margin-bottom: 0; }
    .info-item strong { color: #0f172a; font-weight: 700; }
    .footer { padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }
    .signature { font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 4px; }
    .company { color: #64748b; font-size: 12px; }
    .legal-notice { padding: 20px 40px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Estado de Cuenta</h1>
      <p>Ecomoving SpA &bull; Departamento de Cobranzas</p>
    </div>
    <div class="content">
      <div class="greeting">Estimado/a ${contacto},</div>
      <div class="message">${introMsg}</div>
      <div class="info-block">
        <span class="info-title">Resumen del Documento</span>
        <div class="info-item"><span>N° de Factura:</span> <strong>${folio}</strong></div>
        <div class="info-item"><span>Fecha de Emisión:</span> <strong>${fechaEmision}</strong></div>
        <div class="info-item"><span>Fecha de Vencimiento:</span> <strong style="${diffDias > 0 ? 'color: #ef4444;' : ''}">${fechaVencimiento}</strong></div>
        <div class="info-item" style="margin-top: 15px; padding-top: 12px; border-top: 2px solid #e2e8f0;">
          <span>Monto Pendiente:</span> <strong style="font-size: 18px;">${montoTotal}</strong>
        </div>
        ${diffDias > 0 ? `
        <div class="info-item" style="margin-top: 10px;">
          <span style="color: #9a3412;">Situación actual:</span> <strong style="color: #9a3412; background-color: #fff7ed; padding: 2px 8px; border-radius: 4px;">Atraso de ${diffDias} días</strong>
        </div>
        ` : ''}
      </div>
      <div class="info-block">
        <span class="info-title">Instrucciones de Pago</span>
        <div class="info-item"><span>Banco:</span> <strong>BCI</strong></div>
        <div class="info-item"><span>Tipo de Cuenta:</span> <strong>Cuenta Corriente</strong></div>
        <div class="info-item"><span>N° de Cuenta:</span> <strong>13750780</strong></div>
        <div class="info-item"><span>RUT:</span> <strong>76.812.285-K</strong></div>
        <div class="info-item" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0; font-size: 11px;">
          <span>Email Comprobante:</span> <strong>cobranza@ecomoving.cl</strong>
        </div>
      </div>
      <div class="message" style="margin-top: 30px; margin-bottom: 0;">${cierreMsg}</div>
    </div>
    <div class="footer">
      <div class="signature">Departamento de Cobranzas</div>
      <div class="company">Ecomoving SpA</div>
    </div>
    <div class="legal-notice">
      Este es un mensaje institucional automático.<br>
      Si ya realizó el pago, por favor ignore este recordatorio.
    </div>
  </div>
</body>
</html>`;
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
            fecha: diaLaboral.fecha,
            cobranza: { sent: 0 }
        });
    }

    console.log(`✅ Día laboral (${diaLaboral.fecha}). Iniciando envíos...`);

    const supabase = getSupabase();

    // 3. Ejecutar ALERTAS INTERNAS (Compras)
    const alertasInternas = await ejecutarAlertasCompras(supabase);
    console.log(`🔔 Alertas Internas Compras: ${alertasInternas.notificacionCreada ? 'Creada' : 'Sin cambios'} (${alertasInternas.total} vencidas)`);

    // 4. Ejecutar COBRANZA (prio clientes)
    const cobranzaResult = await ejecutarCobranza(supabase, MAX_COBRANZA_EMAILS);
    console.log(`📧 Cobranza: ${cobranzaResult.sent} enviados`);

    // 5. Reporte final
    return res.status(200).json({
        fecha: diaLaboral.fecha,
        totalEnviados: cobranzaResult.sent,
        alertasInternas: {
            vencidas: alertasInternas.total,
            notificacionCreada: alertasInternas.notificacionCreada,
            errors: alertasInternas.errors
        },
        cobranza: {
            total: cobranzaResult.total,
            processed: cobranzaResult.processed,
            sent: cobranzaResult.sent,
            errors: cobranzaResult.errors
        }
    });
}
