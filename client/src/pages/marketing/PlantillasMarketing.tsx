import { useState } from "react";
import { supabase } from "../../supabase";
import {
  comprimirImagen,
  fileToBase64,
  formatFileSize,
} from "../../utils/imageUtils";
import { generarContenidoEmail } from "../../services/geminiService";

export default function PlantillasMarketing() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoComprimido, setArchivoComprimido] = useState<File | null>(null);
  const [previsualizacion, setPrevisualizacion] = useState<string>("");
  const [previsualizacionComprimida, setPrevisualizacionComprimida] =
    useState<string>("");

  const [asunto, setAsunto] = useState("");
  const [cuerpoHtml, setCuerpoHtml] = useState("");
  const [descripcionIA, setDescripcionIA] = useState("");

  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Manejar selección de archivo
  const handleArchivoSeleccionado = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea imagen
    if (!file.type.startsWith("image/")) {
      setError("Por favor selecciona una imagen válida");
      return;
    }

    setError("");
    setArchivo(file);

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPrevisualizacion(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Comprimir automáticamente
    await comprimirImagenAutomatico(file);
  };

  // Comprimir imagen
  const comprimirImagenAutomatico = async (file: File) => {
    setProcesando(true);
    setError("");

    try {
      const comprimida = await comprimirImagen(file);
      setArchivoComprimido(comprimida);

      // Preview de comprimida
      const reader = new FileReader();
      reader.onload = (e) => {
        setPrevisualizacionComprimida(e.target?.result as string);
      };
      reader.readAsDataURL(comprimida);
    } catch (err) {
      setError("Error al comprimir la imagen");
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  // Generar contenido con IA
  const handleGenerarConIA = async () => {
    if (!archivoComprimido) {
      setError("Primero debes seleccionar y procesar una imagen");
      return;
    }

    setGenerando(true);
    setError("");

    try {
      // Convertir a base64
      const base64 = await fileToBase64(archivoComprimido);

      // Obtener siguiente número de secuencia
      const { count } = await supabase
        .from("marketing_plantillas")
        .select("*", { count: "exact", head: true });

      const numeroSecuencia = (count || 0) + 1;

      // Generar contenido con Gemini
      const contenido = await generarContenidoEmail(base64, numeroSecuencia);

      setAsunto(contenido.asunto);
      setCuerpoHtml(contenido.cuerpo_html);
      setDescripcionIA(contenido.descripcion);
    } catch (err: any) {
      setError(err.message || "Error al generar contenido");
      console.error(err);
    } finally {
      setGenerando(false);
    }
  };

  // Guardar y activar plantilla
  const handleGuardarYActivar = async () => {
    if (!archivoComprimido || !asunto || !cuerpoHtml) {
      setError("Completa todos los campos antes de guardar");
      return;
    }

    setGuardando(true);
    setError("");
    setExito("");

    try {
      // 1. Subir imagen al storage
      const timestamp = Date.now();
      const nombreArchivo = `imagen_${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("imagenes-marketing")
        .upload(nombreArchivo, archivoComprimido, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("imagenes-marketing")
        .getPublicUrl(nombreArchivo);

      // 3. Insertar en tabla marketing_plantillas
      const { error: insertError } = await supabase
        .from("marketing_plantillas")
        .insert({
          imagen_url: publicUrl,
          asunto: asunto,
          cuerpo_html: cuerpoHtml.replace("{{imagen_url}}", publicUrl),
          estado: "activa", // Activar automáticamente
        });

      if (insertError) throw insertError;

      setExito("✅ Plantilla guardada y activada correctamente");

      // Limpiar formulario
      setTimeout(() => {
        limpiarFormulario();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Error al guardar plantilla");
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  // Limpiar formulario
  const limpiarFormulario = () => {
    setArchivo(null);
    setArchivoComprimido(null);
    setPrevisualizacion("");
    setPrevisualizacionComprimida("");
    setAsunto("");
    setCuerpoHtml("");
    setDescripcionIA("");
    setError("");
    setExito("");
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          📧 Crear Plantilla de Email
        </h1>
        <p className="text-gray-600 mt-2">
          Sube una imagen de producto personalizado y genera automáticamente el
          contenido del email con IA
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {exito && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {exito}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* PASO 1: SUBIR IMAGEN */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Paso 1: Seleccionar Imagen
          </h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleArchivoSeleccionado}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              📤 Seleccionar Imagen
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Formatos: JPG, PNG, WEBP
            </p>
          </div>

          {/* Preview Original vs Comprimida */}
          {archivo && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              {/* Original */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">Original</h3>
                <img
                  src={previsualizacion}
                  alt="Original"
                  className="w-full h-48 object-contain mb-2"
                />
                <p className="text-sm text-gray-600">
                  {formatFileSize(archivo.size)}
                </p>
              </div>

              {/* Comprimida */}
              <div className="border rounded-lg p-4 bg-green-50">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  Procesada{" "}
                  {procesando && (
                    <span className="text-xs">⚙️ Procesando...</span>
                  )}
                </h3>
                {archivoComprimido ? (
                  <>
                    <img
                      src={previsualizacionComprimida}
                      alt="Comprimida"
                      className="w-full h-48 object-contain mb-2"
                    />
                    <p className="text-sm text-green-700 font-medium">
                      ✓ {formatFileSize(archivoComprimido.size)}
                    </p>
                  </>
                ) : (
                  <div className="w-full h-48 bg-gray-100 animate-pulse rounded"></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PASO 2: GENERAR CONTENIDO CON IA */}
        {archivoComprimido && (
          <div className="mb-8 border-t pt-8">
            <h2 className="text-xl font-semibold mb-4">
              Paso 2: Generar Contenido con IA
            </h2>

            <button
              onClick={handleGenerarConIA}
              disabled={generando}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {generando ? "🤖 Generando con IA..." : "✨ Generar con Gemini"}
            </button>

            {/* Contenido Generado */}
            {asunto && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Asunto del Email
                  </label>
                  <input
                    type="text"
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Asunto del email..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuerpo del Email (HTML)
                  </label>
                  <textarea
                    value={cuerpoHtml}
                    onChange={(e) => setCuerpoHtml(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Contenido HTML del email..."
                  />
                </div>

                {descripcionIA && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>🤖 IA detectó:</strong> {descripcionIA}
                    </p>
                  </div>
                )}

                {/* Vista Previa del Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👁️ Vista Previa
                  </label>
                  <div className="border rounded-lg p-6 bg-gray-50">
                    <div className="bg-white p-6 rounded shadow-sm">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: cuerpoHtml
                            .replace("{{nombre}}", "Juan Pérez")
                            .replace(
                              "{{imagen_url}}",
                              previsualizacionComprimida,
                            ),
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 3: GUARDAR Y ACTIVAR */}
        {asunto && cuerpoHtml && (
          <div className="border-t pt-8">
            <h2 className="text-xl font-semibold mb-4">
              Paso 3: Guardar y Activar
            </h2>

            <div className="flex gap-4">
              <button
                onClick={handleGuardarYActivar}
                disabled={guardando}
                className="px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {guardando
                  ? "💾 Guardando..."
                  : "✅ Guardar y Activar Plantilla"}
              </button>

              <button
                onClick={limpiarFormulario}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
              >
                ❌ Cancelar
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              La plantilla se guardará como <strong>ACTIVA</strong> y estará
              disponible inmediatamente para los envíos automáticos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
