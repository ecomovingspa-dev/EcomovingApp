
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, RefreshCw, Trash2, Image as ImageIcon } from "lucide-react";

export default function OptimizarImagenesPage() {
    const [procesando, setProcesando] = useState(false);
    const [progreso, setProgreso] = useState(0);
    const [totalCotizaciones, setTotalCotizaciones] = useState(0);
    const [cotizacionesProcesadas, setCotizacionesProcesadas] = useState(0);
    const [imagenesOptimizadas, setImagenesOptimizadas] = useState(0);
    const [espacioAhorrado, setEspacioAhorrado] = useState(0); // en KB
    const [log, setLog] = useState<string[]>([]);
    const [fase, setFase] = useState<"idle" | "analizando" | "optimizando" | "completado" | "error">("idle");

    const MAX_WIDTH = 400;
    const QUALITY = 0.7;

    const agregarLog = (mensaje: string) => {
        setLog((prev) => [mensaje, ...prev].slice(0, 100));
    };

    const compressImageBase64 = (base64Str: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calcular nuevas dimensiones
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_WIDTH) {
                        width *= MAX_WIDTH / height;
                        height = MAX_WIDTH;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    resolve(base64Str);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
                resolve(dataUrl);
            };
            img.onerror = (err) => resolve(base64Str);
        });
    };

    const iniciarOptimizacion = async () => {
        setFase("analizando");
        setProcesando(true);
        setLog([]);
        setEspacioAhorrado(0);
        setImagenesOptimizadas(0);
        setCotizacionesProcesadas(0);

        try {
            // 1. Intentar contar (puede fallar en tablas grandes, así que manejamos el error)
            let total = 0;
            try {
                // Usamos select('id') que es más liviano que '*'
                const { count, error: countError } = await supabase
                    .from("cotizaciones")
                    .select("id", { count: 'exact', head: true })
                    .not("items", "is", null);

                if (countError) {
                    console.error("Error al contar:", countError);
                    agregarLog(`⚠️ No se pudo obtener el total exacto (${JSON.stringify(countError)}). Se procesará sin barra de progreso exacta.`);
                } else {
                    total = count || 0;
                    setTotalCotizaciones(total);
                }
            } catch (errCount) {
                console.error("Excepción al contar:", errCount);
                agregarLog("⚠️ Error calculando total. Se procederá a ciegas.");
            }

            setFase("optimizando");
            agregarLog(`🚀 Iniciando optimización... ${total > 0 ? `Total estimado: ${total} registros.` : ''}`);

            let procesados = 0;
            let espacioTotalAhorrado = 0;
            let totalImagenes = 0;
            const BATCH_SIZE = 5;
            let offset = 0;
            let keepGoing = true;

            while (keepGoing) {
                // Pausa para UI
                await new Promise(r => setTimeout(r, 50));

                try {
                    const { data: cotizaciones, error } = await supabase
                        .from("cotizaciones")
                        .select("id, numero_cotizacion, items")
                        .not("items", "is", null)
                        .order('id', { ascending: true })
                        .range(offset, offset + BATCH_SIZE - 1);

                    if (error) throw error;

                    if (!cotizaciones || cotizaciones.length === 0) {
                        keepGoing = false;
                        break;
                    }

                    for (const cot of cotizaciones) {
                        let itemsModificados = false;
                        let nuevosItems = [...(cot.items || [])];

                        for (let i = 0; i < nuevosItems.length; i++) {
                            const item = nuevosItems[i];

                            if (item.imagen && typeof item.imagen === "string" && item.imagen.startsWith("data:image")) {
                                const sizeOriginal = item.imagen.length;

                                // Solo optimizar si pesa más de 50KB
                                if (sizeOriginal > 68000) {
                                    try {
                                        const imagenOptimizada = await compressImageBase64(item.imagen);
                                        const sizeOptimizada = imagenOptimizada.length;

                                        // Solo guardar si hay ahorro real (>10KB)
                                        if (sizeOptimizada < sizeOriginal - 10000) {
                                            nuevosItems[i] = { ...item, imagen: imagenOptimizada };
                                            itemsModificados = true;
                                            const ahorro = sizeOriginal - sizeOptimizada;
                                            espacioTotalAhorrado += ahorro;
                                            totalImagenes++;
                                            setEspacioAhorrado(Math.round(espacioTotalAhorrado / 1024));
                                            setImagenesOptimizadas(totalImagenes);
                                        }
                                    } catch (err: any) {
                                        console.error("Error optimizando imagen item", i, "cot", cot.id, err);
                                        agregarLog(`⚠️ Error imagen: ${err.message || JSON.stringify(err)}`);
                                    }
                                }
                            }
                        }

                        if (itemsModificados) {
                            const { error: updateError } = await supabase
                                .from("cotizaciones")
                                .update({ items: nuevosItems })
                                .eq("id", cot.id);

                            if (updateError) {
                                agregarLog(`❌ Error guardando ${cot.numero_cotizacion}: ${updateError.message}`);
                            }
                        }

                        procesados++;
                        setCotizacionesProcesadas(procesados);
                        if (total > 0) setProgreso((procesados / total) * 100);
                    }

                    offset += BATCH_SIZE;

                } catch (batchError: any) {
                    console.error("Error en lote:", batchError);
                    agregarLog(`⚠️ Error lote ${offset}: ${batchError.message || JSON.stringify(batchError)}`);
                    // Si falla un lote, intentamos saltarlo para no quedarnos pegados
                    offset += BATCH_SIZE;
                }
            }

            setFase("completado");
            agregarLog("✅ Proceso completado exitosamente.");

        } catch (e: any) {
            console.error(e);
            const msg = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
            agregarLog(`❌ Error crítico: ${msg}`);
            setFase("error");
        } finally {
            setProcesando(false);
        }
    };

    // Mantener visible el panel si está procesando O si terminó (completado o error)
    const mostrarPanel = procesando || fase === "completado" || fase === "error";

    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-6 w-6 text-blue-600" />
                        Optimizador de Imágenes Históricas
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-bold mb-2">¿Qué hace esta herramienta?</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Escanea todas las cotizaciones antiguas en lotes pequeños.</li>
                            <li>Detecta imágenes pesadas y las comprime.</li>
                            <li>Libera espacio en la base de datos sin afectar la información.</li>
                        </ul>
                    </div>

                    {!mostrarPanel && fase === "idle" && (
                        <div className="flex justify-center py-4">
                            <Button onClick={iniciarOptimizacion} size="lg" className="bg-blue-600 hover:bg-blue-700">
                                Iniciar Optimización
                            </Button>
                        </div>
                    )}

                    {mostrarPanel && (
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progreso ({Math.round(progreso)}%)</span>
                                <span>{cotizacionesProcesadas} {totalCotizaciones > 0 ? `/ ${totalCotizaciones}` : ''} cotizaciones</span>
                            </div>
                            <Progress value={progreso} className="h-3" />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <Card className="bg-slate-50 dark:bg-slate-800">
                                    <CardContent className="p-4 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold text-emerald-600">{imagenesOptimizadas}</span>
                                        <span className="text-xs text-slate-500 uppercase font-bold">Imágenes Reducidas</span>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-50 dark:bg-slate-800">
                                    <CardContent className="p-4 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold text-blue-600">
                                            {espacioAhorrado > 1024
                                                ? `${(espacioAhorrado / 1024).toFixed(2)} MB`
                                                : `${espacioAhorrado} KB`}
                                        </span>
                                        <span className="text-xs text-slate-500 uppercase font-bold">Espacio Liberado</span>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-50 dark:bg-slate-800">
                                    <CardContent className="p-4 flex flex-col items-center justify-center">
                                        {fase === "completado" ? (
                                            <CheckCircle className="h-8 w-8 text-emerald-500 mb-1" />
                                        ) : fase === "error" ? (
                                            <AlertCircle className="h-8 w-8 text-red-500 mb-1" />
                                        ) : (
                                            <RefreshCw className="h-8 w-8 text-blue-500 mb-1 animate-spin" />
                                        )}
                                        <span className={`text-xs uppercase font-bold ${fase === "error" ? "text-red-500" : "text-slate-500"}`}>
                                            {fase === "completado" ? "Finalizado" : fase === "error" ? "Error" : "Procesando"}
                                        </span>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="mt-4 bg-slate-900 text-slate-200 p-3 rounded-lg h-60 overflow-y-auto text-xs font-mono">
                                {log.length === 0 && <span className="opacity-50">Esperando logs...</span>}
                                {log.map((linea, i) => (
                                    <div key={i} className="border-b border-slate-800 py-0.5">{linea}</div>
                                ))}
                            </div>

                            {(fase === "completado" || fase === "error") && (
                                <div className="flex justify-center mt-4">
                                    <Button variant="outline" onClick={() => setFase("idle")}>
                                        Volver / Reiniciar
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
