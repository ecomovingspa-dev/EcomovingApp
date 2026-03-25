import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role to update blocked status
const supabase = createClient(supabaseUrl, supabaseKey);

const BREVO_API_KEY = process.env.BREVO_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🔄 Iniciando sincronización de estadísticas de Brevo...');
        
        // 1. Obtener eventos de los últimos 7 días
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const response = await axios.get('https://api.brevo.com/v3/smtp/statistics/events', {
            headers: { 'api-key': BREVO_API_KEY },
            params: {
                limit: 100,
                startDate: sevenDaysAgo.toISOString().split('T')[0],
                endDate: now.toISOString().split('T')[0]
            }
        });

        const events = response.data.events || [];
        console.log(`📊 Recibidos ${events.length} eventos de Brevo.`);

        const updates = [];

        // 2. Procesar eventos y mapear estados
        for (const event of events) {
            const email = event.email;
            const status = event.event; // 'delivered', 'opened', 'hard_bounce', 'soft_bounce', 'blocked', 'invalid_email'
            
            // Determinar si debe marcarse como bloqueado
            const isBlocked = ['hard_bounce', 'blocked', 'invalid_email', 'unsubscribed'].includes(status);

            updates.push(
                supabase
                    .from('contactos')
                    .update({ 
                        ultimo_estado_brevo: status,
                        es_bloqueado: isBlocked 
                    })
                    .eq('correo', email)
            );
        }

        await Promise.all(updates);

        return res.status(200).json({ 
            success: true, 
            processed: events.length,
            message: 'Sincronización completada exitosamente' 
        });

    } catch (error: any) {
        console.error('❌ Error en sincronización:', error.response?.data || error.message);
        return res.status(500).json({ error: error.message });
    }
}
