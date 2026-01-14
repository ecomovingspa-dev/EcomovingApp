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
        // Fetch content based on sequence index
        // Mapping contact.indice_secuencia -> marketing.id
        let { data: messageData, error: msgError } = await supabase
          .from('marketing')
          .select('*')
          .eq('id', contact.indice_secuencia)
          .maybeSingle();

        // If no message found for this index (end of sequence?), wrap around?
        if (!messageData) {
          // Circular logic: Restart to 1
          const RESTART_INDEX = 1;
          if (contact.indice_secuencia !== RESTART_INDEX) {
            // Try fetching the first one
            const { data: firstMsg } = await supabase
              .from('marketing')
              .select('*')
              .eq('id', RESTART_INDEX)
              .maybeSingle();

            if (firstMsg) {
              messageData = firstMsg;
              // Update contact's sequence to match
              contact.indice_secuencia = RESTART_INDEX;
            }
          }
        }

        if (!messageData) {
          report.errors.push(`No content found for sequence ${contact.indice_secuencia} (Contact: ${contact.id})`);
          continue;
        }

        // 4. Send via Brevo
        const emailPayload = {
          sender: { name: "Mario", email: "mario@tudominio.com" }, // Needs to be configured or dynamic
          to: [{ email: contact.correo }], // Changed from contact.email
          subject: messageData.asunto,
          htmlContent: messageData.html // + maybe tracking pixels?
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', emailPayload, {
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            'accept': 'application/json'
          }
        });

        // 5. Update Contact
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7); // Schedule +7 days

        await supabase
          .from('contactos')
          .update({
            ultimo_envio: new Date().toISOString(),
            proximo_envio: nextDate.toISOString(),
            indice_secuencia: contact.indice_secuencia + 1
          })
          .eq('id', contact.id);

        report.sent++;

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
