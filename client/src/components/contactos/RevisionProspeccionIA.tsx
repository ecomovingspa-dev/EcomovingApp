import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Send, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contacto: {
        id: string;
        correo: string;
        cuentas?: {
            cliente: string;
            sector?: string;
        };
    } | null;
    onSuccess?: () => void;
}

export function RevisionProspeccionIA({ open, onOpenChange, contacto, onSuccess }: Props) {
    const [cargando, setCargando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [draft, setDraft] = useState({ subject: "", body: "" });
    const [error, setError] = useState("");
    const [completado, setCompletado] = useState(false);

    useEffect(() => {
        if (open && contacto && !completado) {
            generarBorrador();
        }
    }, [open, contacto]);

    const generarBorrador = async () => {
        setCargando(true);
        setError("");
        try {
            const res = await fetch("/api/prospeccion-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactoId: contacto?.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al conectar con la IA");
            
            setDraft(data.draft);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    const enviarAprobado = async () => {
        if (!draft.subject || !draft.body) return;
        setEnviando(true);
        try {
            // Reutilizamos el endpoint de envío pero pasándole el texto aprobado
            const res = await fetch("/api/send-prospeccion-approved", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactoId: contacto?.id,
                    subject: draft.subject,
                    body: draft.body
                }),
            });
            if (!res.ok) throw new Error("Error al enviar el correo");
            
            setCompletado(true);
            setTimeout(() => {
                onOpenChange(false);
                if (onSuccess) onSuccess();
                // Reset para la próxima vez
                setCompletado(false);
                setDraft({ subject: "", body: "" });
            }, 2000);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setEnviando(false);
        }
    };

    if (!contacto) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white dark:bg-[#0f1117] border-gray-200 dark:border-gray-800 p-0 overflow-hidden">
                <DialogHeader className="p-6 border-b border-gray-100 dark:border-gray-800 bg-violet-50/50 dark:bg-violet-900/10">
                    <DialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
                        <Sparkles className="h-5 w-5" />
                        Revisión de Prospección IA (Gemma 3)
                    </DialogTitle>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Empresa: <span className="font-bold">{contacto.cuentas?.cliente}</span> · Destino: <span className="font-mono">{contacto.correo}</span>
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    {cargando ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
                            <Loader2 className="h-10 w-10 text-violet-600 animate-spin mb-4" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gemma 3 está redactando una propuesta personalizada...</p>
                        </div>
                    ) : completado ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in">
                            <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">¡Correo Enviado!</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">El contacto se ha actualizado y la acción quedó registrada.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    {error}
                                    <Button variant="link" size="sm" onClick={generarBorrador} className="ml-auto h-auto p-0 text-red-600">Reintentar</Button>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Asunto del Correo</Label>
                                <Input
                                    value={draft.subject}
                                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                                    className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus-visible:ring-violet-500 font-medium"
                                    placeholder="Ingrese un asunto..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Cuerpo del Mensaje (Editable)</Label>
                                <Textarea
                                    value={draft.body}
                                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                                    className="min-h-[250px] bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus-visible:ring-violet-500 leading-relaxed text-sm"
                                    placeholder="Redacte su mensaje aquí..."
                                />
                            </div>

                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                                💡 <strong>@protocolo:</strong> Revise que el tono sea adecuado y que no haya alucinaciones sobre productos que no fabricamos. Al presionar "Aprobar y Enviar", el correo se disparará inmediatamente.
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={cargando || enviando}
                        className="text-gray-500"
                    >
                        Cancelar
                    </Button>

                    <div className="flex gap-2">
                        {!completado && !cargando && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={generarBorrador}
                                className="h-10 text-violet-600 border-violet-200 dark:border-violet-800 hover:bg-violet-50"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Regenerar con IA
                            </Button>
                        )}
                        <Button
                            onClick={enviarAprobado}
                            disabled={cargando || enviando || !draft.body || completado}
                            className="bg-violet-700 hover:bg-violet-800 text-white min-w-[140px] h-10 shadow-lg shadow-violet-900/20"
                        >
                            {enviando ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                            ) : (
                                <><Send className="h-4 w-4 mr-2" />Aprobar y Enviar</>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
