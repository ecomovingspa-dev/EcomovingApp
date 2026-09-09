import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './supabase-client.js';
import axios from 'axios';

const BREVO_API_KEY = process.env.BREVO_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🔄 Iniciando sincronización de estadísticas de Brevo...');
        
        // 1. Obtener eventos de los últimos 90 días (hasta 5000 eventos via paginación)
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        
        let allEvents: any[] = [];
        let offset = 0;
        
        while(true) {
            const response = await axios.get('https://api.brevo.com/v3/smtp/statistics/events', {
                headers: { 'api-key': BREVO_API_KEY },
                params: {
                    limit: 1000,
                    offset: offset,
                    startDate: ninetyDaysAgo.toISOString().split('T')[0],
                    endDate: now.toISOString().split('T')[0]
                }
            });

            const eventsChunk = response.data.events || [];
            allEvents = allEvents.concat(eventsChunk);
            
            if (eventsChunk.length < 1000) break;
            offset += 1000;
            if (offset >= 20000) break; // Límite expandido a 20k para cubrir capa de 6000 correos (cada uno genera 2.5 eventos en promedio)
        }

        const events = allEvents;
        console.log(`📊 Recibidos ${events.length} eventos de Brevo en total.`);

        // 0. Mapear correos a IDs de contactos para asegurar integridad en la trazabilidad
        const { data: contactsBase } = await supabase.from('contactos').select('id, correo');
        const emailMap: Record<string, string> = {};
        contactsBase?.forEach(c => { if(c.correo) emailMap[c.correo.toLowerCase()] = c.id; });

        // 1. Agrupar eventos por email y determinar el "mejor" estado
        const bestStatusPerEmail: Record<string, { status: string, date: string, isBlocked: boolean }> = {};
        const bestStatusPerMessage: Record<string, { email: string, status: string, date: string }> = {};
        const historicalUpdates = [];

        // Definición de importancia de estados
        const statusPriority: Record<string, number> = {
            'opened': 100,
            'unique_opened': 100,
            'loadedbyproxy': 100,
            'clicks': 90,
            'delivered': 80,
            'request': 50,
            'requests': 50,
            'hard_bounce': 200,
            'hardbounces': 200,
            'soft_bounce': 200,
            'softbounces': 200,
            'blocked': 200,
            'spam': 200,
            'invalid_email': 200,
            'invalid': 200,
            'unsubscribed': 200
        };

        for (const event of events) {
            const email = (event.email || "").toLowerCase();
            const status = (event.event || "").toLowerCase();
            const eventDate = event.date;
            const messageId = event.messageId;
            const isBlocked = ['hard_bounce', 'hardbounces', 'blocked', 'invalid_email', 'invalid', 'unsubscribed', 'spam'].includes(status);
            const currentPriority = statusPriority[status] || 0;

            // a) Para el Historial Histórico (Evita sobrescribir eventos importantes de un mismo mensaje)
            if (emailMap[email] && messageId) {
                const existingMsg = bestStatusPerMessage[messageId];
                if (!existingMsg) {
                    bestStatusPerMessage[messageId] = {
                        email: email,
                        status: status,
                        date: eventDate
                    };
                } else {
                    // Mantener la fecha más antigua (fecha de envío original)
                    const existingTime = new Date(existingMsg.date).getTime();
                    const newTime = new Date(eventDate).getTime();
                    if (newTime < existingTime) {
                        existingMsg.date = eventDate;
                    }
                    // Mantener el estado de mayor prioridad (ej: opened > delivered)
                    if (currentPriority > (statusPriority[existingMsg.status] || 0)) {
                        existingMsg.status = status;
                    }
                }
            } else if (emailMap[email] && !messageId) {
                // Fallback si Brevo no envía messageId (raro)
                const payload: any = {
                    contacto_id: emailMap[email],
                    email: email,
                    fecha: eventDate.split('T')[0],
                    estado: status,
                };
                historicalUpdates.push(
                    supabase.from('trazabilidad_correos').insert(payload)
                );
            }

            // b) Para el Perfil de Contacto (Último estado)
            const existing = bestStatusPerEmail[email];
            
            if (!existing || currentPriority > (statusPriority[existing.status] || 0)) {
                bestStatusPerEmail[email] = {
                    status: status,
                    date: eventDate,
                    isBlocked: isBlocked
                };
            }
        }

        // Reemplazo de UPSERT fallido (Error Postgres 42P10: falta de constraint UNIQUE en mensaje_id)
        // en su lugar usamos una estrategia DELETE -> INSERT MASIVO
        
        const messageIds = Object.keys(bestStatusPerMessage);
        const newRecords = Object.entries(bestStatusPerMessage).map(([msgId, data]) => ({
            contacto_id: emailMap[data.email],
            email: data.email,
            fecha: data.date.split('T')[0],
            estado: data.status,
            mensaje_id: msgId
        }));

        // 1. Purgar en bloques de a 200 para los messageIds que recibimos (Bypass de onConflict)
        const chunkSize = 200;
        for (let i = 0; i < messageIds.length; i += chunkSize) {
            const chunk = messageIds.slice(i, i + chunkSize);
            await supabase.from('trazabilidad_correos').delete().in('mensaje_id', chunk);
        }

        // 2. Insertar los nuevos registros puros (ya filtrados a máxima prioridad)
        for (let i = 0; i < newRecords.length; i += chunkSize) {
            const chunk = newRecords.slice(i, i + chunkSize);
            historicalUpdates.push(
                supabase.from('trazabilidad_correos').insert(chunk)
            );
        }

        // 3. Ejecutar inserciones históricas de este lote
        const historicalResults = await Promise.allSettled(historicalUpdates);
        const savedHistory = historicalResults.filter(r => r.status === 'fulfilled').length;
        console.log(`💾 Historial: Insertadas ${newRecords.length} filas en Supabase.`);

        // 3. Actualizar la tabla contactos con el estado consolidado
        const profileUpdates = Object.entries(bestStatusPerEmail).map(([email, data]) => (
            supabase
                .from('contactos')
                .update({ 
                    ultimo_estado_brevo: data.status,
                    es_bloqueado: data.isBlocked,
                })
                .ilike('correo', email) // Case-insensitive matching
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

// Force Redeploy: 2026-04-12T20:45:11.342Z
