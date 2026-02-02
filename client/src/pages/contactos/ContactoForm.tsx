import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Contacto, Cuenta } from "../../types";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ContactoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const esEdicion = !!id;

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [contacto, setContacto] = useState<Partial<Contacto>>({
    nombre: "",
    correo: "",
    celular: "",
    telefono: "",
    departamento: "",
    estado: "activo",
    cuenta_id: "",
  });

  useEffect(() => {
    cargarCuentas();
    if (esEdicion) cargarContacto();
  }, [id]);

  const cargarCuentas = async () => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select("id, cliente")
        .order("cliente");

      if (error) throw error;
      setCuentas(data || []);
    } catch (error: any) {
      console.error("Error al cargar cuentas:", error);
      setMensaje("❌ Error al cargar cuentas");
    }
  };

  const cargarContacto = async () => {
    try {
      const { data, error } = await supabase
        .from("contactos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) setContacto(data);
    } catch (error: any) {
      console.error("Error al cargar contacto:", error);
      setMensaje("❌ Error al cargar contacto");
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
      if (esEdicion) {
        const { error } = await supabase
          .from("contactos")
          .update(contacto)
          .eq("id", id);

        if (error) throw error;
        setMensaje("✅ Contacto actualizado");
      } else {
        const { error } = await supabase.from("contactos").insert([contacto]);

        if (error) throw error;
        setMensaje("✅ Contacto creado");
      }

      setTimeout(() => navigate("/contactos"), 1500);
    } catch (error: any) {
      console.error("Error al guardar:", error);
      setMensaje("❌ Error al guardar el contacto");
    } finally {
      setGuardando(false);
    }
  };

  const handleChange = (field: keyof Contacto, value: string) => {
    setContacto((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contactos")}
          className="h-10 w-10 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {esEdicion ? "Editar Contacto" : "Nuevo Contacto"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {esEdicion
              ? "Modifica la información del contacto"
              : "Completa los datos del nuevo contacto"}
          </p>
        </div>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div
          className={`p-4 rounded-lg font-medium border ${
            mensaje.includes("❌") || mensaje.includes("⚠️")
              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
          }`}
        >
          {mensaje}
        </div>
      )}

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      >
        <div className="p-6 space-y-6">
          {/* Cuenta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cuenta <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            {cuentas.length === 0 ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-400 text-sm">
                ⚠️ No hay cuentas disponibles.
                <Link
                  to="/cuentas/nueva"
                  className="underline ml-1 font-medium"
                >
                  Crear una cuenta primero
                </Link>
              </div>
            ) : (
              <select
                value={contacto.cuenta_id}
                onChange={(e) => handleChange("cuenta_id", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              >
                <option value="">Seleccionar cuenta...</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.cliente}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre Completo{" "}
              <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <Input
              type="text"
              value={contacto.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              placeholder="Ej: Juan Pérez González"
              required
              className="h-12"
            />
          </div>

          {/* Correo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Correo Electrónico
            </label>
            <Input
              type="email"
              value={contacto.correo}
              onChange={(e) => handleChange("correo", e.target.value)}
              placeholder="juan.perez@empresa.com"
              className="h-12"
            />
          </div>

          {/* Celular */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Celular
            </label>
            <Input
              type="tel"
              value={contacto.celular}
              onChange={(e) => handleChange("celular", e.target.value)}
              placeholder="+56 9 1234 5678"
              className="h-12"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Teléfono Fijo
            </label>
            <Input
              type="tel"
              value={contacto.telefono}
              onChange={(e) => handleChange("telefono", e.target.value)}
              placeholder="+56 2 1234 5678"
              className="h-12"
            />
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Departamento
            </label>
            <Input
              type="text"
              value={contacto.departamento}
              onChange={(e) => handleChange("departamento", e.target.value)}
              placeholder="Ej: Ventas, Marketing, RRHH"
              className="h-12"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estado
            </label>
            <select
              value={contacto.estado}
              onChange={(e) => handleChange("estado", e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        {/* Botones */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/contactos")}
            className="px-6"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={guardando || cuentas.length === 0}
            className="px-6 bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {guardando ? "Guardando..." : esEdicion ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
