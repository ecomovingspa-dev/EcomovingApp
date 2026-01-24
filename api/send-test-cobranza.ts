
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Supabase Init
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Brevo Init
const BREVO_API_KEY = process.env.BREVO_API_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // 3. Construir HTML (Misma lógica que cron-cobranza.ts)
    const asunto = regla.asunto_template
      .replace('{folio}', String(mockFactura.folio))
      .replace('{dias}', String(mockFactura.diasAtraso));

    const introMsg = regla.mensaje_intro.replace('{dias}', String(mockFactura.diasAtraso));
    const cierreMsg = regla.mensaje_cierre.replace('{dias}', String(mockFactura.diasAtraso));

    const bloqueDiasVencidos = mockFactura.diasAtraso > 0 && regla.dias_min > 0 ? `
        <div style="background-color: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #856404; font-weight: 600;">Días de Vencimiento</p>
        <p style="margin: 0; font-size: 20px; color: #856404; font-weight: 700;">${mockFactura.diasAtraso} días</p>
        </div>
    ` : '';

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
    .mode-test { background-color: #f0fdf4; border: 1px dashed #22c55e; color: #15803d; padding: 12px; font-size: 12px; text-align: center; margin-bottom: 25px; border-radius: 4px; }
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
      <div class="mode-test"><strong>MODO PRUEBA:</strong> Este es un ejemplo de cómo se verá el correo real.</div>
      
      <div class="greeting">Estimado/a ${mockFactura.contacto},</div>
      
      <div class="message">
        ${introMsg}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Documento</span>
          <span class="value">Factura Electrónica N° ${mockFactura.folio}</span>
        </div>
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; width: 50%;">
            <span class="label">Fecha Emisión</span>
            <span class="value">${mockFactura.fechaEmision}</span>
          </div>
          <div style="display: table-cell; width: 50%;">
            <span class="label">Fecha Vencimiento</span>
            <span class="value" style="${mockFactura.diasAtraso > 0 ? 'color: #dc2626; font-weight: 600;' : ''}">${mockFactura.fechaVencimiento}</span>
          </div>
        </div>
        <div class="info-item" style="margin-top: 15px; border-bottom: none; border-top: 1px solid #e2e8f0; padding-top: 15px;">
          <span class="label">Monto Total Pendiente</span>
          <span class="value-bold">${mockFactura.montoTotal}</span>
        </div>
        
        ${mockFactura.diasAtraso > 0 ? `
        <div class="status-box status-vencido">
          <span class="label">Situación</span>
          <span class="value" style="font-weight: 700;">Vencida hace ${mockFactura.diasAtraso} días</span>
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
      Este es un mensaje institucional automático de PRUEBA.<br>
      Generado por el sistema administrativo de Ecomoving.
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
