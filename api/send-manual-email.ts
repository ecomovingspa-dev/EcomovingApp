import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BREVO_KEY_CLEAN = BREVO_API_KEY?.startsWith("xkeysib-") ? BREVO_API_KEY : process.env.BREVO_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Manejar CORS si es necesario
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { to, subject, body, vendedor } = req.body;

    if (!to || !subject || !body || !vendedor) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos: to, subject, body, vendedor' });
    }

    try {
        // Mapeo de datos dinámicos del vendedor
        const telefonos: Record<string, string> = {
            "Mario Osorio C.": "+56 9 7958 7293",
            "Jimena Lara F.": "+56 9 6528 0052"
        };
        const correos: Record<string, string> = {
            "Mario Osorio C.": "mario@ecomoving.cl",
            "Jimena Lara F.": "jimena@ecomoving.cl"
        };

        const tel = telefonos[vendedor] || "+56 9 7958 7293";
        const emailVendedor = correos[vendedor] || "ventas@ecomoving.cl";

        // Limpiar la firma de texto plano del cuerpo del mensaje si el usuario la incluyó en la edición
        let cleanBody = body;
        const firmasABuscar = [
            `Saludos,\n\n${vendedor}\n${tel}\nwww.ecomoving.cl`,
            `Saludos,\n\n${vendedor}\nEcomoving SpA`,
            `Saludos,\n\n${vendedor}`
        ];

        for (const firma of firmasABuscar) {
            if (cleanBody.includes(firma)) {
                cleanBody = cleanBody.replace(firma, "").trim();
                break;
            }
        }

        // Convertir los saltos de línea a etiquetas <br> para el HTML
        const bodyHtml = cleanBody.replace(/\n/g, "<br>");

        // HTML final del correo con el diseño corporativo de firma y logotipo original
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #333333; line-height: 1.5; }
    .content { margin-bottom: 25px; }
    .signature { font-family: Calibri, Arial, sans-serif; margin-top: 25px; }
    .logo-img { height: 45px; margin-top: 10px; margin-bottom: 10px; display: block; border: 0; }
  </style>
</head>
<body>
  <div class="content">
    ${bodyHtml}
  </div>
  <div class="signature">
    <div style="margin-bottom: 12px; color: #555555;">Saludos,</div>
    <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" alt="Ecomoving" class="logo-img" />
    <strong style="font-size: 12pt; color: #111111;">${vendedor}</strong><br>
    <span style="color: #555555;">${tel}</span><br>
    <a href="https://www.ecomoving.cl" style="color: #0284c7; text-decoration: none;">www.ecomoving.cl</a>
  </div>
</body>
</html>
`;

        // Payload de Brevo para envío de correo transaccional
        const emailPayload = {
            sender: { name: vendedor, email: "ventas@ecomoving.cl" },
            to: [{ email: to }],
            replyTo: { name: vendedor, email: emailVendedor },
            subject: subject,
            htmlContent: htmlContent
        };

        // Realizar la petición a Brevo
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
            headers: {
                'api-key': BREVO_KEY_CLEAN,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });

        if (response.status === 201 || response.status === 200) {
            return res.status(200).json({ success: true, messageId: response.data.messageId });
        } else {
            throw new Error(`Error en respuesta de Brevo: ${response.statusText}`);
        }

    } catch (err: any) {
        console.error("Error en send-manual-email:", err.message);
        return res.status(500).json({ error: err.message || 'Error al enviar el correo a través de Brevo' });
    }
}
