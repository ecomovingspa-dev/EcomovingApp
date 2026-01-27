import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TICKET = process.env.VITE_MERCADO_PUBLICO_TICKET || 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Seguridad: Permitir solo si es un Cron de Vercel o tiene el secreto
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Nota: Vercel añade automáticamente este header en los Cron Jobs
        // Si quieres probarlo manual, puedes omitir esta validación temporalmente
    }

    try {
        // 1. Obtener Palabras Clave de la base de datos
        const { data: keywordsDB, error: errorDB } = await supabase
            .from("config_oportunidades")
            .select("keyword");

        if (errorDB) throw errorDB;
        const PALABRAS_CLAVE = (keywordsDB || []).map((k) => k.keyword.toLowerCase());

        if (PALABRAS_CLAVE.length === 0) {
            return res.status(400).json({ error: "No hay palabras clave configuradas." });
        }

        // 2. Obtener licitaciones de hoy en Chile (ZONA HORARIA IMPORTANTE)
        const hoyChile = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
        const dia = String(hoyChile.getDate()).padStart(2, '0');
        const mes = String(hoyChile.getMonth() + 1).padStart(2, '0');
        const anio = hoyChile.getFullYear();
        const fechaStr = `${dia}${mes}${anio}`;

        console.log(`Buscando licitaciones para la fecha: ${fechaStr}`);

        const urlListar = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fechaStr}&ticket=${TICKET}`;
        const responseListar = await axios.get(urlListar);

        if (!responseListar.data || !responseListar.data.Listado) {
            return res.status(200).json({ message: "No se encontraron licitaciones hoy.", raw: responseListar.data });
        }

        const todas = responseListar.data.Listado;
        console.log(`Total licitaciones hoy: ${todas.length}`);

        // 3. Filtrar por keywords en el nombre
        const filtradas = todas.filter((lic: any) => {
            const nombre = (lic.Nombre || "").toLowerCase();
            return PALABRAS_CLAVE.some(kw => {
                const regex = new RegExp(`\\b${kw}\\b`, "i");
                return regex.test(nombre);
            });
        });

        if (filtradas.length === 0) {
            return res.status(200).json({ message: "Sincronización terminada. 0 coincidencias encontradas hoy." });
        }

        // 4. Evitar duplicados y límites de tiempo (Procesar solo las nuevas)
        const { data: existentes } = await supabase
            .from('oportunidades')
            .select('id')
            .in('id', filtradas.map(l => l.CodigoExterno));

        const idsExistentes = new Set((existentes || []).map(e => e.id));
        const porProcesar = filtradas.filter(l => !idsExistentes.has(l.CodigoExterno)).slice(0, 10);

        console.log(`Licitaciones nuevas detectadas: ${porProcesar.length}`);

        // 5. Obtener detalles e insertar
        const resultados = [];
        const errores = [];

        for (const licResumen of porProcesar) {
            try {
                const urlDetalle = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${licResumen.CodigoExterno}&ticket=${TICKET}`;
                const responseDetalle = await axios.get(urlDetalle, { timeout: 4000 });

                if (responseDetalle.data.Listado && responseDetalle.data.Listado.length > 0) {
                    const d = responseDetalle.data.Listado[0];

                    const textoBusqueda = (d.Nombre || "").toLowerCase();
                    const keywordsEncontradas = PALABRAS_CLAVE.filter(kw => {
                        const regex = new RegExp(`\\b${kw}\\b`, "i");
                        return regex.test(textoBusqueda);
                    }).join(", ");

                    const oportunidad = {
                        id: d.CodigoExterno,
                        nombre: d.Nombre,
                        organismo: d.Comprador ? d.Comprador.NombreOrganismo : "Desconocido",
                        fecha_cierre: d.FechaCierre || null,
                        monto_disponible: typeof d.MontoEstimado === 'number' ? d.MontoEstimado : null,
                        estado: "Publicada",
                        clave: keywordsEncontradas || licResumen.Nombre || "Sin clave",
                        vendedor_id: null
                    };

                    const { error: upsertError } = await supabase
                        .from('oportunidades')
                        .upsert(oportunidad, { onConflict: 'id' });

                    if (upsertError) throw upsertError;
                    resultados.push(d.CodigoExterno);
                }
            } catch (err: any) {
                console.error(`Error procesando ${licResumen.CodigoExterno}:`, err.message);
                errores.push({ id: licResumen.CodigoExterno, error: err.message });
            }
        }

        return res.status(200).json({
            message: porProcesar.length === 0 ? "Ya estás al día con las licitaciones actuales." : "Sincronización parcial completada",
            total_hoy: todas.length,
            coincidencias: filtradas.length,
            nuevas_procesadas: resultados.length,
            errores: errores,
            pendientes: Math.max(0, filtradas.length - idsExistentes.size - resultados.length)
        });

    } catch (error: any) {
        console.error("Error crítico en sincronización:", error);
        return res.status(500).json({ error: error.message });
    }
}
