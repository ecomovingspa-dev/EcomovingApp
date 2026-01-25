
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

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #334155; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: #0f172a; padding: 40px 30px; text-align: left; border-bottom: 4px solid #3b82f6; }
    .header h1 { margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; }
    .header p { margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500; }
    .content { padding: 40px; }
    .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 20px; }
    .message { font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 30px; }
    
    .info-block { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 25px; }
    .info-title { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 1px; display: block; border-left: 3px solid #3b82f6; padding-left: 12px; }
    .info-item { font-size: 13px; margin-bottom: 10px; color: #475569; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .info-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
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
      
      <div class="message">
        ${introMsg}
      </div>
      
      <div class="info-block">
        <span class="info-title">Resumen del Documento</span>
        <div class="info-item"><span>N° de Factura:</span> <strong>${folio}</strong></div>
        <div class="info-item"><span>Fecha de Emisión:</span> <strong>${fechaEmision}</strong></div>
        <div class="info-item"><span>Fecha de Vencimiento:</span> <strong style="${diffDias > 0 ? 'color: #ef4444;' : ''}">${fechaVencimiento}</strong></div>
        <div class="info-item" style="margin-top: 15px; padding-top: 12px; border-top: 2px solid #e2e8f0; border-bottom: none;">
          <span>Monto Pendiente:</span> <strong style="font-size: 18px;">${montoTotal}</strong>
        </div>
        ${diffDias > 0 ? `
        <div class="info-item" style="margin-top: 10px; border-bottom: none; padding-bottom: 0;">
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
        <div class="info-item" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0; border-bottom: none; font-size: 11px;">
          <span>Email Comprobante:</span> <strong>cobranza@ecomoving.cl</strong>
        </div>
      </div>
      
      <div class="message" style="margin-top: 30px; margin-bottom: 0;">
        ${cierreMsg}
      </div>
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
