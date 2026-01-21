
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Departamento de Cobranzas</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ecomoving SpA</p>
    </div>
    
    <!-- Contenido -->
    <div style="padding: 40px;">
      
      <!-- Banner de Prueba -->
      <div style="background-color: #e6fffa; border: 1px dashed #38b2ac; color: #2c7a7b; padding: 10px; font-size: 12px; text-align: center; margin-bottom: 20px; border-radius: 4px;">
        <strong>MODO PRUEBA:</strong> Este es un ejemplo de cómo se verá el correo real.
      </div>

      <p style="margin: 0 0 24px 0; font-size: 15px; color: #2c3e50; line-height: 1.6;">
        Estimado/a <strong>${mockFactura.contacto}</strong>,
      </p>
      
      <div style="margin: 0 0 32px 0; font-size: 15px; color: #2c3e50; line-height: 1.6;">
        ${introMsg}
      </div>
      
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 6px; margin-bottom: 24px;">
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e9ecef;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">Número de Factura</p>
          <p style="margin: 0; font-size: 18px; color: #2c3e50; font-weight: 600;">${mockFactura.folio}</p>
        </div>
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d;">Fecha de Emisión</p>
          <p style="margin: 0; font-size: 15px; color: #2c3e50;">${mockFactura.fechaEmision}</p>
        </div>
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d;">Fecha de Vencimiento</p>
          <p style="margin: 0; font-size: 15px; color: #2c3e50;">${mockFactura.fechaVencimiento}</p>
        </div>
        <div style="margin-bottom: ${mockFactura.diasAtraso > 0 ? '12px' : '0'};">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6c757d;">Monto Total</p>
          <p style="margin: 0; font-size: 20px; color: #2c3e50; font-weight: 700;">${mockFactura.montoTotal}</p>
        </div>
        ${bloqueDiasVencidos}
      </div>
      
      <div style="background-color: #e8f4f8; padding: 20px; border-radius: 6px; border-left: 4px solid #17a2b8; margin-bottom: 32px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #0c5460; font-weight: 600;">Datos para Transferencia</p>
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #0c5460;"><strong>Banco:</strong> BCI</p>
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #0c5460;"><strong>Cuenta Corriente:</strong> 13750780</p>
        <p style="margin: 0; font-size: 14px; color: #0c5460;"><strong>Enviar comprobante a:</strong> cobranza@ecomoving.cl</p>
      </div>
      
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
        Este es un correo de PRUEBA generado por el sistema administrativo.
      </p>
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
