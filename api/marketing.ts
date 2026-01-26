import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Env vars
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Security Check
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 2. Query Contacts due for email
    // "estado" is 'Activo' AND ("proximo_envio" is null OR "proximo_envio" <= Today)
    const today = new Date().toISOString().split('T')[0];
    const { data: contacts, error: contactError } = await supabase
      .from('contactos')
      .select('*')
      .eq('estado', 'Activo') // Changed from .eq('activo', true) assuming 'Activo' is the positive value
      .or(`proximo_envio.is.null,proximo_envio.lte.${today}`)
      .limit(300); // Free tier limit

    if (contactError) throw contactError;
    if (!contacts || contacts.length === 0) {
      return res.status(200).json({ message: 'No contacts to process today.' });
    }

    const report = {
      processed: 0,
      sent: 0,
      errors: [] as string[],
    };

    // 3. Process each contact
    for (const contact of contacts) {
      report.processed++;

      try {
        // --- FACTORY LOGIC START ---
        // Fetch content based on sequence index (Step #1 -> nombre_envio = 1)
        let { data: messageData, error: msgError } = await supabase
          .from('marketing')
          .select('*')
          .eq('nombre_envio', contact.indice_secuencia)
          .eq('activo', true) // Only active emails
          .maybeSingle();

        // If no message found, try to restart the sequence
        if (!messageData) {
          const RESTART_INDEX = 1;
          if (contact.indice_secuencia !== RESTART_INDEX) {
            const { data: firstMsg } = await supabase
              .from('marketing')
              .select('*')
              .eq('nombre_envio', RESTART_INDEX)
              .eq('activo', true)
              .maybeSingle();

            if (firstMsg) {
              messageData = firstMsg;
              contact.indice_secuencia = RESTART_INDEX;
            }
          }
        }

        if (!messageData) {
          report.errors.push(`No active content for sequence ${contact.indice_secuencia} (Contact: ${contact.id})`);
          continue;
        }

        // --- ASSET ASSEMBLY (The Factory) ---
        // 1. Get Image URL directly from the manual field (fallback to constructed if empty, though manual is preferred now)
        const bucketName = 'imagenes-marketing';
        let imageUrl = messageData.imagen_url;

        if (!imageUrl && messageData.nombre_imagen) {
          // Fallback for old legacy logic if needed, but manual URL is priority
          imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${messageData.nombre_imagen}`;
        }

        // 2. Fetch Logo URL
        const logoUrl = `${supabaseUrl}/storage/v1/object/public/configuracion/logo.png`;

        // 3. Prepare HTML Content
        let finalHtml = messageData.cuerpo_html || '';

        // Embed the main marketing image replacing the correct placeholder
        if (imageUrl) {
          finalHtml = finalHtml.replace('IMAGE_PLACEHOLDER', imageUrl);
        }

        // No longer appending a signature here because the new FabricaMensajes 
        // generates a complete HTML document with its own logo and footer.

        // 4. Send via Brevo
        const emailPayload = {
          sender: { name: "Ecomoving", email: "ventas@ecomoving.cl" },
          to: [{ email: contact.correo }],
          subject: messageData.asunto,
          htmlContent: finalHtml,
          textContent: messageData.cuerpodetalle || "Ver correo en formato HTML"
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            'accept': 'application/json'
          }
        });

        // 5. Update Contact for the next sequence (+7 days)
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7);

        await supabase
          .from('contactos')
          .update({
            ultimo_envio: new Date().toISOString(),
            proximo_envio: nextDate.toISOString(),
            indice_secuencia: contact.indice_secuencia + 1
          })
          .eq('id', contact.id);

        report.sent++;
        // --- FACTORY LOGIC END ---

      } catch (err: any) {
        console.error(`Error processing contact ${contact.id}:`, err);
        report.errors.push(`Error for ${contact.id}: ${err.message}`);
      }
    }

    return res.status(200).json(report);

  } catch (err: any) {
    console.error('Critical error:', err);
    return res.status(500).json({ error: err.message });
  }
}
