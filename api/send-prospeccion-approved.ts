import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BREVO_API_KEY = (process.env.BREVO_API_KEY || "").trim().replace(/^['"]|['"]$/g, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { contactoId, subject, body } = req.body;

    if (!contactoId || !subject || !body) {
        return res.status(400).json({ error: 'Debes proporcionar todos los campos: contactoId, subject, body' });
    }

    try {
        // 1. Obtener contacto para verificar correo
        const { data: contact, error: cErr } = await supabase
            .from('contactos')
            .select('*')
            .eq('id', contactoId)
            .single();

        if (cErr || !contact) throw new Error("Contacto no encontrado");
        if (!contact.correo?.includes('@')) throw new Error("El contacto no tiene un correo válido");

        // 2. Enviar por Brevo
        const emailPayload = {
            sender: { name: "Ecomoving Prospección", email: "ventas@ecomoving.cl" },
            to: [{ email: contact.correo }],
            subject: subject,
            htmlContent: `
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 10px; border: 1px solid #eee;">
                        <div style="white-space: pre-wrap;">${body}</div>
                        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 13px; color: #777;">
                            <strong>Equipo Ecomoving SpA</strong><br>
                            Especialistas en Merchandising Corporativo Sustentable
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const brevoRes = await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
        });

        // 3. Actualizar estado del contacto (Programar siguiente etapa)
        const etapaActual = parseInt(contact.etapa_envio) || 1;
        const proximoEnvio = new Date();
        proximoEnvio.setDate(proximoEnvio.getDate() + 4); // +4 días por defecto para el siguiente follow-up

        await supabase.from('contactos').update({
            ultimo_envio: new Date().toISOString(),
            proximo_envio: proximoEnvio.toISOString(),
            etapa_envio: etapaActual + 1,
            // Guardamos que este envío fue asistido/aprobado manualmente
            mensaje_id: brevoRes.data?.messageId
        }).eq('id', contactoId);

        // 4. Auditoría / Trazabilidad
        await supabase.from('trazabilidad_correos').insert({
            contacto_id: contactoId,
            email: contact.correo,
            fecha: new Date().toISOString().split('T')[0],
            estado: 'sent_approved_ia',
            mensaje_id: brevoRes.data?.messageId
        });

        return res.status(200).json({ success: true, messageId: brevoRes.data?.messageId });

    } catch (err: any) {
        console.error("Error enviando correo aprobado:", err);
        return res.status(500).json({ error: err.message });
    }
}
