import { useState, useEffect } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Contacto, Cuenta } from "../../types";
import { ArrowLeft, Save, Search, Check, User, Mail, Phone, Building2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVendedores } from "../../hooks/useVendedores";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function ContactoForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCuentaId = searchParams.get("cuentaId");
  // esEdicion removed as editing is now inline in the table
  const esEdicion = false;

  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const { vendedores } = useVendedores();
  const [contacto, setContacto] = useState<Partial<Contacto>>({
    nombre: "",
    correo: "",
    celular: "",
    telefono: "",
    departamento: "",
    estado: "activo",
    cuenta_id: preselectedCuentaId || "",
    vendedor_id: "",
  });

  const [busquedaCuentas, setBusquedaCuentas] = useState("");

  const normalizarTexto = (texto: string) => {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const cuentasFiltradas = (cuentas || []).filter((c) => {
    const queryNorm = normalizarTexto(busquedaCuentas);
    const clienteNorm = normalizarTexto(c.cliente || "");
    const rutNorm = normalizarTexto(c.rut || "");
    return clienteNorm.includes(queryNorm) || rutNorm.includes(queryNorm);
  });

  useEffect(() => {
    cargarCuentas();
  }, []);

  const cargarCuentas = async () => {
    try {
      let allData: Cuenta[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("cuentas")
          .select("id, cliente, rut, estado")
          .neq("estado", "inactivo") // Permitir cuentas con estado activo o prospecto (excluye inactivo)
          .order("cliente")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setCuentas(allData);
    } catch (error: any) {
      console.error("Error al cargar cuentas:", error);
      setMensaje("❌ Error al cargar cuentas");
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contacto.nombre?.trim()) {
      setMensaje("⚠️ El nombre es obligatorio");
      return;
    }

    if (!contacto.cuenta_id) {
      setMensaje("⚠️ Debe seleccionar una cuenta");
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const payload = {
        ...contacto,
        vendedor_id: contacto.vendedor_id || null,
      };
      delete (payload as any).vendedores;

      const { error } = await supabase.from("contactos").insert([payload]);

      if (error) throw error;
      setMensaje("✅ Contacto creado");

      // Regla: Si tiene contactos -> Activo
      await supabase
        .from("cuentas")
        .update({ estado: "activo" })
        .eq("id", (contacto as any).cuenta_id);

      setTimeout(() => navigate("/contactos"), 1500);
    } catch (error: any) {
      console.error("Error al guardar:", error);
      setMensaje("❌ Error al guardar el contacto");
    } finally {
      setGuardando(false);
    }
  };

  const handleChange = (field: keyof Contacto, value: string) => {
    setContacto((prev) => {
      const nuevoContacto = { ...prev, [field]: value };

      // Regla: Sin correo => Inactivo forzado (si se desea mantener esta lógica)
      return nuevoContacto;
    });
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contactos")}
          className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {esEdicion ? "Editar Contacto" : "Nuevo Contacto"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {esEdicion
              ? "Modifica la información del contacto existente"
              : "Completa los datos para registrar un nuevo contacto"}
          </p>
        </div>
      </div>

      {/* Mensaje de Feedback */}
      {mensaje && (
        <div
          className={cn(
            "mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300",
            mensaje.includes("❌") || mensaje.includes("⚠️")
              ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400"
              : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400"
          )}
        >
          <span className="text-lg">{mensaje.split(" ")[0]}</span>
          <span className="font-medium">{mensaje.split(" ").slice(1).join(" ")}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-500" />
                  Información Personal
                </CardTitle>
                <CardDescription>
                  Datos básicos y de identificación del contacto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="nombre" className="text-sm font-semibold">
                    Nombre Completo <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="nombre"
                      value={contacto.nombre}
                      onChange={(e) => handleChange("nombre", e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="pl-10 h-11 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="correo" className="text-sm font-semibold">
                      Correo Electrónico
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="correo"
                        type="email"
                        value={contacto.correo}
                        onChange={(e) => handleChange("correo", e.target.value)}
                        placeholder="juan@empresa.com"
                        className="pl-10 h-11 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="departamento" className="text-sm font-semibold">
                      Departamento
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="departamento"
                        value={contacto.departamento}
                        onChange={(e) => handleChange("departamento", e.target.value)}
                        placeholder="Ej: Ventas, Logística..."
                        className="pl-10 h-11 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5 text-emerald-500" />
                  Medios de Contacto
                </CardTitle>
                <CardDescription>
                  Teléfonos de contacto directo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="celular" className="text-sm font-semibold">
                      Celular
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="celular"
                        value={contacto.celular}
                        onChange={(e) => handleChange("celular", e.target.value)}
                        placeholder="+56 9 1234 5678"
                        className="pl-10 h-11 dark:bg-gray-900 dark:border-gray-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefono" className="text-sm font-semibold">
                      Teléfono Fijo
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="telefono"
                        value={contacto.telefono}
                        onChange={(e) => handleChange("telefono", e.target.value)}
                        placeholder="+56 2 1234 5678"
                        className="pl-10 h-11 dark:bg-gray-900 dark:border-gray-700"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna Lateral */}
          <div className="space-y-6">
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  Asignación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Cuenta / Cliente <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={cuentaOpen} onOpenChange={setCuentaOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={cuentaOpen}
                        className="w-full justify-between h-11 dark:bg-gray-900 dark:border-gray-700 hover:border-blue-500 transition-all"
                      >
                        <span className="truncate">
                          {contacto.cuenta_id
                            ? cuentas.find((c) => c.id === contacto.cuenta_id)?.cliente
                            : "Seleccionar cuenta..."}
                        </span>
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-xl" align="start">
                      <div className="flex flex-col h-[300px]">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Buscar cliente..."
                              className="pl-8 h-9 text-sm bg-gray-50 dark:bg-gray-900 border-none"
                              value={busquedaCuentas}
                              onChange={(e) => setBusquedaCuentas(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                          {cuentasFiltradas.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500">
                              No se encontraron cuentas activas o prospectos.
                            </div>
                          ) : (
                            cuentasFiltradas.map((cuenta) => (
                              <button
                                key={cuenta.id}
                                type="button"
                                onClick={() => {
                                  handleChange("cuenta_id", cuenta.id);
                                  setCuentaOpen(false);
                                  setBusquedaCuentas("");
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
                                  contacto.cuenta_id === cuenta.id
                                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                )}
                              >
                                <span className="truncate pr-2">{cuenta.cliente}</span>
                                {contacto.cuenta_id === cuenta.id && (
                                  <Check className="h-4 w-4 shrink-0" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Solo se muestran cuentas con estado activo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado" className="text-sm font-semibold">
                    Estado del Contacto
                  </Label>
                  <Select
                    value={contacto.estado}
                    onValueChange={(val) => handleChange("estado", val as any)}
                  >
                    <SelectTrigger 
                      className="h-11 dark:bg-gray-900 dark:border-gray-700"
                    >
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          Activo
                        </div>
                      </SelectItem>
                      <SelectItem value="inactivo">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          Inactivo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendedor_id" className="text-sm font-semibold">
                    Usuario / Vendedor Responsable
                  </Label>
                  <select
                    id="vendedor_id"
                    value={contacto.vendedor_id || ""}
                    onChange={(e) => handleChange("vendedor_id", e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-sm h-11"
                  >
                    <option value="">Sin Asignar (Creado por IA)</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        👤 {v.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={guardando || !contacto.cuenta_id}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
              >
                {guardando ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    Guardando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {esEdicion ? "Actualizar Contacto" : "Crear Contacto"}
                  </div>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/contactos")}
                className="w-full h-11 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
