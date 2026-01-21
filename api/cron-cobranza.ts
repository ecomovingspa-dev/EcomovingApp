
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Env vars
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

// Helper functions (Utilities)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Security Check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Filtro Días Laborales (Lunes a Viernes)
    const diaSemana = new Date().getDay(); // 0 = Domingo, 6 = Sábado
    if (diaSemana === 0 || diaSemana === 6) {
        return res.status(200).json({
            message: 'Fin de semana detectado. Flujo detenido.',
            dayIndex: diaSemana
        });
    }

    try {
        const report = {
            total: 0,
            processed: 0,
            sent: 0,
            skipped: 0,
            errors: [] as string[]
        };

        // 3. Cargar Configuración desde DB (Dinámica)
        const { data: rangosDb, error: configError } = await supabase
            .from('configuracion_cobranza')
            .select('*')
            .eq('activo', true)
            .order('dias_min', { ascending: true });

        if (configError) throw new Error(`Error cargando configuración: ${configError.message}`);

        // Mapeamos los rangos DB a la estructura interna con métodos helper
        const RANGOS = (rangosDb || []).map(r => ({
            ...r,
            min: r.dias_min,
            max: r.dias_max,
            tipo: r.etiqueta,
            getAsunto: (folio: string, dias: number) =>
                r.asunto_template
                    .replace('{folio}', String(folio))
                    .replace('{dias}', String(Math.abs(dias)))
        }));

        if (RANGOS.length === 0) {
            return res.status(200).json({ message: 'No hay reglas de cobranza activas en Supabase.' });
        }

        // 4. Obtener Ventas Impagas desde Supabase
        const { data: ventas, error: dbError } = await supabase
            .from('ventas')
            .select('*')
            .neq('estado_deuda', 'Pagada')
            .gt('saldo', 0);

        if (dbError) throw dbError;
        if (!ventas || ventas.length === 0) {
            return res.status(200).json({ message: 'No hay facturas impagas para procesar.' });
        }

        report.total = ventas.length;

        // 5. Loop over items
        for (const factura of ventas) {
            report.processed++;

            try {
                const folio = factura.folio || 'N/A';
                const correo = factura.correo_cobranza;
                const contacto = factura.contacto_cobranza;

                if (!correo || !correo.includes('@') || !contacto || !contacto.trim()) {
                    report.skipped++;
                    continue;
                }

                const hoy = new Date();
                const fchVenc = parsearFecha(factura.fch_venc);

                if (!fchVenc) {
                    report.errors.push(`Fecha vencimiento inválida para folio ${folio}`);
                    continue;
                }

                fchVenc.setHours(0, 0, 0, 0);
                hoy.setHours(0, 0, 0, 0);

                const diffTime = hoy.getTime() - fchVenc.getTime();
                const diffDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // Buscar rango coincidente
                let rangoActual = null;
                for (const rango of RANGOS) {
                    if (diffDias >= rango.min && diffDias <= rango.max) {
                        rangoActual = rango;
                        break;
                    }
                }

                // Gemini Logic Check
                let enviar = false;
                const ultimoTipoAviso = factura.ultimo_tipo_aviso;

                if (rangoActual) {
                    if (!ultimoTipoAviso) {
                        enviar = true;
                    } else if (ultimoTipoAviso === rangoActual.nombre) {
                        enviar = false; // Ya enviado
                    } else {
                        enviar = true; // Escalamiento
                    }
                }

                if (!enviar || !rangoActual) {
                    report.skipped++;
                    continue;
                }

                // --- CONSTRUCCIÓN DEL CORREO (Usando Template DB) ---
                const asunto = rangoActual.getAsunto(String(folio), diffDias);
                const diasAbs = Math.abs(diffDias);

                // Reemplazar placeholders en los mensajes
                const introMsg = rangoActual.mensaje_intro.replace('{dias}', String(diasAbs));
                const cierreMsg = rangoActual.mensaje_cierre.replace('{dias}', String(diasAbs));

                // Variables para HTML
                const fechaEmision = formatearFechaCL(factura.fch_emis);
                const fechaVencimiento = formatearFechaCL(factura.fch_venc);
                const montoTotal = formatearMonto(factura.mnt_total);
                const correoVendedor = factura.correo_vendedor;

                const bloqueDiasVencidos = diffDias > 0 ? `
            <div style="background-color: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #856404; font-weight: 600;">Días de Vencimiento</p>
            <p style="margin: 0; font-size: 20px; color: #856404; font-weight: 700;">${diffDias} días</p>
            </div>
        ` : '';

                // HTML Content
                const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Departamento de Cobranzas</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ecomoving SpA</p>
    </div>
    <div style="padding: 40px;">
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #2c3e50; line-height: 1.6;">
        Estimado/a <strong>${contacto}</strong>,
      </p>
      
      <!-- Mensaje Dynamic Intro -->
      <div style="margin: 0 0 32px 0; font-size: 15px; color: #2c3e50; line-height: 1.6;">
        ${introMsg}
      </div>
      
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e9ecef;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">Número de Factura</p>
          <p style="margin: 0; font-size: 18px; color: #2c3e50; font-weight: 600;">${folio}</p>
        </div>
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d;">Fecha de Emisión</p>
          <p style="margin: 0; font-size: 15px; color: #2c3e50;">${fechaEmision}</p>
        </div>
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d;">Fecha de Vencimiento</p>
          <p style="margin: 0; font-size: 15px; color: #2c3e50;">${fechaVencimiento}</p>
        </div>
        <div style="margin-bottom: ${diffDias > 0 ? '12px' : '0'};">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d;">Monto Total</p>
          <p style="margin: 0; font-size: 20px; color: #2c3e50; font-weight: 700;">${montoTotal}</p>
        </div>
        ${bloqueDiasVencidos}
      </div>
      
      <div style="background-color: #e8f4f8; padding: 20px; border-radius: 6px; border-left: 4px solid #17a2b8; margin-bottom: 32px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #0c5460; font-weight: 600;">Datos para Transferencia</p>
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #0c5460;"><strong>Banco:</strong> BCI</p>
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #0c5460;"><strong>Cuenta Corriente:</strong> 13750780</p>
        <p style="margin: 0; font-size: 14px; color: #0c5460;"><strong>Enviar comprobante a:</strong> cobranza@ecomoving.cl</p>
      </div>
      
      <!-- Mensaje Dynamic Cierre -->
      <div style="margin: 0 0 32px 0; font-size: 15px; color: #2c3e50; line-height: 1.6;">
        ${cierreMsg}
      </div>
      
      <div style="padding-top: 24px; border-top: 2px solid #e9ecef;">
        <p style="margin: 0 0 4px 0; font-size: 15px; color: #2c3e50;">Saludos cordiales,</p>
        <p style="margin: 0 0 2px 0; font-size: 16px; color: #2c3e50; font-weight: 600;">Departamento de Cobranzas</p>
        <p style="margin: 0; font-size: 14px; color: #6c757d;">Ecomoving SpA</p>
      </div>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; font-size: 12px; color: #6c757d;">
        Este es un correo automático. Por favor no responder a esta dirección.
      </p>
    </div>
  </div>
</body>
</html>`;

                // --- ENVIAR CORREO (BREVO) ---
                const ccList = [];
                if (correoVendedor && correoVendedor.includes('@')) {
                    ccList.push({ email: correoVendedor });
                }

                const emailPayload = {
                    sender: { name: "Departamento Cobranzas", email: "cobranza@ecomoving.cl" },
                    to: [{ email: correo, name: contacto }],
                    cc: ccList.length > 0 ? ccList : undefined,
                    subject: asunto,
                    htmlContent: htmlContent
                };

                await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
                    headers: {
                        'api-key': BREVO_API_KEY,
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                });

                // --- ACTUALIZAR SUPABASE ---
                const { error: updateError } = await supabase
                    .from('ventas')
                    .update({
                        ultimo_tipo_aviso: rangoActual.nombre,
                        fecha_ultimo_aviso: new Date().toISOString()
                    })
                    .eq('folio', folio); // Match exacto

                if (updateError) console.error('Error DB Update:', updateError);

                report.sent++;

            } catch (innerError: any) {
                console.error(`Error procesando item:`, innerError);
                report.errors.push(innerError.message);
            }
        }

        return res.status(200).json(report);

    } catch (err: any) {
        console.error('Critical Cron Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
