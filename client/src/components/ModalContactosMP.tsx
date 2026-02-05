
import { useState, useEffect } from "react";
import { X, Search, Loader2, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Cuenta, Contacto } from "../types";

interface ModalContactosMPProps {
    cuenta: Cuenta;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ModalContactosMP({ cuenta, onClose, onSuccess }: ModalContactosMPProps) {
    const [cargando, setCargando] = useState(false);
    const [progreso, setProgreso] = useState("");
    const [contactosEncontrados, setContactosEncontrados] = useState<any[]>([]);
    const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
    const [error, setError] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    const TICKET = "F8537A18-6766-4DEF-9E59-426B4FEE2844"; // Ticket oficial de Mercado Público

    useEffect(() => {
        buscarContactos();
    }, [cuenta]);

    const buscarContactos = async () => {
        if (!cuenta.rut && !cuenta.cliente) return;

        setCargando(true);
        setError("");
        setProgreso("Iniciando búsqueda profunda...");
        const contactosUnicos = new Map();

        try {
            // 1. Intentar encontrar el CodigoOrganismo para búsquedas precisas
            setProgreso("Identificando organismo en Mercado Público...");
            let codigoOrganismo = null;
            try {
                const respCompradores = await fetch(`https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarComprador?ticket=${TICKET}`);
                if (respCompradores.ok) {
                    const dataCompradores = await respCompradores.json();
                    const listado = Array.isArray(dataCompradores) ? dataCompradores : (dataCompradores.Listado || []);

                    if (listado.length > 0) {
                        const searchName = cuenta.cliente.toLowerCase();
                        const rutLimpio = cuenta.rut?.replace(/\./g, "").split("-")[0];
                        const sigKeywords = searchName.split(" ")
                            .filter(w => w.length > 4 && w !== "provincial" && w !== "regional");

                        const match = listado.find((c: any) => {
                            const apiRutLimpio = c.RutUnidad?.replace(/\./g, "").split("-")[0];
                            const matchRut = rutLimpio && apiRutLimpio === rutLimpio;
                            const matchExact = c.NombreEmpresa?.toLowerCase() === searchName;
                            const matchIncludes = c.NombreEmpresa?.toLowerCase().includes(searchName);
                            const matchKeywords = sigKeywords.length > 0 && sigKeywords.every(k => c.NombreEmpresa?.toLowerCase().includes(k));

                            return matchRut || matchExact || matchIncludes || matchKeywords;
                        });

                        if (match) {
                            codigoOrganismo = match.CodigoEmpresa;
                            console.log("Organismo identificado:", match.NombreEmpresa, codigoOrganismo);
                        }
                    }
                }
            } catch (e) {
                console.warn("No se pudo obtener la lista de compradores, se usará búsqueda general", e);
            }

            // 2. Generar fechas para los últimos 6 meses (180 días)
            const hoy = new Date();
            const dates = [];
            for (let i = 0; i < 180; i++) {
                const d = new Date(hoy);
                d.setDate(d.getDate() - i);
                const dia = String(d.getDate()).padStart(2, '0');
                const mes = String(d.getMonth() + 1).padStart(2, '0');
                const anio = d.getFullYear();
                dates.push(`${dia}${mes}${anio}`);
            }

            const rutLimpio = cuenta.rut?.replace(/\./g, "").split("-")[0];
            const nombreBusqueda = cuenta.cliente.toLowerCase();

            // 3. Procesar por lotes de fechas para eficiencia y feedback
            const batchSize = 5; // Reducido para evitar 429
            for (let i = 0; i < dates.length; i += batchSize) {
                const batch = dates.slice(i, i + batchSize);
                const mesActual = i / 30;
                setProgreso(`Buscando en Órdenes de Compra (${Math.floor(mesActual) + 1}/6 meses)...`);

                await Promise.all(batch.map(async (fecha) => {
                    try {
                        let url = `https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?fecha=${fecha}&ticket=${TICKET}`;
                        if (codigoOrganismo) {
                            url += `&CodigoOrganismo=${codigoOrganismo}`;
                        }

                        const resp = await fetch(url);
                        if (!resp.ok) return;

                        const data = await resp.json();
                        if (!data.Listado || !Array.isArray(data.Listado)) return;

                        // Filtrar resultados si no tenemos codigoOrganismo o para doble verificación
                        const matches = data.Listado.filter((oc: any) => {
                            if (codigoOrganismo) return true; // Si filtramos por API, confiamos en el resultado

                            const apiRutLimpio = oc.Comprador?.RutUnidad?.replace(/\./g, "").split("-")[0];
                            const matchRut = rutLimpio && apiRutLimpio === rutLimpio;

                            const nameOC = (oc.NombreOrganismo || oc.Comprador?.NombreOrganismo || "").toLowerCase();
                            const keywords = nombreBusqueda.split(" ").filter(w => w.length > 3);
                            const matchNombre = nameOC.includes(nombreBusqueda) ||
                                (keywords.length > 0 && keywords.every(k => nameOC.includes(k)));

                            return matchRut || matchNombre;
                        });

                        for (const match of matches) {
                            // Consultar detalle para extraer contacto real
                            const detailUrl = `https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?codigo=${match.Codigo}&ticket=${TICKET}`;
                            const detailResp = await fetch(detailUrl);
                            if (detailResp.ok) {
                                const detailData = await detailResp.json();
                                if (detailData.Listado?.[0]) {
                                    const d = detailData.Listado[0];
                                    const c = d.Comprador;

                                    // Búsqueda exhaustiva de campos de contacto
                                    const email = c.MailContacto || c.EmailContacto || c.ContactoEmail || d.MailContacto;
                                    const nombre = c.NombreContacto || c.ContactoNombre || d.NombreContacto;

                                    if (nombre && email && email.includes("@")) {
                                        const key = email.toLowerCase().trim();
                                        if (!contactosUnicos.has(key)) {
                                            contactosUnicos.set(key, {
                                                nombre: nombre,
                                                correo: email,
                                                telefono: c.FonoContacto || c.ContactoTelefono || d.FonoContacto || "",
                                                cargo: c.CargoContacto || d.CargoContacto || "Contacto Mercado Público",
                                                departamento: c.NombreUnidad || d.NombreUnidad || ""
                                            });
                                            // Actualizar lista visible mientras se busca
                                            setContactosEncontrados(Array.from(contactosUnicos.values()));
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Ignorar errores de red en fechas individuales
                    }
                }));

                // Pequeño delay entre lotes para respetar límites de la API
                await new Promise(resolve => setTimeout(resolve, 800));

                // Si ya encontramos suficientes contactos, detenemos la búsqueda profunda
                if (contactosUnicos.size >= 10) break;
            }

            if (contactosUnicos.size === 0) {
                setError("No se encontraron contactos en las órdenes de compra emitidas en los últimos 6 meses.");
            }
        } catch (err: any) {
            console.error("Error buscando contactos:", err);
            setError("Error de conexión con la API de Mercado Público.");
        } finally {
            setCargando(false);
            setProgreso("");
        }
    };

    const toggleSeleccion = (index: number) => {
        const newSet = new Set(seleccionados);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        setSeleccionados(newSet);
    };

    const guardarSeleccionados = async () => {
        if (seleccionados.size === 0) return;

        setCargando(true);
        try {
            const aGuardar = Array.from(seleccionados).map(idx => {
                const c = contactosEncontrados[idx];
                return {
                    nombre: c.nombre,
                    correo: c.correo,
                    telefono: c.telefono,
                    cargo: c.cargo,
                    departamento: c.departamento,
                    cuenta_id: cuenta.id,
                    estado: 'activo'
                };
            });

            const { error } = await supabase.from("contactos").insert(aGuardar);
            if (error) throw error;

            setMensajeExito(`${seleccionados.size} contactos agregados con éxito.`);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error("Error guardando contactos:", err);
            setError("Error al guardar los contactos en la base de datos.");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Search className="h-5 w-5 text-blue-500" />
                            Buscador de Contactos MP
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                            Buscando contactos en OCs (6 meses) para: <span className="text-blue-500">{cuenta.cliente}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {cargando && !contactosEncontrados.length && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold animate-pulse">{progreso || "Consultando Mercado Público..."}</p>
                        </div>
                    )}

                    {error && !contactosEncontrados.length && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Sin resultados directos</p>
                                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {contactosEncontrados.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contactos Encontrados ({contactosEncontrados.length})</p>
                            {contactosEncontrados.map((c, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => toggleSeleccion(idx)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${seleccionados.has(idx)
                                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md"
                                        : "border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        }`}
                                >
                                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${seleccionados.has(idx) ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-600"
                                        }`}>
                                        {seleccionados.has(idx) && <CheckCircle2 className="h-4 w-4 text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{c.nombre}</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{c.correo}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400 font-bold">{c.cargo}</span>
                                            {c.departamento && <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400 font-bold">{c.departamento}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {mensajeExito && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-3 text-green-700 dark:text-green-400 animate-in fade-in slide-in-from-top-2">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-sm font-bold">{mensajeExito}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={seleccionados.size === 0 || cargando}
                        onClick={guardarSeleccionados}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
                    >
                        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        Importar {seleccionados.size > 0 ? `(${seleccionados.size})` : ""}
                    </button>
                </div>
            </div>
        </div>
    );
}
