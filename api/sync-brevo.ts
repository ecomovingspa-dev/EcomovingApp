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

        // 0. Mapear correos a IDs de contactos para asegurar integridad en la trazabilidad
        const { data: contactsBase } = await supabase.from('contactos').select('id, correo');
        const emailMap: Record<string, string> = {};
        contactsBase?.forEach(c => { if(c.correo) emailMap[c.correo.toLowerCase()] = c.id; });

        // 1. Agrupar eventos por email y determinar el "mejor" estado
        const bestStatusPerEmail: Record<string, { status: string, date: string, isBlocked: boolean }> = {};
        const historicalUpdates = [];

        // Definición de importancia de estados
        const statusPriority: Record<string, number> = {
            'opened': 100,
            'unique_opened': 100,
            'loadedbyproxy': 100,
            'clicks': 90,
            'delivered': 80,
            'request': 50,
            'hard_bounce': 200,
            'blocked': 200,
            'spam': 200,
            'invalid_email': 200,
            'unsubscribed': 200
        };

        for (const event of events) {
            const email = (event.email || "").toLowerCase();
            const status = event.event;
            const eventDate = event.date;
            const messageId = event.messageId;
            const isBlocked = ['hard_bounce', 'blocked', 'invalid_email', 'unsubscribed', 'spam'].includes(status);

            // a) Para el Historial Histórico
            if (emailMap[email]) {
                const payload: any = {
                    contacto_id: emailMap[email],
                    email: email,
                    fecha: eventDate.split('T')[0],
                    estado: status,
                };
                if (messageId) payload.mensaje_id = messageId;

                historicalUpdates.push(
                    supabase
                        .from('trazabilidad_correos')
                        .upsert(payload, { onConflict: 'mensaje_id' })
                );
            }

            // b) Para el Perfil de Contacto (Último estado)
            const currentPriority = statusPriority[status] || 0;
            const existing = bestStatusPerEmail[email];
            
            if (!existing || currentPriority > (statusPriority[existing.status] || 0)) {
                bestStatusPerEmail[email] = {
                    status: status,
                    date: eventDate,
                    isBlocked: isBlocked
                };
            }
        }

        // 2. Ejecutar inserciones históricas (con catch individual para evitar falla total si la tabla no existe aún)
        const historicalResults = await Promise.allSettled(historicalUpdates);
        const savedHistory = historicalResults.filter(r => r.status === 'fulfilled').length;
        console.log(`💾 Historial: ${savedHistory} eventos registrados.`);

        // 3. Actualizar la tabla contactos con el estado consolidado
        const profileUpdates = Object.entries(bestStatusPerEmail).map(([email, data]) => (
            supabase
                .from('contactos')
                .update({ 
                    ultimo_estado_brevo: data.status,
                    es_bloqueado: data.isBlocked,
                    // Sincronizar la fecha de último envío si el estado es 'request' o superior 
                    // y es más reciente que el que tenemos? 
                    // Por ahora solo el estado para que el icono cambie en la Matrix v2.0
                })
                .eq('correo', email)
        ));

        await Promise.all(profileUpdates);

        return res.status(200).json({ 
            success: true, 
            processed: events.length,
            history_saved: savedHistory,
            message: 'Sincronización completada con priorización de estados (Opened > Sent)' 
        });

    } catch (error: any) {
        console.error('❌ Error en sincronización:', error.response?.data || error.message);
        return res.status(500).json({ error: error.message });
    }
}
