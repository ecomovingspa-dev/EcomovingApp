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
    const [fase, setFase] = useState<"idle" | "analizando" | "optimizando" | "completado">("idle");

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

                // Si ya es pequeña, no hacer nada
                if (width <= MAX_WIDTH && height <= MAX_WIDTH) {
                    // Aún así podríamos querer comprimir si el formato es pesado (PNG vs JPEG)
                    // Pero por seguridad, si es chica, devolvemos null para indicar "sin cambios"
                    // A menos que sea PNG pesado.
                    // Para simplificar: Siempre redimensionamos/comprimimos si es mayor a X bytes
                    // Pero aquí estamos dentro del onload.
                }

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
            img.onerror = (err) => resolve(base64Str); // Si falla, devolver original
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
            // 1. Obtener todas las cotizaciones con items
            // Traemos solo ID e ITEMS para no cargar todo
            const { data: cotizaciones, error, count } = await supabase
                .from("cotizaciones")
                .select("id, numero_cotizacion, items")
                .not("items", "is", null);

            if (error) throw error;

            if (!cotizaciones || cotizaciones.length === 0) {
                agregarLog("No se encontraron cotizaciones para procesar.");
                setFase("idle");
                setProcesando(false);
                return;
            }

            setTotalCotizaciones(cotizaciones.length);
            setFase("optimizando");
            agregarLog(`Se encontraron ${cotizaciones.length} cotizaciones. Iniciando optimización...`);

            let procesados = 0;
            let espacioTotalAhorrado = 0;
            let totalImagenes = 0;

            for (const cot of cotizaciones) {
                procesados++;
                setCotizacionesProcesadas(procesados);
                setProgreso((procesados / cotizaciones.length) * 100);

                let itemsModificados = false;
                let nuevosItems = [...(cot.items || [])];

                for (let i = 0; i < nuevosItems.length; i++) {
                    const item = nuevosItems[i];

                    // Verificar si tiene imagen y si esa imagen parece ser un Base64 pesado
                    // Un Base64 de imagen suele empezar con "data:image/"
                    if (item.imagen && typeof item.imagen === "string" && item.imagen.startsWith("data:image")) {
                        // Estimación aproximada de tamaño: longitud del string
                        const sizeOriginal = item.imagen.length;

                        // Solo optimizar si pesa más de 100KB (aprox 133k caracteres base64)
                        if (sizeOriginal > 100000) {
                            try {
                                const imagenOptimizada = await compressImageBase64(item.imagen);
                                const sizeOptimizada = imagenOptimizada.length;

                                if (sizeOptimizada < sizeOriginal) {
                                    nuevosItems[i] = { ...item, imagen: imagenOptimizada };
                                    itemsModificados = true;
                                    const ahorro = sizeOriginal - sizeOptimizada;
                                    espacioTotalAhorrado += ahorro;
                                    totalImagenes++;
                                    setEspacioAhorrado(Math.round(espacioTotalAhorrado / 1024)); // KB
                                    setImagenesOptimizadas(totalImagenes);
                                    // agregarLog(`Optimizado ID ${cot.numero_cotizacion}: Item ${i+1} (-${Math.round(ahorro/1024)}KB)`);
                                }
                            } catch (err) {
                                console.error("Error optimizando imagen item", i, "cot", cot.id, err);
                            }
                        }
                    }
                }

                if (itemsModificados) {
                    // Actualizar en Supabase
                    const { error: updateError } = await supabase
                        .from("cotizaciones")
                        .update({ items: nuevosItems })
                        .eq("id", cot.id);

                    if (updateError) {
                        agregarLog(`❌ Error al guardar cotización ${cot.numero_cotizacion}: ${updateError.message}`);
                    } else {
                        // agregarLog(`✅ Cotización ${cot.numero_cotizacion} actualizada.`);
                    }
                }
            }

            setFase("completado");
            agregarLog("Proceso completado exitosamente.");

        } catch (e: any) {
            console.error(e);
            agregarLog(`❌ Error crítico: ${e.message}`);
            setFase("idle");
        } finally {
            setProcesando(false);
        }
    };

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
                            <li>Escanea todas las cotizaciones antiguas.</li>
                            <li>Detecta imágenes pesadas guardadas incorrectamente.</li>
                            <li>Las redimensiona a máximo 400px y las comprime (JPEG 70%).</li>
                            <li>Reemplaza los datos en la base de datos para ahorrar espacio.</li>
                        </ul>
                        <p className="mt-2 text-xs opacity-75">
                            Nota: Este proceso puede tomar varios minutos. No cierres esta pestaña.
                        </p>
                    </div>

                    {!procesando && fase === "idle" && (
                        <div className="flex justify-center py-4">
                            <Button onClick={iniciarOptimizacion} size="lg" className="bg-blue-600 hover:bg-blue-700">
                                Iniciar Optimización
                            </Button>
                        </div>
                    )}

                    {(procesando || fase === "completado") && (
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progreso ({Math.round(progreso)}%)</span>
                                <span>{cotizacionesProcesadas} / {totalCotizaciones} cotizaciones</span>
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
                                        ) : (
                                            <RefreshCw className="h-8 w-8 text-blue-500 mb-1 animate-spin" />
                                        )}
                                        <span className="text-xs text-slate-500 uppercase font-bold">
                                            {fase === "completado" ? "Finalizado" : "Procesando"}
                                        </span>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="mt-4 bg-slate-900 text-slate-200 p-3 rounded-lg h-48 overflow-y-auto text-xs font-mono">
                                {log.length === 0 && <span className="opacity-50">Esperando logs...</span>}
                                {log.map((linea, i) => (
                                    <div key={i} className="border-b border-slate-800 py-0.5">{linea}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
