import { useState, memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, EyeOff } from "lucide-react";

interface Vendedor {
    id: string;
    nombre: string;
}

interface Oportunidad {
    id: string;
    nombre?: string;
    fecha_cierre?: string;
    organismo?: string;
    monto_disponible?: number;
    estado?: string;
    clave?: string;
    vendedor_id?: string | null;
    vendedor?: { nombre: string } | { nombre: string }[] | null;
}

interface OportunidadRowProps {
    op: Oportunidad;
    vendedores: Vendedor[];
    seleccionada: boolean;
    onToggleSeleccion: (id: string) => void;
    onActualizarVendedor: (id: string, vendedorId: string) => void;
    onToggleEstado: (id: string, estadoActual?: string) => void;
    onEliminar: (id: string) => void;
    formatearFecha: (f: any) => string;
    formatearMonto: (m: any) => string;
    getEstadoColor: (e: any) => string;
    estaDescartada: (e: any) => boolean;
}

export const OportunidadRow = memo(function OportunidadRow({
    op,
    vendedores,
    seleccionada,
    onToggleSeleccion,
    onActualizarVendedor,
    onToggleEstado,
    onEliminar,
    formatearFecha,
    formatearMonto,
    getEstadoColor,
    estaDescartada,
}: OportunidadRowProps) {
    const [editando, setEditando] = useState(false);

    const handleVendedorChange = (val: string) => {
        onActualizarVendedor(op.id, val === "sin-assignar" || val === "sin-asignar" ? "" : val);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group border-b border-gray-100 dark:border-gray-800">
            <td className="px-4 py-3 text-center">
                <Checkbox
                    checked={seleccionada}
                    onCheckedChange={() => onToggleSeleccion(op.id)}
                />
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                <span
                    className="cursor-pointer hover:text-blue-600 select-all"
                    onClick={() => copyToClipboard(op.id)}
                    title="Click para copiar ID"
                >
                    {op.id}
                </span>
            </td>
            <td className={`px-4 py-3 text-sm font-medium ${estaDescartada(op.estado) ? "text-gray-400 line-through opacity-50" : "text-gray-900 dark:text-gray-100"}`}>
                <div className="whitespace-normal leading-tight max-w-[200px]" title={op.organismo}>
                    {op.organismo || "-"}
                </div>
            </td>
            <td className={`px-4 py-3 text-sm ${estaDescartada(op.estado) ? "text-gray-400 line-through opacity-50" : "text-gray-700 dark:text-gray-300"}`}>
                <div className="whitespace-normal leading-tight max-w-[250px]" title={op.nombre}>
                    {op.nombre || "-"}
                </div>
            </td>
            <td className={`px-4 py-3 whitespace-nowrap text-sm ${estaDescartada(op.estado) ? "text-gray-400 opacity-50" : "text-gray-600 dark:text-gray-400"}`}>
                {formatearFecha(op.fecha_cierre)}
            </td>
            <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${estaDescartada(op.estado) ? "text-gray-400 line-through opacity-50" : "text-gray-800 dark:text-gray-200"}`}>
                {formatearMonto(op.monto_disponible)}
            </td>
            <td className={`px-4 py-3 text-xs italic ${estaDescartada(op.estado) ? "text-gray-400 opacity-50" : "text-blue-600 dark:text-blue-400"}`}>
                <div className="whitespace-normal leading-tight min-w-[120px]">
                    {op.clave || "-"}
                </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm">
                {editando ? (
                    <select
                        className="h-8 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 transition-shadow text-gray-700 dark:text-gray-300"
                        value={op.vendedor_id || "sin-asignar"}
                        onChange={(e) => handleVendedorChange(e.target.value)}
                        onBlur={() => setEditando(false)}
                        autoFocus
                    >
                        <option value="sin-asignar">Sin asignar</option>
                        {vendedores?.map((v) => (
                            <option key={v.id} value={v.id}>{v.nombre}</option>
                        ))}
                    </select>
                ) : (
                    <div className="flex items-center gap-2 cursor-pointer py-1" onClick={() => setEditando(true)}>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                            {(() => {
                                if (!op.vendedor) return "-";
                                if (Array.isArray(op.vendedor)) return op.vendedor[0]?.nombre || "-";
                                return (op.vendedor as any).nombre || "-";
                            })()}
                        </span>
                        {!estaDescartada(op.estado) && <span className="text-[10px] opacity-0 group-hover:opacity-100">✏️</span>}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-right">
                <div className="flex justify-end gap-1">
                    <button
                        onClick={() => onToggleEstado(op.id, op.estado)}
                        className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${estaDescartada(op.estado) ? "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" : "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"}`}
                        title={estaDescartada(op.estado) ? "Recuperar" : "Descartar"}
                    >
                        <EyeOff className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onEliminar(op.id)}
                        className="h-8 w-8 rounded flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
});
