import { useState } from "react";
import ContactosMarketing from "./ContactosMarketing";
import ListaContenidos from "./ListaContenidos";
import FabricaMensajes from "./FabricaMensajes";
import FabricaBrochures from "./FabricaBrochures";
import { Users, Library, Sparkles, Layout } from "lucide-react";

export default function Marketing() {
  const [tabActiva, setTabActiva] = useState<"monitor" | "biblioteca" | "fabrica" | "brochures">("monitor");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
          <button
            onClick={() => setTabActiva("monitor")}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${tabActiva === "monitor"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
          >
            <Users className="h-4 w-4" />
            Monitor de Contactos
          </button>

          <button
            onClick={() => setTabActiva("biblioteca")}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${tabActiva === "biblioteca"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
          >
            <Library className="h-4 w-4" />
            Tabla de Contenidos
          </button>
          <button
            onClick={() => setTabActiva("fabrica")}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${tabActiva === "fabrica"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
          >
            <Sparkles className="h-4 w-4" />
            Fábrica de IA
          </button>

          <button
            onClick={() => setTabActiva("brochures")}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${tabActiva === "brochures"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
          >
            <Layout className="h-4 w-4" />
            Fábrica de Brochures
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {tabActiva === "monitor" && <ContactosMarketing />}
          {tabActiva === "biblioteca" && <ListaContenidos onNew={() => setTabActiva("fabrica")} />}
          {tabActiva === "fabrica" && (
            <FabricaMensajes onSave={() => setTabActiva("biblioteca")} />
          )}
          {tabActiva === "brochures" && <FabricaBrochures />}
        </div>
      </div>
    </div >
  );
}
