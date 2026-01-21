
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Loader2,
    Save,
    Wand2,
    AlertTriangle,
    CheckCircle2,
    AlertOctagon,
    Info,
    Clock,
} from "lucide-react";

interface ReglaCobranza {
    id: number;
    nombre: string;
    etiqueta: string;
    dias_min: number;
    dias_max: number;
    asunto_template: string;
    mensaje_intro: string;
    mensaje_cierre: string;
    urgencia: string;
    activo: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ConfiguracionCobranza({ open, onOpenChange }: Props) {
    const [reglas, setReglas] = useState<ReglaCobranza[]>([]);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("preventivo");

    useEffect(() => {
        if (open) {
            cargarReglas();
        }
    }, [open]);

    const cargarReglas = async () => {
        setCargando(true);
        try {
            const { data, error } = await supabase
                .from("configuracion_cobranza")
                .select("*")
                .order("dias_min", { ascending: true });

            if (error) throw error;
            setReglas(data || []);
            if (data && data.length > 0) {
                setActiveTab(data[0].nombre);
            }
        } catch (error) {
            console.error("Error cargando reglas:", error);
        } finally {
            setCargando(false);
        }
    };

    const handleUpdateRegla = (
        id: number,
        field: keyof ReglaCobranza,
        value: any
    ) => {
        setReglas((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const guardarCambios = async (regla: ReglaCobranza) => {
        setGuardando(true);
        try {
            const { error } = await supabase
                .from("configuracion_cobranza")
                .update({
                    asunto_template: regla.asunto_template,
                    mensaje_intro: regla.mensaje_intro,
                    mensaje_cierre: regla.mensaje_cierre,
                    dias_min: regla.dias_min,
                    dias_max: regla.dias_max,
                })
                .eq("id", regla.id);

            if (error) throw error;
            alert("Configuración guardada correctamente");
        } catch (error: any) {
            console.error("Error guardando:", error);
            alert("Error al guardar: " + error.message);
        } finally {
            setGuardando(false);
        }
    };

    const getUrgenciaColor = (urgencia: string) => {
        switch (urgencia) {
            case "normal":
                return "bg-blue-100 text-blue-800 border-blue-200";
            case "media":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "alta":
                return "bg-orange-100 text-orange-800 border-orange-200";
            case "critica":
                return "bg-red-100 text-red-800 border-red-200";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getUrgenciaIcon = (urgencia: string) => {
        switch (urgencia) {
            case "normal":
                return <Info className="h-4 w-4" />;
            case "media":
                return <Clock className="h-4 w-4" />;
            case "alta":
                return <AlertTriangle className="h-4 w-4" />;
            case "critica":
                return <AlertOctagon className="h-4 w-4" />;
            default:
                return <CheckCircle2 className="h-4 w-4" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Wand2 className="h-5 w-5 text-purple-600" />
                        Configuración de Cobranza Inteligente
                    </DialogTitle>
                    <DialogDescription>
                        Personaliza los mensajes y reglas que se enviarán automáticamente según
                        los días de atraso.
                    </DialogDescription>
                </DialogHeader>

                {cargando ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="mt-4">
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-5 mb-4">
                                {reglas.map((regla) => (
                                    <TabsTrigger
                                        key={regla.nombre}
                                        value={regla.nombre}
                                        className="text-xs md:text-sm truncate"
                                    >
                                        {regla.etiqueta}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {reglas.map((regla) => (
                                <TabsContent key={regla.nombre} value={regla.nombre}>
                                    <Card className="border-0 shadow-none">
                                        <CardHeader className="px-0 pt-0">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        {regla.etiqueta}
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-xs font-normal border flex items-center gap-1 ${getUrgenciaColor(
                                                                regla.urgencia
                                                            )}`}
                                                        >
                                                            {getUrgenciaIcon(regla.urgencia)}
                                                            Urgencia {regla.urgencia}
                                                        </span>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Se activa cuando la factura tiene entre{" "}
                                                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {Math.abs(regla.dias_min)}
                                                        </span>{" "}
                                                        y{" "}
                                                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {Math.abs(regla.dias_max)}
                                                        </span>{" "}
                                                        días {regla.dias_min < 0 ? "antes de vencer" : "de vencida"}.
                                                    </CardDescription>
                                                </div>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <Wand2 className="h-4 w-4 text-purple-600" />
                                                    Mejorar con IA
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 px-0">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Días Mínimo</Label>
                                                    <Input
                                                        type="number"
                                                        value={regla.dias_min}
                                                        onChange={(e) =>
                                                            handleUpdateRegla(
                                                                regla.id,
                                                                "dias_min",
                                                                parseInt(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Días Máximo</Label>
                                                    <Input
                                                        type="number"
                                                        value={regla.dias_max}
                                                        onChange={(e) =>
                                                            handleUpdateRegla(
                                                                regla.id,
                                                                "dias_max",
                                                                parseInt(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label>Asunto del Correo</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        Variables: &#123;folio&#125;, &#123;dias&#125;
                                                    </span>
                                                </div>
                                                <Input
                                                    value={regla.asunto_template}
                                                    onChange={(e) =>
                                                        handleUpdateRegla(
                                                            regla.id,
                                                            "asunto_template",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label>Mensaje de Introducción</Label>
                                                    <Textarea
                                                        className="min-h-[120px]"
                                                        value={regla.mensaje_intro}
                                                        onChange={(e) =>
                                                            handleUpdateRegla(
                                                                regla.id,
                                                                "mensaje_intro",
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Aparece al inicio, antes del detalle de la factura.
                                                        Admite HTML básico.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Mensaje de Cierre</Label>
                                                    <Textarea
                                                        className="min-h-[120px]"
                                                        value={regla.mensaje_cierre}
                                                        onChange={(e) =>
                                                            handleUpdateRegla(
                                                                regla.id,
                                                                "mensaje_cierre",
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Aparece al final, después de los datos bancarios.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md p-4 mt-4">
                                                <Label className="text-xs uppercase text-gray-500 mb-2 block">
                                                    Vista Previa Aproximada
                                                </Label>
                                                <div className="text-sm font-sans text-gray-800 dark:text-gray-300 bg-white dark:bg-gray-800 p-4 border rounded shadow-sm">
                                                    <p className="mb-2">
                                                        <strong>Asunto:</strong>{" "}
                                                        {regla.asunto_template
                                                            .replace("{folio}", "12345")
                                                            .replace("{dias}", "5")}
                                                    </p>
                                                    <hr className="my-2" />
                                                    <div
                                                        dangerouslySetInnerHTML={{
                                                            __html: regla.mensaje_intro.replace("{dias}", "5"),
                                                        }}
                                                    />
                                                    <div className="my-4 p-2 bg-gray-100 dark:bg-gray-700 text-center text-xs text-gray-500">
                                                        [ Datos de Factura 12345 ]
                                                    </div>
                                                    <div
                                                        dangerouslySetInnerHTML={{
                                                            __html: regla.mensaje_cierre,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="px-0 flex justify-end gap-2">
                                            <Button
                                                variant="secondary"
                                                onClick={() => cargarReglas()} // Reset
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                onClick={() => guardarCambios(regla)}
                                                disabled={guardando}
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                            >
                                                {guardando ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                Guardar Cambios
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
