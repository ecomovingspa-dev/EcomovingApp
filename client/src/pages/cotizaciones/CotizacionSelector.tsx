import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../supabase";
import type { Cuenta, Contacto } from "../../types";

export default function CotizacionSelector() {
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState("");
  const [contactoSeleccionado, setContactoSeleccionado] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarCuentas();
  }, []);

  useEffect(() => {
    if (cuentaSeleccionada) {
      cargarContactos(cuentaSeleccionada);
    } else {
      setContactos([]);
      setContactoSeleccionado("");
    }
  }, [cuentaSeleccionada]);

  const cargarCuentas = async () => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select("id, cliente")
        .order("cliente");

      if (error) throw error;
      setCuentas(data || []);
    } catch (error: any) {
      console.error("Error:", error);
    }
  };

  const cargarContactos = async (cuentaId: string) => {
    try {
      const { data, error } = await supabase
        .from("contactos")
        .select("*")
        .eq("cuenta_id", cuentaId)
        .order("nombre");

      if (error) throw error;
      setContactos(data || []);
    } catch (error: any) {
      console.error("Error:", error);
    }
  };

  const handleContinuar = () => {
    if (!cuentaSeleccionada) {
      setMensaje("⚠️ Selecciona una cuenta");
      return;
    }
    if (!contactoSeleccionado) {
      setMensaje("⚠️ Selecciona un contacto");
      return;
    }

    navigate(
      `/cotizaciones/nueva/${cuentaSeleccionada}/${contactoSeleccionado}`,
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/cotizaciones"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Nueva Cotización
        </h1>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
          📌 Paso 1: Seleccionar Cliente
        </h3>
        <p className="text-blue-800 dark:text-blue-400 text-sm">
          Primero selecciona la cuenta y el contacto asociado a esta cotización
        </p>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div className="p-4 rounded-lg font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
          {mensaje}
        </div>
      )}

      {/* Formulario de selección */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Seleccionar Cuenta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            1. Seleccionar Cuenta (Cliente) *
          </label>
          {cuentas.length === 0 ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-400 text-sm">
              ⚠️ No hay cuentas disponibles.
              <Link
                to="/cuentas/nueva"
                className="underline ml-1 font-medium hover:text-yellow-900 dark:hover:text-yellow-300"
              >
                Crear una cuenta primero
              </Link>
            </div>
          ) : (
            <select
              value={cuentaSeleccionada}
              onChange={(e) => setCuentaSeleccionada(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">-- Seleccionar cuenta --</option>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.cliente}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Seleccionar Contacto */}
        {cuentaSeleccionada && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              2. Seleccionar Contacto *
            </label>
            {contactos.length === 0 ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-400 text-sm">
                ⚠️ Esta cuenta no tiene contactos.
                <Link
                  to="/contactos/nuevo"
                  className="underline ml-1 font-medium hover:text-yellow-900 dark:hover:text-yellow-300"
                >
                  Agregar un contacto
                </Link>
              </div>
            ) : (
              <select
                value={contactoSeleccionado}
                onChange={(e) => setContactoSeleccionado(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              >
                <option value="">-- Seleccionar contacto --</option>
                {contactos.map((contacto) => (
                  <option key={contacto.id} value={contacto.id}>
                    {contacto.nombre}{" "}
                    {contacto.correo ? `(${contacto.correo})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Resumen */}
        {cuentaSeleccionada && contactoSeleccionado && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-1">
                  Listo para continuar
                </h3>
                <p className="text-green-800 dark:text-green-400 text-sm">
                  Cuenta:{" "}
                  <strong>
                    {cuentas.find((c) => c.id === cuentaSeleccionada)?.cliente}
                  </strong>
                  <br />
                  Contacto:{" "}
                  <strong>
                    {
                      contactos.find((c) => c.id === contactoSeleccionado)
                        ?.nombre
                    }
                  </strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3">
        <Link
          to="/cotizaciones"
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </Link>
        <button
          onClick={handleContinuar}
          disabled={
            !cuentaSeleccionada || !contactoSeleccionado || cuentas.length === 0
          }
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continuar al Formulario →
        </button>
      </div>
    </div>
  );
}
