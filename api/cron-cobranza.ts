
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
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
    .header { background-color: #1e293b; padding: 30px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .header p { margin: 5px 0 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 40px; }
    .greeting { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 20px; }
    .message { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 30px; }
    .info-grid { background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 25px; margin-bottom: 30px; }
    .info-item { margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .info-item:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
    .value { font-size: 16px; color: #1e293b; font-weight: 500; }
    .value-bold { font-size: 20px; color: #0f172a; font-weight: 700; }
    .status-box { margin-top: 15px; padding: 12px 15px; border-radius: 6px; display: inline-block; }
    .status-vencido { background-color: #fff7ed; border-left: 4px solid #f97316; color: #9a3412; }
    .status-vencido .label { color: #c2410c; }
    .bank-details { background-color: #f1f5f9; border-radius: 8px; padding: 25px; border: 1px solid #e2e8f0; }
    .bank-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #334155; display: inline-block; }
    .bank-item { font-size: 14px; margin-bottom: 8px; color: #334155; }
    .footer { padding: 30px 40px; border-top: 1px solid #e2e8f0; font-size: 14px; }
    .closing { margin-bottom: 1px; color: #475569; }
    .signature { font-weight: 700; color: #1e293b; font-size: 16px; }
    .legal { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Departamento de Cobranzas</h1>
      <p>Ecomoving SpA</p>
    </div>
    
    <div class="content">
      <div class="greeting">Estimado/a ${contacto},</div>
      
      <div class="message">
        ${introMsg}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Documento</span>
          <span class="value">Factura Electrónica N° ${folio}</span>
        </div>
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; width: 50%;">
            <span class="label">Fecha Emisión</span>
            <span class="value">${fechaEmision}</span>
          </div>
          <div style="display: table-cell; width: 50%;">
            <span class="label">Fecha Vencimiento</span>
            <span class="value" style="${diffDias > 0 ? 'color: #dc2626; font-weight: 600;' : ''}">${fechaVencimiento}</span>
          </div>
        </div>
        <div class="info-item" style="margin-top: 15px; border-bottom: none; border-top: 1px solid #e2e8f0; padding-top: 15px;">
          <span class="label">Monto Total Pendiente</span>
          <span class="value-bold">${montoTotal}</span>
        </div>
        
        ${diffDias > 0 ? `
        <div class="status-box status-vencido">
          <span class="label">Situación</span>
          <span class="value" style="font-weight: 700;">Vencida hace ${diffDias} días</span>
        </div>
        ` : ''}
      </div>
      
      <div class="bank-details">
        <div class="bank-title">Información de Pago</div>
        <div class="bank-item"><strong>Banco:</strong> BCI</div>
        <div class="bank-item"><strong>Tipo de Cuenta:</strong> Cuenta Corriente</div>
        <div class="bank-item"><strong>N° de Cuenta:</strong> 13750780</div>
        <div class="bank-item"><strong>RUT:</strong> 76.812.285-K</div>
        <div class="bank-item"><strong>Email Comprobante:</strong> cobranza@ecomoving.cl</div>
      </div>
      
      <div class="message" style="margin-top: 30px; margin-bottom: 0;">
        ${cierreMsg}
      </div>
    </div>
    
    <div class="footer">
      <div class="closing">Atentamente,</div>
      <div class="signature">Departamento de Cobranzas</div>
      <div style="color: #64748b; font-size: 13px;">Ecomoving SpA</div>
    </div>
    
    <div class="legal">
      Este es un mensaje institucional automático relacionado con su facturación.<br>
      Por favor, si ya realizó el pago, ignore este recordatorio.
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
