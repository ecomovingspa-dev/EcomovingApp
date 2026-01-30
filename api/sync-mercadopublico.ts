import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TICKET = process.env.VITE_MERCADO_PUBLICO_TICKET || 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
// Trigger redeploy: 2026-01-29 01:36

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Seguridad: Permitir solo si es un Cron de Vercel o tiene el secreto
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Nota: Vercel añade automáticamente este header en los Cron Jobs
        // Si quieres probarlo manual, puedes omitir esta validación temporalmente
    }

    try {
        // 1. Obtener Palabras Clave
        const { data: keywordsDB, error: errorDB } = await supabase
            .from("config_oportunidades")
            .select("keyword");

        if (errorDB) throw errorDB;
        const PALABRAS_CLAVE = (keywordsDB || []).map((k) => k.keyword.toLowerCase().trim()).filter(k => k.length > 0);

        if (PALABRAS_CLAVE.length === 0) {
            return res.status(400).json({ error: "No hay palabras clave configuradas. Agrega algunas en la sección de Configuración." });
        }

        // 2. Definir ventana de tiempo (3 días) con zona horaria de Chile
        const fechasABuscar = [];
        const hoy = new Date();

        for (let i = 0; i < 3; i++) {
            const fechaChile = new Date(hoy.toLocaleString("en-US", { timeZone: "America/Santiago" }));
            fechaChile.setDate(fechaChile.getDate() - i);

            const diaStr = String(fechaChile.getDate()).padStart(2, '0');
            const mesStr = String(fechaChile.getMonth() + 1).padStart(2, '0');
            const anioStr = fechaChile.getFullYear();

            fechasABuscar.push(`${diaStr}${mesStr}${anioStr}`);
        }

        let todasLasLicitaciones: any[] = [];
        const logs: string[] = [];


        for (const fechaStr of fechasABuscar) {
            try {
                const urlListar = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fechaStr}&ticket=${TICKET}`;
                const responseListar = await axios.get(urlListar, { timeout: 10000 });

                if (responseListar.data && Array.isArray(responseListar.data.Listado)) {
                    todasLasLicitaciones = [...todasLasLicitaciones, ...responseListar.data.Listado];
                    logs.push(`${fechaStr}: ${responseListar.data.Listado.length} items`);
                } else {
                    logs.push(`${fechaStr}: No hay datos o formato inválido`);
                }
            } catch (err: any) {
                logs.push(`${fechaStr}: Error (${err.message})`);
            }
        }

        if (todasLasLicitaciones.length === 0) {
            return res.status(200).json({
                message: "No se recibieron datos de la API de Mercado Público.",
                logs,
                keywords_configuradas: PALABRAS_CLAVE
            });
        }

        // 3. Filtrar por keywords (Deduplicar primero)
        const unicasVistas = Array.from(new Map(todasLasLicitaciones.map(l => [l.CodigoExterno, l])).values());

        const filtradas = unicasVistas.filter((lic: any) => {
            const nombre = (lic.Nombre || "").toLowerCase();
            return PALABRAS_CLAVE.some((kw: string) => {
                // Si la palabra clave es corta, buscar palabra exacta
                if (kw.length <= 3) {
                    return new RegExp(`\\b${kw}\\b`, "i").test(nombre);
                }
                // Si es larga, buscar contención
                return nombre.includes(kw);
            });
        });

        // 4. Evitar duplicados contra DB
        const { data: existentes } = await supabase
            .from('oportunidades')
            .select('id')
            .in('id', filtradas.map((l: any) => l.CodigoExterno));

        const idsExistentes = new Set((existentes || []).map((e: any) => e.id));

        // AUMENTADO: De 20 a 100 para capturar todo el volumen disponible
        const porProcesar = filtradas.filter((l: any) => !idsExistentes.has(l.CodigoExterno)).slice(0, 100);

        // 5. Obtener detalles e insertar
        const resultados = [];
        const errores = [];

        for (const licResumen of porProcesar) {
            try {
                const urlDetalle = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${licResumen.CodigoExterno}&ticket=${TICKET}`;
                // Reducido timeout para mayor velocidad
                const responseDetalle = await axios.get(urlDetalle, { timeout: 5000 });

                if (responseDetalle.data && Array.isArray(responseDetalle.data.Listado) && responseDetalle.data.Listado.length > 0) {
                    const d = responseDetalle.data.Listado[0];
                    const nombreLower = (d.Nombre || "").toLowerCase();
                    const descripcionLower = (d.Descripcion || "").toLowerCase();

                    // MEJORADO: Buscar también en la descripción si el nombre falló
                    const matches = PALABRAS_CLAVE.filter((kw: string) => {
                        if (kw.length <= 3) {
                            const regex = new RegExp(`\\b${kw}\\b`, "i");
                            return regex.test(nombreLower) || regex.test(descripcionLower);
                        }
                        return nombreLower.includes(kw) || descripcionLower.includes(kw);
                    }).join(", ");

                    const oportunidad = {
                        id: d.CodigoExterno,
                        nombre: d.Nombre,
                        organismo: d.Comprador ? d.Comprador.NombreOrganismo : "Desconocido",
                        fecha_cierre: d.FechaCierre || null,
                        monto_disponible: typeof d.MontoEstimado === 'number' ? d.MontoEstimado : null,
                        estado: d.EstadoUnidadCompra || "Publicada",
                        clave: matches || "Match",
                        vendedor_id: null
                    };

                    const { error: upsertError } = await supabase
                        .from('oportunidades')
                        .upsert(oportunidad, { onConflict: 'id' });

                    if (upsertError) throw upsertError;
                    resultados.push(d.CodigoExterno);
                }
                // Pausa mínima para no saturar
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err: any) {
                errores.push({ id: licResumen.CodigoExterno, error: err.message });
            }
        }

        return res.status(200).json({
            message: resultados.length > 0 ? `Éxito: Se procesaron ${resultados.length} nuevas oportunidades.` : "Sincronización completa. No hay nuevos matches.",
            detalles: {
                total_en_mp: unicasVistas.length,
                coincidieron_filtros: filtradas.length,
                nuevas_guardadas: resultados.length,
                omitidas_por_duplicadas: filtradas.length - porProcesar.length
            },
            keywords_usadas: PALABRAS_CLAVE,
            logs,
            errores
        });

    } catch (error: any) {
        console.error("Error crítico sync:", error);
        return res.status(500).json({ error: error.message });
    }
}
