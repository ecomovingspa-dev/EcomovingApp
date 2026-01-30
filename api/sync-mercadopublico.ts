import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TICKET = process.env.VITE_MERCADO_PUBLICO_TICKET || 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 1. Obtener Palabras Clave
        const { data: keywordsDB, error: errorDB } = await supabase
            .from("config_oportunidades")
            .select("keyword");

        if (errorDB) throw errorDB;
        const PALABRAS_CLAVE: string[] = (keywordsDB || []).map((k: any) => k.keyword.toLowerCase().trim()).filter((k: string) => k.length > 0);

        if (PALABRAS_CLAVE.length === 0) {
            return res.status(400).json({ error: "No hay palabras clave configuradas." });
        }

        // 2. Definir ventana de tiempo (3 días) con zona horaria de Chile
        const fechasABuscar: string[] = [];
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
                const responseListar = await axios.get(urlListar, { timeout: 15000 });

                if (responseListar.data && Array.isArray(responseListar.data.Listado)) {
                    todasLasLicitaciones = [...todasLasLicitaciones, ...responseListar.data.Listado];
                    logs.push(`${fechaStr}: ${responseListar.data.Listado.length} items`);
                }
            } catch (err: any) {
                logs.push(`${fechaStr}: Error (${err.message})`);
            }
        }

        // 3. Filtrar por keywords (Deduplicar primero)
        const unicasVistas = Array.from(new Map(todasLasLicitaciones.map((l: any) => [l.CodigoExterno, l])).values());

        const filtradas = unicasVistas.filter((lic: any) => {
            const nombre = (lic.Nombre || "").toLowerCase();
            return PALABRAS_CLAVE.some((kw: string) => {
                if (kw.length <= 3) {
                    return new RegExp(`\\b${kw}\\b`, "i").test(nombre);
                }
                return nombre.includes(kw);
            });
        });

        // 4. Evitar duplicados contra DB
        const { data: existentes } = await supabase
            .from('oportunidades')
            .select('id')
            .in('id', filtradas.map((l: any) => l.CodigoExterno));

        const idsExistentes = new Set((existentes || []).map((e: any) => e.id));
        const porProcesar = filtradas.filter((l: any) => !idsExistentes.has(l.CodigoExterno)).slice(0, 100);

        // 5. Obtener detalles e insertar
        const resultados = [];
        for (const licResumen of porProcesar) {
            try {
                const urlDetalle = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${licResumen.CodigoExterno}&ticket=${TICKET}`;
                const responseDetalle = await axios.get(urlDetalle, { timeout: 7000 });

                if (responseDetalle.data && Array.isArray(responseDetalle.data.Listado) && responseDetalle.data.Listado.length > 0) {
                    const d = responseDetalle.data.Listado[0];
                    const nombreLower = (d.Nombre || "").toLowerCase();
                    const descLower = (d.Descripcion || "").toLowerCase();

                    const matches = PALABRAS_CLAVE.filter((kw: string) => {
                        if (kw.length <= 3) return new RegExp(`\\b${kw}\\b`, "i").test(nombreLower) || new RegExp(`\\b${kw}\\b`, "i").test(descLower);
                        return nombreLower.includes(kw) || descLower.includes(kw);
                    }).join(", ");

                    await supabase.from('oportunidades').upsert({
                        id: d.CodigoExterno,
                        nombre: d.Nombre,
                        organismo: d.Comprador ? d.Comprador.NombreOrganismo : "Desconocido",
                        fecha_cierre: d.FechaCierre || null,
                        monto_disponible: typeof d.MontoEstimado === 'number' ? d.MontoEstimado : null,
                        estado: d.EstadoUnidadCompra || "Publicada",
                        clave: matches || "Match",
                        vendedor_id: null
                    }, { onConflict: 'id' });

                    resultados.push(d.CodigoExterno);
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err: any) {
                console.error(`Error procesando ${licResumen.CodigoExterno}:`, err.message);
            }
        }

        return res.status(200).json({
            message: `Sincronización finalizada. ${resultados.length} nuevas oportunidades.`,
            stats: { total: unicasVistas.length, filtradas: filtradas.length, nuevas: resultados.length },
            logs
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
