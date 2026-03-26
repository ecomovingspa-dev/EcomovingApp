import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
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

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Env vars
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

// Constantes de límites
const BREVO_DAILY_LIMIT = 300;
const MAX_COBRANZA_EMAILS = 50; // Prioridad, reservar espacio
const DELAY_BETWEEN_EMAILS_MS = 300; // 300ms entre emails para no saturar

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
// VERIFICACIÓN DÍA LABORAL CHILE
// ============================================================================

async function esDiaLaboralChile(): Promise<{ esLaboral: boolean; mensaje: string; fecha: string }> {
    const fechaChileStr = new Date().toLocaleString("en-US", { timeZone: "America/Santiago" });
    const fechaChile = new Date(fechaChileStr);
    const diaSemana = fechaChile.getDay();
    const fechaFormateada = fechaChile.toISOString().split('T')[0];

    // Fin de semana
    if (diaSemana === 0 || diaSemana === 6) {
        return {
            esLaboral: false,
            mensaje: 'Fin de semana en Chile. Envíos suspendidos.',
            fecha: fechaFormateada
        };
    }

    // Verificar feriados
    try {
        const year = fechaChile.getFullYear();
        const { data: feriados } = await axios.get(`https://apis.digital.gob.cl/fl/feriados/${year}`);
        const esFeriado = feriados.some((f: any) => f.fecha === fechaFormateada);

        if (esFeriado) {
            return {
                esLaboral: false,
                mensaje: 'Día festivo en Chile. Envíos suspendidos.',
                fecha: fechaFormateada
            };
        }
    } catch (error) {
        console.warn('Error verificando feriados, continuando:', error);
    }

    return { esLaboral: true, mensaje: 'Día laboral', fecha: fechaFormateada };
}

// ============================================================================
// MÓDULO COBRANZA
// ============================================================================

async function ejecutarCobranza(maxEmails: number): Promise<{
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

        for (const factura of ventas) {
            if (report.sent >= maxEmails) break;
            report.processed++;

            try {
                const folio = factura.folio || 'N/A';
                const correo = factura.correo_cobranza;
                const contacto = factura.contacto_cobranza;

                if (!correo || !correo.includes('@') || !contacto?.trim()) {
                    report.skipped++;
                    continue;
                }

                const hoy = new Date();
                const fchVenc = parsearFecha(factura.fch_venc);
                if (!fchVenc) {
                    report.errors.push(`Fecha inválida folio ${folio}`);
                    continue;
                }

                fchVenc.setHours(0, 0, 0, 0);
                hoy.setHours(0, 0, 0, 0);
                const diffDias = Math.floor((hoy.getTime() - fchVenc.getTime()) / (1000 * 60 * 60 * 24));

                // Buscar rango
                let rangoActual = null;
                for (const rango of RANGOS) {
                    if (diffDias >= rango.min && diffDias <= rango.max) {
                        rangoActual = rango;
                        break;
                    }
                }

                // Control de envío (no duplicar)
                let enviar = false;
                const ultimoTipoAviso = factura.ultimo_tipo_aviso;
                if (rangoActual) {
                    if (!ultimoTipoAviso) enviar = true;
                    else if (ultimoTipoAviso !== rangoActual.nombre) enviar = true;
                }

                if (!enviar || !rangoActual) {
                    report.skipped++;
                    continue;
                }

                // Construir email
                const asunto = rangoActual.getAsunto(String(folio), diffDias);
                const introMsg = rangoActual.mensaje_intro.replace('{dias}', String(Math.abs(diffDias)));
                const cierreMsg = rangoActual.mensaje_cierre.replace('{dias}', String(Math.abs(diffDias)));

                const htmlContent = generarHtmlCobranza({
                    contacto,
                    folio,
                    fechaEmision: formatearFechaCL(factura.fch_emis),
                    fechaVencimiento: formatearFechaCL(factura.fch_venc),
                    montoTotal: formatearMonto(factura.mnt_total),
                    diffDias,
                    introMsg,
                    cierreMsg
                });

                // CC al vendedor
                const ccList: { email: string }[] = [];
                if (factura.correo_vendedor?.includes('@')) {
                    factura.correo_vendedor.split(',').forEach((c: string) => {
                        const email = c.trim().toLowerCase();
                        if (email.includes('@')) ccList.push({ email });
                    });
                }

                // Enviar
                await axios.post('https://api.brevo.com/v3/smtp/email', {
                    sender: { name: "Departamento Cobranzas", email: "cobranza@ecomoving.cl" },
                    to: [{ email: correo, name: contacto }],
                    cc: ccList.length > 0 ? ccList : undefined,
                    subject: asunto,
                    htmlContent
                }, {
                    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
                });

                // Actualizar DB
                await supabase
                    .from('ventas')
                    .update({
                        ultimo_tipo_aviso: rangoActual.nombre,
                        fecha_ultimo_aviso: new Date().toISOString()
                    })
                    .eq('folio', folio);

                report.sent++;
                await sleep(DELAY_BETWEEN_EMAILS_MS);

            } catch (err: any) {
                report.errors.push(`Cobranza ${factura.folio}: ${err.message}`);
            }
        }
    } catch (err: any) {
        report.errors.push(`Error global cobranza: ${err.message}`);
    }

    return report;
}

