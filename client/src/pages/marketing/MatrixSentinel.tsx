import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrazabilidadProspeccion from "./TrazabilidadProspeccion";
import TrazabilidadCuentas from "./TrazabilidadCuentas";

export default function MatrixSentinel() {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-1000">
      <Tabs defaultValue="prospeccion" className="w-full">
        <TabsList className="mb-4 bg-gray-900/40 border border-gray-800 rounded-xl p-1 h-auto flex w-fit">
          <TabsTrigger 
            value="prospeccion" 
            className="text-sm font-black uppercase rounded-lg px-8 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 flex items-center gap-2"
          >
            ⭐ Prospección
          </TabsTrigger>
          <TabsTrigger 
            value="cuentas" 
            className="text-sm font-black uppercase rounded-lg px-8 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 flex items-center gap-2"
          >
            🟢 Cuentas Activas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="prospeccion" className="mt-0 outline-none">
          <TrazabilidadProspeccion />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-0 outline-none">
          <TrazabilidadCuentas />
        </TabsContent>
      </Tabs>
    </div>
  );
}
