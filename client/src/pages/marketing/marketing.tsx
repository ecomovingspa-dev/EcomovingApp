// Trigger build - Removing Image Factory reference
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
      <div className="max-w-7xl mx-auto p-6 pt-2">
        {/* Tab Navigation */}
        <div className="flex w-full max-w-4xl mx-auto gap-2 mb-4 bg-white/50 dark:bg-gray-800/50 p-1.5 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-md">
          <button
            onClick={() => setTabActiva("monitor")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${tabActiva === "monitor"
              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/30 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent"
              }`}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Monitor de Contactos</span>
            <span className="sm:hidden">Monitor</span>
          </button>

          <button
            onClick={() => setTabActiva("biblioteca")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${tabActiva === "biblioteca"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent"
              }`}
          >
            <Library className="h-4 w-4" />
            <span className="hidden sm:inline">Tabla de Contenidos</span>
            <span className="sm:hidden">Biblioteca</span>
          </button>

          <button
            onClick={() => setTabActiva("fabrica")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${tabActiva === "fabrica"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/30 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent"
              }`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Fábrica de IA</span>
            <span className="sm:hidden">IA</span>
          </button>

          <button
            onClick={() => setTabActiva("brochures")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${tabActiva === "brochures"
              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/30 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent"
              }`}
          >
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Fábrica de Brochures</span>
            <span className="sm:hidden">Brochures</span>
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