// ============================================================================
// MÓDULO MARKETING
// ============================================================================

async function ejecutarMarketing(maxEmails: number): Promise<{
    processed: number;
    sent: number;
    errors: string[];
}> {
    const report = { processed: 0, sent: 0, errors: [] as string[] };

    if (maxEmails <= 0) return report;

    try {
        const today = new Date().toISOString().split('T')[0];

        // Buscar contactos activos (case-insensitive) con próximo envío pendiente
        const { data: contacts, error: contactError } = await supabase
            .from('contactos')
            .select('*')
            .ilike('estado', 'activo')
            .not('correo', 'is', null)
            .neq('correo', '')
            .limit(maxEmails);

        if (contactError) throw contactError;
        if (!contacts || contacts.length === 0) {
            console.log('⚠️ Marketing: No hay contactos activos con envío pendiente');
            return report;
        }

        console.log(`📋 Marketing: ${contacts.length} contactos para procesar`);

        for (const contact of contacts) {
            if (report.sent >= maxEmails) break;
            report.processed++;

            try {
                // Obtener etapa de envío (usar 1 si es NULL, 0, o no existe)
                let etapaActual = parseInt(contact.etapa_envio) || 1;
                if (etapaActual < 1) etapaActual = 1;

                console.log(`  📧 Procesando ${contact.correo} - Etapa ${etapaActual}`);

                // Buscar contenido de la secuencia
                let { data: messageData } = await supabase
                    .from('marketing')
                    .select('*')
                    .eq('nombre_envio', etapaActual)
                    .eq('activo', true)
                    .maybeSingle();

                // Si no hay mensaje, simplemente saltamos (pausamos) para este contacto
                // hasta que se cree el contenido para su etapa actual.
                if (!messageData) {
                    console.log(`  ⏸️ Pausado: Sin contenido para etapa ${etapaActual} (${contact.correo})`);
                    continue;
                }

                // Preparar HTML
                let finalHtml = messageData.cuerpo_html || '';
                if (messageData.imagen_url) {
                    finalHtml = finalHtml.replace('IMAGE_PLACEHOLDER', messageData.imagen_url);
                }

                // Enviar
                await axios.post('https://api.brevo.com/v3/smtp/email', {
                    sender: { name: "Ecomoving", email: "ventas@ecomoving.cl" },
                    to: [{ email: contact.correo }],
                    subject: messageData.asunto,
                    htmlContent: finalHtml,
                    textContent: messageData.cuerpodetalle || "Ver correo en formato HTML"
                }, {
                    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
                });

                // Actualizar próximo envío (+3 días = ~2 emails por semana)
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + 3);

                // Calcular próxima etapa
                const siguienteEtapa = etapaActual + 1;

                await supabase
                    .from('contactos')
                    .update({
                        ultimo_envio: new Date().toISOString(),
                        proximo_envio: nextDate.toISOString(),
                        etapa_envio: siguienteEtapa
                    })
                    .eq('id', contact.id);

                console.log(`  ✅ Enviado a ${contact.correo} - Etapa ${etapaActual} → ${siguienteEtapa}`);

                report.sent++;
                await sleep(DELAY_BETWEEN_EMAILS_MS);

            } catch (err: any) {
                report.errors.push(`Marketing ${contact.id}: ${err.message}`);
            }
        }
    } catch (err: any) {
        report.errors.push(`Error global marketing: ${err.message}`);
    }

    return report;
}

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
// HANDLER PRINCIPAL
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verificación de seguridad
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Verificar día laboral
    const diaLaboral = await esDiaLaboralChile();
    if (!diaLaboral.esLaboral) {
        return res.status(200).json({
            message: diaLaboral.mensaje,
            fecha: diaLaboral.fecha,
            cobranza: { sent: 0 },
            marketing: { sent: 0 }
        });
    }

    console.log(`✅ Día laboral (${diaLaboral.fecha}). Iniciando envíos...`);

    // 3. Ejecutar COBRANZA (prioridad)
    const cobranzaResult = await ejecutarCobranza(MAX_COBRANZA_EMAILS);
    console.log(`📧 Cobranza: ${cobranzaResult.sent} enviados`);

    // 4. Calcular cuota restante para marketing
    const cuotaMarketing = BREVO_DAILY_LIMIT - cobranzaResult.sent;

    // 5. Ejecutar MARKETING
    const marketingResult = await ejecutarMarketing(cuotaMarketing);
    console.log(`📬 Marketing: ${marketingResult.sent} enviados`);

    // 6. Reporte final
    return res.status(200).json({
        fecha: diaLaboral.fecha,
        totalEnviados: cobranzaResult.sent + marketingResult.sent,
        limiteBrevo: BREVO_DAILY_LIMIT,
        cobranza: {
            total: cobranzaResult.total,
            processed: cobranzaResult.processed,
            sent: cobranzaResult.sent,
            skipped: cobranzaResult.skipped,
            errors: cobranzaResult.errors
        },
        marketing: {
            processed: marketingResult.processed,
            sent: marketingResult.sent,
            errors: marketingResult.errors
        }
    });
}
