import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Briefcase,
  Search,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  EyeOff,
} from "lucide-react";
import { useVendedores } from "@/hooks/useVendedores";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { OportunidadRow } from "./OportunidadRow";

interface Oportunidad {
  id: string;
  nombre?: string;
  fecha_cierre?: string;
  organismo?: string;
  monto_disponible?: number;
  estado?: string;
  clave?: string;
  vendedor_id?: string | null;
  vendedor?: {
    nombre: string;
  } | { nombre: string }[] | null;
}

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [responsableSeleccionado, setResponsableSeleccionado] =
    useState("todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const [limpiando, setLimpiando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [editandoVendedor, setEditandoVendedor] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [verDescartadas, setVerDescartadas] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPorPagina = 50;

  const navigate = useNavigate();
  const { vendedores } = useVendedores();

  const RESPONSABLES = [
    { value: "todos", label: "Todos" },
    ...vendedores.map((v) => ({
      value: v.id,
      label: v.nombre,
    })),
  ];

  const cargarOportunidades = useCallback(async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from("oportunidades")
        .select(`
          *,
          vendedor:vendedores(nombre)
        `)
        .order("fecha_cierre", { ascending: true });

      if (error) throw error;
      setOportunidades(data || []);
    } catch (error: any) {
      console.error("Error cargando oportunidades:", error);
      setMensaje("❌ Error al cargar datos: " + (error.message || "Error de red"));
      setOportunidades([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarOportunidades();
  }, [cargarOportunidades]);

  const eliminarOportunidad = async (id: string) => {
    console.log("[DELETE] eliminarOportunidad llamada con id:", id);
    if (!window.confirm("¿Eliminar esta oportunidad?")) {
      console.log("[DELETE] Usuario cancelo el confirm");
      return;
    }
    console.log("[DELETE] Usuario confirmo, ejecutando delete...");

    try {
      const response = await supabase
        .from("oportunidades")
        .delete()
        .eq("id", id);

      console.log("[DELETE] Respuesta Supabase:", JSON.stringify(response));

      if (response.error) throw response.error;

      setOportunidades((prev) => prev.filter((op) => op.id !== id));
      setSeleccionados((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setMensaje("✅ Oportunidad eliminada");
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("[DELETE] Error:", error);
      setMensaje("❌ Error al eliminar: " + (error.message || JSON.stringify(error)));
      setTimeout(() => setMensaje(""), 5000);
    }
  };

  const eliminarSeleccionadas = async () => {
    if (seleccionados.size === 0) return;
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar las ${seleccionados.size} oportunidades seleccionadas?`,
      )
    )
      return;

    try {
      const idsAEliminar = Array.from(seleccionados);
      const { error } = await supabase
        .from("oportunidades")
        .delete()
        .in("id", idsAEliminar);

      if (error) throw error;

      setOportunidades((prev) =>
        prev.filter((op) => !seleccionados.has(op.id)),
      );
      setSeleccionados(new Set());
      setMensaje(`✅ ${idsAEliminar.length} oportunidades eliminadas`);
      setTimeout(() => setMensaje(""), 4000);
    } catch (error: any) {
      console.error("Error eliminando seleccionadas:", error);
      setMensaje("❌ Error al eliminar seleccionadas: " + (error.message || "Error desconocido"));
      setTimeout(() => setMensaje(""), 5000);
    }
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSeleccionarTodo = () => {
    if (seleccionados.size === oportunidadesFiltradas.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(oportunidadesFiltradas.map((op) => op.id)));
    }
  };

  const toggleEstadoDescartada = async (
    oportunidadId: string,
    estadoActual?: string,
  ) => {
    // 1. Calcular nuevo estado
    const nuevoEstado =
      estadoActual?.toLowerCase() === "descartada"
        ? "Publicada"
        : "Descartada";

    // 2. Actualización Optimista: Actualizar UI inmediatamente
    setOportunidades(prev => prev.map(op =>
      op.id === oportunidadId ? { ...op, estado: nuevoEstado } : op
    ));

    try {
      // 3. Llamada silenciosa a Supabase
      const { error } = await supabase
        .from("oportunidades")
        .update({ estado: nuevoEstado })
        .eq("id", oportunidadId);

      if (error) {
        throw error;
      }

      // NO recargamos toda la lista (cargarOportunidades) para evitar el "pestañazo"
      // La UI ya está sincronizada con el estado optimista.

    } catch (error: any) {
      console.error("Error:", error);
      // Revertir cambio en caso de error
      setOportunidades(prev => prev.map(op =>
        op.id === oportunidadId ? { ...op, estado: estadoActual } : op
      ));
      setMensaje("❌ Error al cambiar estado: " + error.message);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const actualizarVendedor = async (
    oportunidadId: string,
    vendedorId: string,
  ) => {
    const vendedorElegido = vendedores.find(v => v.id === vendedorId);
    const nombreVendedor = vendedorElegido ? vendedorElegido.nombre : null;

    // Actualización Optimista
    setOportunidades(prev => prev.map(op =>
      op.id === oportunidadId
        ? {
          ...op,
          vendedor_id: vendedorId || null,
          vendedor: nombreVendedor ? { nombre: nombreVendedor } : null
        }
        : op
    ));

    setEditandoVendedor(null);

    try {
      const { error } = await supabase
        .from("oportunidades")
        .update({ vendedor_id: vendedorId || null })
        .eq("id", oportunidadId);

      if (error) throw error;
      // No necesitamos recargar, la actualización optimista ya cubrió la UI
    } catch (error: any) {
      console.error("Error actualizando vendedor:", error);
      await cargarOportunidades(); // Revertir a estado real de DB
      setMensaje("❌ Error al asignar vendedor");
    }
  };

  const limpiarVencidas = async () => {
    console.log("[LIMPIAR] limpiarVencidas llamada");
    if (
      !window.confirm(
        "¿Eliminar todas las oportunidades con fecha de cierre anterior a hoy?",
      )
    ) {
      console.log("[LIMPIAR] Usuario cancelo");
      return;
    }
    console.log("[LIMPIAR] Usuario confirmo, ejecutando...");

    try {
      setLimpiando(true);
      const hoy = new Date().toISOString();
      console.log("[LIMPIAR] Fecha corte:", hoy);

      const response = await supabase
        .from("oportunidades")
        .delete()
        .lt("fecha_cierre", hoy);

      console.log("[LIMPIAR] Respuesta Supabase:", JSON.stringify(response));

      if (response.error) throw response.error;

      setMensaje("✅ Oportunidades vencidas eliminadas");
      await cargarOportunidades();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("[LIMPIAR] Error:", error);
      setMensaje("❌ Error al limpiar: " + (error.message || JSON.stringify(error)));
      setTimeout(() => setMensaje(""), 5000);
    } finally {
      setLimpiando(false);
    }
  };

  const subirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      setMensaje("❌ Solo se permiten archivos Excel (.xlsx, .xls)");
      return;
    }

    try {
      setProcesando(true);
      setMensaje("📤 Procesando archivo...");

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
          });

          if (jsonData.length === 0) {
            setMensaje("❌ El archivo está vacío");
            return;
          }

          const { data: keywordsDB, error: errorDB } = await supabase
            .from("config_oportunidades")
            .select("keyword");

          if (errorDB) {
            console.error("Error cargando keywords:", errorDB);
            throw new Error("No se pudieron cargar las palabras clave de configuración");
          }

          const PALABRAS_CLAVE = (keywordsDB || []).map((k) => k.keyword);

          if (PALABRAS_CLAVE.length === 0) {
            setMensaje("⚠️ No hay palabras clave configuradas. Ve a configuración.");
            setTimeout(() => setMensaje(""), 4000);
            return;
          }

          // --- MOTOR DE BÚSQUEDA EXACTA (PROTOCOL-DRIVEN) ---
          const normalizeText = (text: string | null | undefined): string => {
            if (!text) return "";
            return text
              .toString()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
              .replace(/[\/\-\.,_]/g, " ")     // Neutralización de símbolos: /, -, ., ,, _ por espacio
              .replace(/\s+/g, " ")            // Colapsar múltiples espacios
              .trim();
          };

          const calcularScore = (texto: string, keywords: string[]): { score: number, matches: string[] } => {
            let score = 0;
            let matchesEncontrados = new Set<string>();
            const textoNorm = normalizeText(texto);

            // Separar palabras positivas de exclusiones
            const exclusiones = keywords.filter(k => k.startsWith("-")).map(k => normalizeText(k.substring(1)));
            const positivas = keywords.filter(k => !k.startsWith("-"));

            // 1. Verificar exclusiones primero (si hay una, fuera)
            for (const excl of exclusiones) {
              if (textoNorm.includes(excl)) return { score: -1, matches: [] };
            }

            // 2. Buscar palabras positivas (MATCH ESTRICTO)
            positivas.forEach(kw => {
              const kwNorm = normalizeText(kw);
              // Solo match si la palabra exacta o frase exacta está presente
              if (textoNorm.includes(kwNorm)) {
                matchesEncontrados.add(kw);
                score += 10;
              }
            });

            return { score, matches: Array.from(matchesEncontrados) };
          };

          const oportunidadesFiltradas = jsonData
            .map((row) => {
              // Mapeo flexible de columnas para soportar distintos formatos de archivo
              const getVal = (keys: string[]) => {
                const foundKey = Object.keys(row).find((k) =>
                  keys.some(
                    (key) => k.toLowerCase().trim() === key.toLowerCase().trim(),
                  ),
                );
                return foundKey ? row[foundKey] : "";
              };

              const idVal = getVal(["ID", "Código", "Codigo", "Cod"]);
              const nombreVal = getVal(["Nombre", "Descripción", "Descripcion"]);
              const organismoVal = getVal([
                "Organismo",
                "Comprador",
                "Institución",
                "Institucion",
                "Entidad",
              ]);
              const fechaVal = getVal(["Fecha de cierre", "Cierre", "Fecha"]);
              const montoVal = getVal([
                "Monto Disponible",
                "Monto",
                "Valor",
                "Presupuesto",
                "Presupuesto estimado",
                "Presupuesto Estimado",
                "Total Estimado",
                "Total"
              ]);
              const estadoVal = getVal(["Estado"]);
              const claveVal = getVal(["Clave"]);

              // Identificar palabras clave encontradas (Búsqueda Inteligente)
              const resNombre = calcularScore(nombreVal || "", PALABRAS_CLAVE);
              const resOrg = calcularScore(organismoVal || "", PALABRAS_CLAVE);

              // Si alguna tiene exclusión o ninguna tiene match, descartamos
              if (resNombre.score === -1 || resOrg.score === -1) return null;

              const totalScore = resNombre.score + resOrg.score;
              const keywordsEncontradas = Array.from(new Set([...resNombre.matches, ...resOrg.matches])).join(", ");

              if (totalScore <= 0) return null;

              let montoNum: number | null = null;

              if (typeof montoVal === "number") {
                montoNum = montoVal;
              } else if (typeof montoVal === "string") {
                // Limpieza robusta para formato chileno/latino ($ 1.000.000 o 1.000.000,00)
                let limpio = montoVal.trim();

                // Si tiene formato $ 1.000 (con puntos de miles y sin comas decimales o con coma al final)
                // Eliminamos todo lo que no sea número, coma o guion
                limpio = limpio.replace(/[^0-9,.-]/g, "");

                // Si tiene puntos y comas, asumimos punto=miles y coma=decimal (formato CL)
                if (limpio.includes(".") && limpio.includes(",")) {
                  limpio = limpio.replace(/\./g, "").replace(",", ".");
                } else if (limpio.includes(".")) {
                  // Si solo tiene puntos, asumimos que son miles si hay más de uno o si parece miles
                  // Riesgo: 1.500 puede ser mil quinientos o uno punto cinco. 
                  // En contexto licitaciones CL, suele ser miles. Eliminamos punto.
                  limpio = limpio.replace(/\./g, "");
                } else if (limpio.includes(",")) {
                  // Si solo tiene coma, es decimal
                  limpio = limpio.replace(",", ".");
                }

                montoNum = parseFloat(limpio);
                if (isNaN(montoNum)) {
                  console.warn("Parseo fallido para monto:", montoVal);
                  montoNum = null;
                }
              }

              // Lógica de normalización de fecha y hora (Dato SENSIBLE)
              let fechaCierre = fechaVal;
              if (fechaCierre) {
                if (fechaCierre instanceof Date) {
                  fechaCierre = fechaCierre.toISOString();
                } else if (typeof fechaCierre === "string") {
                  const fechaStr = fechaCierre.trim();
                  const match = fechaStr.match(
                    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/,
                  );

                  if (match) {
                    let [, d, m, y, h] = match;
                    const year = y.length === 2 ? `20${y}` : y;
                    const month = m.padStart(2, "0");
                    const day = d.padStart(2, "0");
                    const time = h || "00:00";
                    fechaCierre = `${year}-${month}-${day}T${time}${time.split(":").length === 2 ? ":00" : ""}`;
                  } else {
                    // Si no coincide con el regex, intentar parseo nativo
                    try {
                      const d = new Date(fechaStr);
                      if (!isNaN(d.getTime())) {
                        fechaCierre = d.toISOString();
                      }
                    } catch (e) {
                      console.warn("Error parseando fecha string:", fechaStr);
                    }
                  }
                } else if (typeof fechaCierre === "number") {
                  // Manejo de fechas de Excel (números)
                  try {
                    const excelDate = new Date((fechaCierre - 25569) * 86400 * 1000);
                    if (!isNaN(excelDate.getTime())) {
                      fechaCierre = excelDate.toISOString();
                    }
                  } catch (e) {
                    console.warn("Error parseando fecha número Excel:", fechaCierre);
                  }
                }
              }

              return {
                id: (idVal || "").toString().trim() || null,
                nombre: (nombreVal || "").toString().trim() || null,
                fecha_cierre: fechaCierre || null,
                organismo: (organismoVal || "").toString().trim() || null,
                monto_disponible: montoNum,
                estado: (estadoVal || "Publicada").toString().trim(),
                clave: (claveVal || "").toString().trim() || keywordsEncontradas,
                vendedor_id: null,
              };
            })
            .filter((op) => op !== null && op.id);

          if (oportunidadesFiltradas.length === 0) {
            setMensaje(
              "ℹ️ No hay oportunidades que coincidan con las palabras clave",
            );
            setTimeout(() => setMensaje(""), 4000);
            return;
          }

          const idsExistentes = new Set(oportunidades.map((op) => op.id));
          const nuevasOportunidades = oportunidadesFiltradas.filter(
            (op) => op && !idsExistentes.has(op.id),
          );

          if (nuevasOportunidades.length === 0) {
            setMensaje(
              "ℹ️ Todas las oportunidades ya existen en la base de datos",
            );
            setTimeout(() => setMensaje(""), 4000);
            return;
          }

          const { error } = await supabase
            .from("oportunidades")
            .insert(nuevasOportunidades);

          if (error) {
            console.error("Error Supabase:", error);
            throw new Error(error.message);
          }

          setMensaje(
            `✅ ${nuevasOportunidades.length} nuevas oportunidades cargadas`,
          );
          await cargarOportunidades();
          setTimeout(() => setMensaje(""), 5000);
        } catch (err: any) {
          console.error("Error procesando Excel:", err);
          setMensaje(`❌ Error: ${err.message}`);
        } finally {
          setProcesando(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error("Error inicial:", error);
      setMensaje(`❌ Error: ${error.message}`);
      setProcesando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const oportunidadesFiltradas = useMemo(() => {
    return oportunidades.filter((op) => {
      // Filtro de desahogo: Ocultar descartadas por defecto
      if (!verDescartadas && op.estado?.toLowerCase() === "descartada") return false;

      const searchLower = busqueda.toLowerCase().trim();
      if (!searchLower) return (responsableSeleccionado === "todos" || op.vendedor_id === responsableSeleccionado);

      const matchBusqueda =
        (op.id?.toString() || "").toLowerCase().includes(searchLower) ||
        (op.organismo?.toString() || "").toLowerCase().includes(searchLower) ||
        (op.nombre?.toString() || "").toLowerCase().includes(searchLower);

      const matchResponsable =
        responsableSeleccionado === "todos" ||
        op.vendedor_id === responsableSeleccionado;

      return matchBusqueda && matchResponsable;
    });
  }, [oportunidades, busqueda, responsableSeleccionado, verDescartadas]);

  const totalPaginas = Math.ceil(
    oportunidadesFiltradas.length / itemsPorPagina,
  );
  const oportunidadesPagina = oportunidadesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina,
  );

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, responsableSeleccionado]);

  const formatearFecha = (fecha?: any) => {
    if (!fecha) return "-";
    try {
      const date = new Date(fecha);
      if (isNaN(date.getTime())) return String(fecha);
      return date.toLocaleDateString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch (e) {
      return String(fecha);
    }
  };

  const formatearMonto = (monto?: number) => {
    if (monto == null) return "-";
    return `$ ${new Intl.NumberFormat("es-CL").format(monto)}`;
  };

  const getEstadoColor = (estado?: string) => {
    switch (estado?.toLowerCase()) {
      case "activo":
      case "abierta":
      case "publicada":
        return "bg-green-100 text-green-700 border-green-200";
      case "descartada":
        return "bg-red-600 text-white border-red-700";
      case "pendiente":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "cerrada":
      case "cancelada":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const estaVencida = (fechaCierre?: string) => {
    if (!fechaCierre) return false;
    return new Date(fechaCierre) < new Date();
  };

  const estaDescartada = (estado?: string) => {
    return estado?.toLowerCase() === "descartada";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-500" />
            Oportunidades
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestión de oportunidades de negocio
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={limpiarVencidas}
            disabled={limpiando}
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {limpiando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Limpiar Vencidas
          </button>

          <button
            type="button"
            onClick={eliminarSeleccionadas}
            disabled={seleccionados.size === 0}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar Seleccionadas {seleccionados.size > 0 && `(${seleccionados.size})`}
          </button>

          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={procesando}
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/20 flex items-center gap-2"
          >
            {procesando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Subir Archivo
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/oportunidades/configuracion")}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Configurar palabras clave"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={subirArchivo}
            accept=".xlsx,.xls"
            className="hidden"
          />
        </div>
      </div>

      {
        mensaje && (
          <div
            className={`p-4 rounded-lg font-medium border flex items-center gap-2 ${mensaje.includes("Error") || mensaje.includes("❌")
              ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
              : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
              }`}
          >
            {mensaje}
          </div>
        )
      }

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:w-[350px]">
          <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Buscar por ID, organismo o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 pl-2 h-9 text-base dark:bg-gray-800 dark:text-gray-200 w-full"
            data-testid="input-busqueda-oportunidad"
          />
        </div>


        <div className="flex items-center gap-6 ml-auto order-2 sm:order-3">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setVerDescartadas(!verDescartadas)}>
            <Checkbox
              id="ver-descartadas"
              checked={verDescartadas}
              onCheckedChange={(checked) => setVerDescartadas(!!checked)}
            />
            <label
              htmlFor="ver-descartadas"
              className="text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer group-hover:text-blue-600 transition-colors"
            >
              Ver Descartadas
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Responsable:
            </span>
            <Select
              value={responsableSeleccionado}
              onValueChange={setResponsableSeleccionado}
            >
              <SelectTrigger
                className="w-[180px]"
                data-testid="select-responsable"
              >
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {RESPONSABLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
        {cargando ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            Cargando oportunidades...
          </div>
        ) : oportunidades.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-300 dark:text-gray-600 mb-4 flex justify-center">
              <Briefcase className="h-16 w-16" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">
              No hay oportunidades registradas
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Subir el primer archivo
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                      <Checkbox
                        checked={
                          oportunidadesFiltradas.length > 0 &&
                          seleccionados.size === oportunidadesFiltradas.length
                        }
                        onCheckedChange={toggleSeleccionarTodo}
                        title="Seleccionar todo"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">
                      Organismo
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[220px]">
                      Nombre
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                      F. Cierre
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      Monto
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      Clave
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                      Vendedor
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {oportunidadesPagina.length > 0 ? (
                    oportunidadesPagina.map((op) => (
                      <OportunidadRow
                        key={op.id}
                        op={op}
                        vendedores={vendedores}
                        seleccionada={seleccionados.has(op.id)}
                        onToggleSeleccion={toggleSeleccion}
                        onActualizarVendedor={actualizarVendedor}
                        onToggleEstado={toggleEstadoDescartada}
                        onEliminar={eliminarOportunidad}
                        onEditar={(id) => navigate(`/oportunidades/${id}`)}
                        formatearFecha={formatearFecha}
                        formatearMonto={formatearMonto}
                        getEstadoColor={getEstadoColor}
                        estaDescartada={estaDescartada}
                      />
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        No se encontraron oportunidades
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {(paginaActual - 1) * itemsPorPagina + 1} a{" "}
                  {Math.min(
                    paginaActual * itemsPorPagina,
                    oportunidadesFiltradas.length,
                  )}{" "}
                  de {oportunidadesFiltradas.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPaginaActual((p) => Math.min(totalPaginas, p + 1))
                    }
                    disabled={paginaActual === totalPaginas}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )
        }
      </div>
    </div>
  );
}
