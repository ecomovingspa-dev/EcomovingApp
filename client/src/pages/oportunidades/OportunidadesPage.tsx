import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { useVendedores } from "../../hooks/useVendedores";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

interface Oportunidad {
  id: string;
  nombre?: string;
  fecha_cierre?: string;
  organismo?: string;
  monto_disponible?: number;
  estado?: string;
  clave?: string;
  vendedor_id?: string;
  vendedor?: {
    nombre: string;
  };
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPorPagina = 10;

  const navigate = useNavigate();
  const { vendedores } = useVendedores();

  const RESPONSABLES = [
    { value: "todos", label: "Todos" },
    ...vendedores.map((v) => ({
      value: v.id,
      label: v.nombre,
    })),
  ];

  useEffect(() => {
    cargarOportunidades();
  }, []);

  const cargarOportunidades = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from("oportunidades")
        .select(
          `
          *,
          vendedor:vendedores(nombre)
        `,
        )
        .order("fecha_cierre", { ascending: true });

      if (error) throw error;
      setOportunidades(data || []);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("Error al cargar oportunidades: " + (error.message || error));
      setOportunidades([]);
    } finally {
      setCargando(false);
    }
  };

  const eliminarOportunidad = async (id: string) => {
    if (!confirm("¿Eliminar esta oportunidad?")) return;

    try {
      const { error } = await supabase
        .from("oportunidades")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setMensaje("Oportunidad eliminada");
      cargarOportunidades();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("Error al eliminar: " + error.message);
    }
  };

  const toggleEstadoDescartada = async (
    oportunidadId: string,
    estadoActual?: string,
  ) => {
    try {
      const nuevoEstado =
        estadoActual?.toLowerCase() === "descartada"
          ? "Publicada"
          : "Descartada";

      const { error } = await supabase
        .from("oportunidades")
        .update({ estado: nuevoEstado })
        .eq("id", oportunidadId);

      if (error) throw error;

      await cargarOportunidades();
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("❌ Error al cambiar estado: " + error.message);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const actualizarVendedor = async (
    oportunidadId: string,
    vendedorId: string,
  ) => {
    try {
      const { error } = await supabase
        .from("oportunidades")
        .update({ vendedor_id: vendedorId || null })
        .eq("id", oportunidadId);

      if (error) throw error;

      setMensaje("✅ Vendedor asignado correctamente");
      await cargarOportunidades();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("❌ Error al asignar vendedor: " + error.message);
    } finally {
      setEditandoVendedor(null);
    }
  };

  const limpiarVencidas = async () => {
    if (
      !confirm(
        "¿Eliminar todas las oportunidades con fecha de cierre anterior a hoy?",
      )
    )
      return;

    try {
      setLimpiando(true);
      const hoy = new Date().toISOString();

      const { error } = await supabase
        .from("oportunidades")
        .delete()
        .lt("fecha_cierre", hoy);

      if (error) throw error;

      setMensaje(`Oportunidades vencidas eliminadas`);
      cargarOportunidades();
      setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) {
      console.error("Error:", error);
      setMensaje("Error al limpiar: " + error.message);
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

          const PALABRAS_CLAVE = [
            "evaluación psicolaboral",
            "fotocopiadoras",
            "impresión",
            "digitación",
            "servicio",
            "arriendo",
            "multifuncionales",
            "psicométricas",
            "postulaciones",
            "cargos públicos",
          ].map((kw) => kw.toLowerCase());

          const contieneKeyword = (fila: any): boolean => {
            const campos = [fila["Nombre"] || "", fila["Organismo"] || ""];
            const textoCompleto = campos.join(" ").toLowerCase();
            return PALABRAS_CLAVE.some((kw) => textoCompleto.includes(kw));
          };

          const oportunidadesFiltradas = jsonData
            .filter(contieneKeyword)
            .map((row) => {
              let monto = row["Monto Disponible"];
              if (typeof monto === "string") {
                monto = monto
                  .replace(/\$/g, "")
                  .replace(/\./g, "")
                  .replace(/,/g, ".");
              }
              const montoNum = parseFloat(monto) || null;

              // Lógica de normalización de fecha y hora (Dato SENSIBLE)
              let fechaCierre = row["Fecha de cierre"];
              if (fechaCierre) {
                if (fechaCierre instanceof Date) {
                  // Si el objeto ya es una fecha (producido por el parser de Excel)
                  fechaCierre = fechaCierre.toISOString();
                } else if (typeof fechaCierre === "string") {
                  const fechaStr = fechaCierre.trim();
                  // Soportar tanto / como - (ej: 19/01/2026 o 19-01-2026)
                  const match = fechaStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);

                  if (match) {
                    let [, d, m, y, h] = match;
                    const year = y.length === 2 ? `20${y}` : y;
                    const month = m.padStart(2, "0");
                    const day = d.padStart(2, "0");
                    const time = h || "00:00";
                    // Formato ISO: YYYY-MM-DDTHH:mm:ss
                    fechaCierre = `${year}-${month}-${day}T${time}${time.split(':').length === 2 ? ':00' : ''}`;
                  }
                }
              }

              return {
                id: (row["ID"] || "").toString().trim() || null,
                nombre: (row["Nombre"] || "").toString().trim() || null,
                fecha_cierre: fechaCierre || null,
                organismo: (row["Organismo"] || "").toString().trim() || null,
                monto_disponible: montoNum,
                estado: (row["Estado"] || "Publicada").toString().trim(),
                clave: (row["Clave"] || "").toString().trim() || null,
                vendedor_id: null,
              };
            })
            .filter((op) => op.id);

          if (oportunidadesFiltradas.length === 0) {
            setMensaje(
              "ℹ️ No hay oportunidades que coincidan con las palabras clave",
            );
            setTimeout(() => setMensaje(""), 4000);
            return;
          }

          const idsExistentes = new Set(oportunidades.map((op) => op.id));
          const nuevasOportunidades = oportunidadesFiltradas.filter(
            (op) => !idsExistentes.has(op.id),
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
      const matchBusqueda =
        (op.id || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (op.organismo || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (op.nombre || "").toLowerCase().includes(busqueda.toLowerCase());

      const matchResponsable =
        responsableSeleccionado === "todos" ||
        op.vendedor_id === responsableSeleccionado;

      return matchBusqueda && matchResponsable;
    });
  }, [oportunidades, busqueda, responsableSeleccionado]);

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

  const formatearFecha = (fecha?: string) => {
    if (!fecha) return "-";
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return fecha;
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
          <Button
            onClick={limpiarVencidas}
            variant="outline"
            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
            disabled={limpiando}
            data-testid="button-limpiar-vencidas"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${limpiando ? "animate-spin" : ""}`}
            />
            {limpiando ? "Limpiando..." : "Limpiar Vencidas"}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={procesando}
            variant="outline"
            className="border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950"
            data-testid="button-subir-archivo"
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir Archivo
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

      {mensaje && (
        <div
          className={`p-4 rounded-lg font-medium border flex items-center gap-2 ${mensaje.includes("Error") || mensaje.includes("❌")
            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
            : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
            }`}
        >
          {mensaje}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
          <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Buscar por ID, organismo o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 pl-2 h-9 text-base dark:bg-gray-800 dark:text-gray-200"
            data-testid="input-busqueda-oportunidad"
          />
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
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
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
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-12"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-40">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-64">
                      Organismo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-44">
                      F. Cierre
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-32">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-28">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-32">
                      Clave
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-40">
                      Vendedor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {oportunidadesPagina.length > 0 ? (
                    oportunidadesPagina.map((op) => (
                      <tr
                        key={op.id}
                        className={`transition-colors ${estaDescartada(op.estado)
                          ? "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                          : estaVencida(op.fecha_cierre)
                            ? "bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900"
                            : "hover:bg-gray-50 dark:hover:bg-gray-750"
                          }`}
                      >
                        <td className="px-4 py-2 text-center">
                          <Checkbox
                            checked={estaDescartada(op.estado)}
                            onCheckedChange={() =>
                              toggleEstadoDescartada(op.id, op.estado)
                            }
                            className="cursor-pointer"
                            data-testid={`checkbox-descartada-${op.id}`}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div
                            className={`font-medium text-sm truncate max-w-[200px] ${estaDescartada(op.estado)
                              ? "text-gray-500 dark:text-gray-400"
                              : "text-gray-900 dark:text-gray-100"
                              }`}
                            title={op.id}
                          >
                            {op.id}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-2 whitespace-nowrap text-sm truncate max-w-[150px] ${estaDescartada(op.estado)
                            ? "text-gray-500 dark:text-gray-400"
                            : "text-gray-600 dark:text-gray-300"
                            }`}
                          title={op.organismo || ""}
                        >
                          {op.organismo || "-"}
                        </td>
                        <td
                          className={`px-4 py-2 whitespace-nowrap text-sm ${estaDescartada(op.estado)
                            ? "text-gray-500 dark:text-gray-400"
                            : estaVencida(op.fecha_cierre)
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : "text-gray-600 dark:text-gray-300"
                            }`}
                        >
                          {formatearFecha(op.fecha_cierre)}
                        </td>
                        <td
                          className={`px-4 py-2 whitespace-nowrap text-sm text-right ${estaDescartada(op.estado)
                            ? "text-gray-500 dark:text-gray-400"
                            : "text-gray-600 dark:text-gray-300"
                            }`}
                        >
                          {formatearMonto(op.monto_disponible)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getEstadoColor(op.estado)}`}
                          >
                            {op.estado || "Sin estado"}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-2 text-sm max-w-[200px] ${estaDescartada(op.estado)
                            ? "text-gray-500 dark:text-gray-400"
                            : "text-gray-600 dark:text-gray-300"
                            }`}
                          title={op.clave || ""}
                        >
                          <div className="truncate">{op.clave || "-"}</div>
                        </td>
                        <td
                          className={`px-4 py-2 whitespace-nowrap text-sm cursor-pointer ${estaDescartada(op.estado)
                            ? "text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                            : "hover:bg-blue-50 dark:hover:bg-blue-950"
                            }`}
                          onClick={() => setEditandoVendedor(op.id)}
                        >
                          {editandoVendedor === op.id ? (
                            <Select
                              value={op.vendedor_id || "sin-asignar"}
                              onValueChange={(value) =>
                                actualizarVendedor(
                                  op.id,
                                  value === "sin-asignar" ? "" : value,
                                )
                              }
                              open={true}
                              onOpenChange={(open) =>
                                !open && setEditandoVendedor(null)
                              }
                            >
                              <SelectTrigger className="h-8 w-full">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sin-asignar">
                                  Sin asignar
                                </SelectItem>
                                {vendedores.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div
                              className={`flex items-center gap-2 ${estaDescartada(op.estado) ? "" : "text-gray-600 dark:text-gray-300"}`}
                            >
                              {op.vendedor?.nombre || "-"}
                              <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100">
                                ✏️
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => eliminarOportunidad(op.id)}
                              data-testid={`button-delete-oportunidad-${op.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
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
        )}
      </div>
    </div>
  );
}
