
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './utils/supabase';
import axios from 'axios';

// Brevo Init
const BREVO_API_KEY = process.env.BREVO_API_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, ruleId } = req.body;

  if (!email || !ruleId) {
    return res.status(400).json({ error: 'Faltan datos (email o ruleId)' });
  }

  try {
    // 1. Obtener la configuración de la regla seleccionada
    const { data: regla, error: dbError } = await supabase
      .from('configuracion_cobranza')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (dbError || !regla) {
      throw new Error('No se encontró la regla de cobranza.');
    }

    // 2. Datos Simulados (Mock Data)
    const mockFactura = {
      folio: 12345,
      contacto: "Cliente de Prueba",
      fechaEmision: new Date().toLocaleDateString('es-CL'),
      fechaVencimiento: new Date(Date.now() - (Math.abs(regla.dias_min) * 86400000)).toLocaleDateString('es-CL'), // Calculamos fecha para que coincida con los días
      montoTotal: "$ 1.500.000",
      diasAtraso: Math.abs(regla.dias_min)
    };

    // 3. Construir HTML (Misma lógica que cron-daily.ts)
    const asunto = regla.asunto_template
      .replace('{folio}', String(mockFactura.folio))
      .replace('{dias}', String(mockFactura.diasAtraso));

    const introMsg = regla.mensaje_intro.replace('{dias}', String(mockFactura.diasAtraso));
    const cierreMsg = regla.mensaje_cierre.replace('{dias}', String(mockFactura.diasAtraso));


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
    .mode-test { background-color: #f0fdf4; border: 1px dashed #22c55e; color: #15803d; padding: 12px; font-size: 12px; text-align: center; margin-bottom: 25px; border-radius: 4px; }
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
      <h1>Estado de Cuenta (Prueba)</h1>
      <p>Ecomoving SpA &bull; Departamento de Cobranzas</p>
    </div>
    
    <div class="content">
      <div class="mode-test"><strong>MODO PRUEBA:</strong> Este es un ejemplo de cómo se verá el correo real.</div>
      
      <div class="greeting">Estimado/a ${mockFactura.contacto},</div>
      
      <div class="message">
        ${introMsg}
      </div>
      
      <div class="info-block">
        <span class="info-title">Resumen del Documento</span>
        <div class="info-item"><span>N° de Factura:</span> <strong>${mockFactura.folio}</strong></div>
        <div class="info-item"><span>Fecha de Emisión:</span> <strong>${mockFactura.fechaEmision}</strong></div>
        <div class="info-item"><span>Fecha de Vencimiento:</span> <strong style="${mockFactura.diasAtraso > 0 ? 'color: #ef4444;' : ''}">${mockFactura.fechaVencimiento}</strong></div>
        <div class="info-item" style="margin-top: 15px; padding-top: 12px; border-top: 2px solid #e2e8f0; border-bottom: none;">
          <span>Monto Pendiente:</span> <strong style="font-size: 18px;">${mockFactura.montoTotal}</strong>
        </div>
        ${mockFactura.diasAtraso > 0 ? `
        <div class="info-item" style="margin-top: 10px; border-bottom: none; padding-bottom: 0;">
          <span style="color: #9a3412;">Situación actual:</span> <strong style="color: #9a3412; background-color: #fff7ed; padding: 2px 8px; border-radius: 4px;">Atraso de ${mockFactura.diasAtraso} días</strong>
        </div>
        ` : ''}
      </div>
      
      <div class="info-block">
        <span class="info-title">Instrucciones de Pago</span>
        <div class="info-item"><span>Banco:</span> <strong>BCI</strong></div>
        <div class="info-item"><span>Tipo de Cuenta:</span> <strong>Cuenta Corriente</strong></div>
        <div class="info-item"><span>N° de Cuenta:</span> <strong>13750780</strong></div>
        <div class="info-item"><span>RUT:</span> <strong>76.812.285-K</strong></div>
        <div class="info-item" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0; border-bottom: none; font-size: 12px;">
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
      Este es un mensaje institucional automático de PRUEBA.<br>
      Generado por el sistema de gestión Ecomoving App.
    </div>
  </div>
</body>
</html>`;
    // 4. Enviar vía Brevo
    const emailPayload = {
      sender: { name: "Ecomoving Cobranza (Test)", email: "cobranza@ecomoving.cl" },
      to: [{ email: email }],
      subject: `[PRUEBA] ${asunto}`,
      htmlContent: htmlContent
    };

    await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    });

    return res.status(200).json({ success: true, message: 'Correo enviado correctamente' });

  } catch (err: any) {
    console.error('Test Email Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
