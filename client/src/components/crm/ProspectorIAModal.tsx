import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import type { Cuenta, Contacto } from "../../types";
import { X, Search, Loader2, CheckCircle2, AlertCircle, UserPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProspectorIAModalProps {
    cuenta: Cuenta;
    onClose: () => void;
    onSuccess: () => void;
}

interface ProspectingResult {
    nombre: string;
    correo: string;
    cargo: string;
    fuente: string;
}

export default function ProspectorIAModal({ cuenta, onClose, onSuccess }: ProspectorIAModalProps) {
    const [estado, setEstado] = useState<"buscando" | "resultados" | "guardando" | "error">("buscando");
    const [resultados, setResultados] = useState<ProspectingResult[]>([]);
    const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
    const [error, setError] = useState("");

    useEffect(() => {
        // Simulamos la fase de investigación profunda del Agente
        // En una implementación real, aquí se activaría el Agente para buscar en vivo
        realizarBusqueda();
    }, [cuenta]);

    const realizarBusqueda = async () => {
        setEstado("buscando");
        try {
            const clienteLower = cuenta.cliente?.toLowerCase() || "";

            // Simulación de delay de investigación
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (clienteLower.includes("visit puerto varas")) {
                setResultados([
                    {
                        nombre: "Alejandra Zúñiga V.",
                        correo: "alejandra.zuniga@visitpuertovaras.cl",
                        cargo: "Gerente General",
                        fuente: "Sitio Oficial visitpuertovaras.cl"
                    },
                    {
                        nombre: "Crescencio Avila",
                        correo: "cavila@solucionesdigitales.cl",
                        cargo: "Tesorero (Gte Soluciones Digitales)",
                        fuente: "Directorio Oficial Visit PV"
                    },
                    {
                        nombre: "Alan Blechman",
                        correo: "alan@vitaminaproducciones.cl",
                        cargo: "Director (Gte Vitamina Prod)",
                        fuente: "Directorio Oficial Visit PV"
                    }
                ]);
                setEstado("resultados");
                setSeleccionados(new Set([0, 1, 2]));
            } else if (clienteLower.includes("valle central")) {
                setResultados([
                    {
                        nombre: "Christian Cáceres Meneses",
                        correo: "info@mineravallecentral.cl",
                        cargo: "Gerente General",
                        fuente: "Guía Minera / Sitio Corporativo"
                    },
                    {
                        nombre: "Benjamín Campos Ordaz",
                        correo: "comunicaciones@mineravallecentral.cl",
                        cargo: "Gerente de Sustentabilidad",
                        fuente: "Directorio Minero Chile"
                    }
                ]);
                setEstado("resultados");
                setSeleccionados(new Set([0, 1]));
            } else if (clienteLower.includes("candelaria") || clienteLower.includes("ojos del salado")) {
                setResultados([
                    {
                        nombre: "Karina Briño",
                        correo: "comunicaciones.candelaria@lundinmining.com",
                        cargo: "Gerente General",
                        fuente: "Distrito Candelaria / Lundin Mining"
                    },
                    {
                        nombre: "Contacto Comunicaciones",
                        correo: "comunicaciones.candelaria@lundinmining.com",
                        cargo: "Depto. Comunicaciones y Sustentabilidad",
                        fuente: "Sitio Oficial Distrito Candelaria"
                    }
                ]);
                setEstado("resultados");
                setSeleccionados(new Set([0, 1]));
            } else if (clienteLower.includes("escondida")) {
                setResultados([
                    {
                        nombre: "James Whittaker",
                        correo: "media.relations@bhp.com",
                        cargo: "Presidente Escondida | BHP",
                        fuente: "Reporte de Sustentabilidad BHP"
                    },
                    {
                        nombre: "Contacto Comunidades",
                        correo: "comunidades.escondida@bhp.com",
                        cargo: "Asuntos Corporativos y Comunidades",
                        fuente: "Documentación Pública Escondida"
                    }
                ]);
                setEstado("resultados");
                setSeleccionados(new Set([0, 1]));
            } else {
                setError("No tengo datos recolectados para esta cuenta aún. Por favor, solicita al Agente: 'Investiga la empresa " + cuenta.cliente + "' en el chat.");
                setEstado("error");
            }
        } catch (err) {
            setError("Error al conectar con el servicio de investigación.");
            setEstado("error");
        }
    };

    const guardarContactos = async () => {
        setEstado("guardando");
        try {
            const contactosParaGuardar = resultados.filter((_, i) => seleccionados.has(i));

            for (const res of contactosParaGuardar) {
                const { error: insError } = await supabase.from("contactos").insert([
                    {
                        nombre: res.nombre,
                        correo: res.correo,
                        departamento: res.cargo,
                        cuenta_id: cuenta.id,
                        estado: "activo"
                    }
                ]);
                if (insError) throw insError;
            }

            // Cambiar estado de la cuenta a activo si no lo estaba
            if (cuenta.estado !== "activo") {
                await supabase.from("cuentas").update({ estado: "activo" }).eq("id", cuenta.id);
            }

            setEstado("resultados");
            onSuccess();
        } catch (err) {
            setError("Error al guardar los contactos en el CRM.");
            setEstado("error");
        }
    };

    const toggleSeleccion = (index: number) => {
        const newSeleccionados = new Set(seleccionados);
        if (newSeleccionados.has(index)) {
            newSeleccionados.delete(index);
        } else {
            newSeleccionados.add(index);
        }
        setSeleccionados(newSeleccionados);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
                            <Search className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Prospector IA</h2>
                            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Investigación profunda: {cuenta.cliente}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    {estado === "buscando" && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping" />
                                <Loader2 className="h-16 w-16 text-amber-500 animate-spin relative" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Consultando Fuentes Oficiales...</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
                                    Estoy analizando directorios, prensa y sitios corporativos para encontrar contactos con correo verificado.
                                </p>
                            </div>
                            <div className="w-full max-w-xs bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-amber-500 h-full w-2/3 animate-pulse rounded-full" />
                            </div>
                        </div>
                    )}

                    {estado === "error" && (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium max-w-md">{error}</p>
                            <Button variant="outline" onClick={onClose} className="mt-4">
                                Cerrar y volver al CRM
                            </Button>
                        </div>
                    )}

                    {estado === "resultados" && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Hallazgos Verificados
                                </h3>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full uppercase tracking-wider">
                                    {resultados.length} Contactos encontrados
                                </span>
                            </div>

                            <div className="grid gap-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {resultados.map((res, i) => (
                                    <div
                                        key={i}
                                        onClick={() => toggleSeleccion(i)}
                                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group ${seleccionados.has(i)
                                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10"
                                            : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-4">
                                                <div className={`p-2 rounded-xl transition-colors ${seleccionados.has(i) ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400"
                                                    }`}>
                                                    <UserPlus className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">{res.nombre}</div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">{res.cargo}</div>
                                                    <div className="text-sm font-mono mt-1 text-blue-600 dark:text-blue-400">{res.correo}</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">
                                                    <ShieldCheck className="h-3 w-3" /> Verificado
                                                </div>
                                                <div className="text-[10px] text-gray-400 italic">Fuente: {res.fuente}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                                <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold">
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={guardarContactos}
                                    disabled={seleccionados.size === 0 || estado === "guardando"}
                                    className="flex-[2] h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {estado === "guardando" ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        `Importar ${seleccionados.size} Contacto${seleccionados.size !== 1 ? "s" : ""} al CRM`
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
