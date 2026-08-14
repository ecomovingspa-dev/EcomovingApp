import { X, BookOpen, CheckCircle2, AlertCircle, Eye, Info } from "lucide-react";
import { DraggableModal } from "@/components/ui/draggable-modal";

interface PautaProspeccionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PautaProspeccionModal({ isOpen, onClose }: PautaProspeccionModalProps) {
  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          <span className="font-bold text-sm uppercase tracking-wide text-indigo-700 dark:text-indigo-400">Pauta de Prospección y Gestión</span>
        </div>
      }
      defaultSize={{ width: 850, height: 600 }}
    >
      <div className="p-6 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-y-auto custom-scrollbar">
        
        {/* Encabezado */}
        <div className="border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Pauta de Prospección y Gestión de Cuentas</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Uso del Matrix Sentinel · Secuencia de 3 correos · Transición a mantención de cuentas</p>
        </div>

        {/* 1. Objetivo */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">1</span>
            Objetivo de este documento
          </h2>
          <p className="text-sm leading-relaxed mb-3">
            Esta pauta define cómo el equipo comercial debe interpretar las señales del Matrix Sentinel (envío, apertura, apertura múltiple) para decidir el siguiente paso con cada contacto, y cuándo una cuenta deja de pertenecer a la secuencia de prospección para pasar a gestión activa (mantención de cuenta).
          </p>
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500 p-3 rounded-r text-sm text-indigo-800 dark:text-indigo-200">
            <strong>Todos los envíos son manuales.</strong> El Sentinel no dispara correos automáticamente; entrega trazabilidad y alertas para que el vendedor decida con criterio, no reemplaza ese criterio.
          </div>
        </section>

        {/* 2. Secuencia de 3 correos */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">2</span>
            La secuencia de 3 correos: para qué existe
          </h2>
          <p className="text-sm leading-relaxed mb-4">
            La secuencia (Consulta directa → Alternativa de valor → Email de despedida) tiene un único objetivo: <strong>conseguir una primera señal de un contacto en silencio total</strong>. No es un mecanismo de venta ni de seguimiento de oportunidad; una vez que hay respuesta humana real, la secuencia deja de aplicar a ese contacto.
          </p>
          
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 mb-6">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Paso</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Propósito</th>
                  <th className="px-4 py-2">Cuándo enviarlo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                <tr>
                  <td className="px-4 py-3 font-bold">1</td>
                  <td className="px-4 py-3 font-medium">Consulta directa</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Presentar la propuesta con render personalizado y validar si el contacto es el indicado.</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Primer contacto con la cuenta foco.</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/20">
                  <td className="px-4 py-3 font-bold">2</td>
                  <td className="px-4 py-3 font-medium">Alternativa de valor</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Correo nuevo e independiente (no reenvío técnico), con render adicional distinto, para dar una razón concreta de volver a mirar.</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Sin apertura ni respuesta tras el tiempo definido, o con una sola apertura sin respuesta.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-bold">3</td>
                  <td className="px-4 py-3 font-medium">Email de despedida</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Cerrar con dignidad un contacto que no ha dado ninguna señal.</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Silencio total (cero aperturas) tras varios intentos, sin ninguna interacción registrada.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-md font-bold text-gray-800 dark:text-gray-200 mb-2">2.1 Paso 2 — correo nuevo, no reenvío técnico</h3>
          <p className="text-sm leading-relaxed mb-4">
            El paso 2 se envía como mensaje nuevo e independiente, con todas sus variables propias — no como un reenvío (Reply/Forward) del correo 1. Esta decisión corrige un problema real de trazabilidad detectado: al reenviar técnicamente el correo 1 e insertar un segundo pixel de tracking, el cuerpo citado arrastra el pixel del correo 1, generando una apertura falsa en la trazabilidad del correo 1.
          </p>
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500 p-3 rounded-r text-sm text-indigo-800 dark:text-indigo-200">
            <strong>Regla general de pixeles:</strong> un correo enviado = un pixel propio. El pixel nunca va dentro de la imagen de contenido; es un elemento aparte de 1x1, invisible.
          </div>
        </section>

        {/* 3. Cómo leer las señales */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">3</span>
            Cómo leer las señales del Sentinel
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Ícono / estado</th>
                  <th className="px-4 py-2">Significado</th>
                  <th className="px-4 py-2">Qué indica sobre el contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                <tr>
                  <td className="px-4 py-3 font-bold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Enviado</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">El correo se envió, sin confirmación de apertura.</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Aún no hay señal. Se mantiene en la secuencia normal.</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/20">
                  <td className="px-4 py-3 font-bold flex items-center gap-2"><Eye className="h-4 w-4 text-purple-500" /> Abierto</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">El contacto abrió el correo al menos una vez.</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Hubo interés inicial. Evaluar antes de reenviar automáticamente.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-bold flex items-center gap-2"><Eye className="h-4 w-4 text-orange-500" /> Abierto xN</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">El contacto volvió a abrir el mismo correo N veces.</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Interés alto o probable revisión interna (jefatura, comité). Prioridad de seguimiento manual.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Árbol de decisión */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">4</span>
            Árbol de decisión antes de cada envío
          </h2>
          <p className="text-sm leading-relaxed mb-4">
            Antes de enviar el correo 2 o el correo 3, revisar el patrón de apertura del contacto — no solo si se cumplieron los días del temporizador.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 mb-4">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 w-1/2">Señal en Sentinel</th>
                  <th className="px-4 py-2 w-1/2">Acción recomendada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                <tr>
                  <td className="px-4 py-3 font-medium">Sin apertura, se cumplió el plazo</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Enviar correo 2 con render distinto al del correo 1. El contacto no vio nada aún; no hay interés que romper.</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/20">
                  <td className="px-4 py-3 font-medium">Abierto 1 vez, sin respuesta, se cumplió el plazo</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Enviar correo 2 es razonable, pero es decisión del vendedor — a veces conviene esperar un poco más antes de apurar el segundo envío.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-orange-600 dark:text-orange-400">Abierto 2 o más veces, sin respuesta</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-bold">No enviar correo 2 ni de despedida. Escalar a seguimiento manual: llamada o mensaje directo y personalizado.</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/20">
                  <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">Respuesta real del contacto (contestación)</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-bold">Sale inmediatamente de la secuencia de plantillas. Pasa a gestión de cuenta / oportunidad (ver sección 5).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Silencio total, cero aperturas, tras varios intentos</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Corresponde el correo de despedida. Es el escenario para el que fue diseñado.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 p-3 rounded-r text-sm text-red-800 dark:text-red-200">
            <strong>Regla dura:</strong> un contacto con aperturas múltiples nunca debe recibir el correo de despedida solo porque se cumplieron los días del temporizador. Sería soltar justo al prospecto que más vale la pena retener.
          </div>
        </section>

        {/* 5. Salida de secuencia */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">5</span>
            Cuándo una cuenta sale de la secuencia y pasa a mantención
          </h2>
          <p className="text-sm leading-relaxed mb-4">
            Cualquier respuesta real del prospecto — no apertura, sino contestación con intención (pide cotización, copia a su equipo, agenda una reunión, deriva a otra área) — <strong>saca automáticamente esa cuenta de las plantillas 2 y 3.</strong> A partir de ese momento es trato personalizado con los tomadores de decisión identificados, no más automatización de copy.
          </p>
        </section>

        {/* 6. Sentinel Cuentas */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">6</span>
            Sentinel de Cuentas — correo mensual para cuentas activas
          </h2>
          <p className="text-sm leading-relaxed mb-4">
            Para cuentas que ya salieron de la secuencia de prospección (respuesta real, cotización, cliente activo), se duplica la lógica del Sentinel en una versión de mantención: un tablero con una columna por mes en vez de tres pasos, donde cada cuenta recibe un único correo mensual.
          </p>
          <ul className="list-disc pl-5 text-sm space-y-2 mb-4">
            <li><strong>Cadencia (1 correo mensual):</strong> Se necesitan dos tipos de contenido para no sonar repetitivo, alternando plantillas mes a mes (Caso de Éxito / Novedad de Catálogo) — no enviando ambas en el mismo mes.</li>
            <li><strong>Estados:</strong> No existe correo de despedida en cuentas activas. Se utiliza "En pausa" tras 3 propuestas sin avance, hasta la próxima temporada.</li>
          </ul>
        </section>

        {/* 7. Resumen Ejecutivo */}
        <section className="mb-4">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded flex items-center justify-center text-sm">7</span>
            Resumen Ejecutivo
          </h2>
          <ul className="list-disc pl-5 text-sm space-y-2 text-gray-700 dark:text-gray-300">
            <li>La secuencia de 3 correos es para conseguir una primera señal de contactos en silencio — no es una herramienta de venta.</li>
            <li>El patrón de apertura (simple, múltiple o respuesta real) decide la acción, no solo el temporizador de días.</li>
            <li>El paso 2 de prospección es un correo nuevo e independiente, no un reenvío técnico.</li>
            <li>Una respuesta real saca a la cuenta de la secuencia de forma inmediata y definitiva.</li>
            <li>Las cuentas en gestión activa siguen un marco de cadencia propio.</li>
            <li>El correo de despedida se reserva exclusivamente para silencio total.</li>
            <li>Las cuentas activas reciben 1 correo mensual, alternando contenidos.</li>
          </ul>
        </section>
        
      </div>
    </DraggableModal>
  );
}
