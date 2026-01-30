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

        // 2. Definir ventana de tiempo (5 días: hoy + 4 anteriores) con zona horaria de Chile
        const fechasABuscar: string[] = [];
        const hoy = new Date();

        for (let i = 0; i < 5; i++) {
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
                // Consultar LICITACIONES
                const urlLicit = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fechaStr}&ticket=${TICKET}`;
                const respLicit = await axios.get(urlLicit, { timeout: 15000 });

                if (respLicit.data && Array.isArray(respLicit.data.Listado)) {
                    todasLasLicitaciones = [...todasLasLicitaciones, ...respLicit.data.Listado];
                    logs.push(`Licit ${fechaStr}: ${respLicit.data.Listado.length}`);
                }

                // Consultar ORDENES DE COMPRA tipo Compra Ágil (AG = código 13)
                const urlOC = `https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?fecha=${fechaStr}&ticket=${TICKET}`;
                const respOC = await axios.get(urlOC, { timeout: 15000 });

                if (respOC.data && Array.isArray(respOC.data.Listado)) {
                    // Filtrar solo las de tipo Compra Ágil
                    const comprasAgiles = respOC.data.Listado.filter((oc: any) =>
                        oc.Tipo === 'AG' || oc.CodigoTipo === 13 || oc.Codigo?.includes('COT')
                    );
                    // Mapear a formato compatible con licitaciones
                    const ocMapeadas = comprasAgiles.map((oc: any) => ({
                        CodigoExterno: oc.Codigo || oc.CodigoExterno,
                        Nombre: oc.Nombre || oc.Descripcion || `Compra Ágil ${oc.Codigo}`,
                        Descripcion: oc.Descripcion || '',
                        FechaCierre: oc.Fechas?.FechaEnvio || oc.FechaEnvio || null,
                        esCompraAgil: true
                    }));
                    todasLasLicitaciones = [...todasLasLicitaciones, ...ocMapeadas];
                    logs.push(`OC-AG ${fechaStr}: ${comprasAgiles.length}`);
                }
            } catch (err: any) {
                logs.push(`${fechaStr}: Error (${err.message})`);
            }
        }

        // 3. Log de diagnóstico: contar tipos
        const comprasAgiles = todasLasLicitaciones.filter((l: any) => l.CodigoExterno?.includes('COT'));
        const licitacionesNormales = todasLasLicitaciones.filter((l: any) => l.CodigoExterno?.includes('-L'));
        logs.push(`TOTAL: ${todasLasLicitaciones.length} | Compras Ágiles (COT): ${comprasAgiles.length} | Licitaciones (L): ${licitacionesNormales.length}`);

        // 4. Filtrar por keywords (Deduplicar primero)
        const unicasVistas = Array.from(new Map(todasLasLicitaciones.map((l: any) => [l.CodigoExterno, l])).values());

        const filtradas = unicasVistas.filter((lic: any) => {
            // Las Compras Ágiles (COT) siempre pasan porque sus campos vienen vacíos en el resumen
            if (lic.CodigoExterno?.includes('COT')) {
                return true;
            }

            // Para licitaciones normales, aplicar filtro de keywords
            const nombre = (lic.Nombre || "").toLowerCase();
            const descripcion = (lic.Descripcion || "").toLowerCase();
            const textoCompleto = nombre + " " + descripcion;

            return PALABRAS_CLAVE.some((kw: string) => {
                if (kw.length <= 3) {
                    return new RegExp(`\\b${kw}\\b`, "i").test(textoCompleto);
                }
                return textoCompleto.includes(kw);
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

                    // Construir texto de búsqueda con los 4 campos
                    const nombreLower = (d.Nombre || "").toLowerCase();
                    const descLower = (d.Descripcion || "").toLowerCase();

                    // Extraer texto de Items (si existen)
                    let itemsTexto = "";
                    if (Array.isArray(d.Items)) {
                        itemsTexto = d.Items.map((item: any) =>
                            `${item.NombreProducto || ""} ${item.Descripcion || ""}`
                        ).join(" ").toLowerCase();
                    }

                    const textoCompleto = `${nombreLower} ${descLower} ${itemsTexto}`;

                    const matches = PALABRAS_CLAVE.filter((kw: string) => {
                        if (kw.length <= 3) return new RegExp(`\\b${kw}\\b`, "i").test(textoCompleto);
                        return textoCompleto.includes(kw);
                    }).join(", ");

                    // Log de campos de fecha disponibles para depuración
                    console.log(`[${d.CodigoExterno}] Campos fecha: FechaCierre=${d.FechaCierre}, Fechas.FechaCierre=${d.Fechas?.FechaCierre}, FechaFinal=${d.FechaFinal}`);

                    // Usar FechaCierre con múltiples fallbacks
                    const fechaCierre = d.FechaCierre || d.Fechas?.FechaCierre || d.FechaFinal || d.Fechas?.FechaFinal || null;

                    await supabase.from('oportunidades').upsert({
                        id: d.CodigoExterno,
                        nombre: d.Nombre,
                        organismo: d.Comprador ? d.Comprador.NombreOrganismo : "Desconocido",
                        fecha_cierre: fechaCierre,
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
