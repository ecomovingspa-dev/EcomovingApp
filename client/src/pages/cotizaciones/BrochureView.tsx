import { useRef } from "react";
import type { Cotizacion } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BrochureViewProps {
    cotizacion: Partial<Cotizacion>;
    onBack?: () => void;
    layout?: "grid" | "collage";
}

export default function BrochureView({ cotizacion, onBack, layout = "grid" }: BrochureViewProps) {
    const navigate = useNavigate();
    const brochureRef = useRef<HTMLDivElement>(null);

    const items = cotizacion.items || [];

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans">
            {/* Controls */}
            <div className="mb-8 flex justify-between items-center no-print border-b border-white/10 pb-4">
                <Button
                    variant="ghost"
                    onClick={onBack || (() => navigate(-1))}
                    className="text-white hover:bg-neutral-800"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a edición
                </Button>
                <div className="flex gap-4">
                    <Button variant="outline" className="text-white border-neutral-700 hover:bg-neutral-800">
                        <Share2 className="mr-2 h-4 w-4" /> Compartir
                    </Button>
                    <Button onClick={() => window.print()} className="bg-white text-black hover:bg-gray-200">
                        <Download className="mr-2 h-4 w-4" /> Exportar Mural PDF
                    </Button>
                </div>
            </div>

            {/* Brochure Content */}
            <div
                ref={brochureRef}
                className="max-w-[297mm] mx-auto bg-white text-neutral-900 shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[210mm]"
                id="brochure-content"
            >
                {/* Vertical Branding Bar */}
                <div className="bg-[#b3d4a8] w-16 md:w-28 flex flex-col items-center justify-between py-12 relative overflow-hidden shrink-0">
                    <div className="transform -rotate-90 whitespace-nowrap text-[#2d4a22] font-black tracking-[0.3em] text-2xl md:text-3xl uppercase origin-center mt-32">
                        ECOMOWING
                    </div>
                    <div className="w-1 h-32 bg-[#2d4a22]/20 mb-12"></div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative">
                    {/* Artistic Header (Minimal) */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#b3d4a8]/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

                    {/* Grid vs Collage Layout */}
                    {layout === "grid" ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-0 flex-1">
                            {items.map((item, idx) => (
                                <div key={item.id || idx} className="group relative aspect-square overflow-hidden bg-neutral-100">
                                    {item.imagen ? (
                                        <img
                                            src={item.imagen}
                                            alt=""
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-neutral-200"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 grid-rows-4 gap-0 flex-1 min-h-[800px] artistic-collage">
                            {items.slice(0, 6).map((item, idx) => {
                                // Spans for seamless collage
                                const spans = [
                                    "col-span-4 row-span-4", // Gigante Izquierda
                                    "col-span-2 row-span-2", // Arriba derecha
                                    "col-span-1 row-span-1", // Mini 1
                                    "col-span-1 row-span-1", // Mini 2
                                    "col-span-2 row-span-1", // Pie horizontal
                                ];

                                return (
                                    <div
                                        key={item.id || idx}
                                        className={`group relative overflow-hidden bg-neutral-100 ${spans[idx] || 'col-span-2 row-span-1'}`}
                                    >
                                        {item.imagen ? (
                                            <img
                                                src={item.imagen}
                                                alt=""
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] ease-in-out"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-neutral-200"></div>
                                        )}

                                        {/* Floating Badge for artistic touch but no text */}
                                        {idx === 0 && (
                                            <div className="absolute top-10 left-10 w-24 h-[1px] bg-white/40 z-10"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <footer className="h-20 flex justify-between items-center px-12 text-[10px] text-neutral-400 font-bold uppercase tracking-[0.2em] bg-white shrink-0">
                        <div>
                            &copy; {new Date().getFullYear()} Ecomoving SpA
                        </div>
                        <div className="text-[#b3d4a8] tracking-widest">
                            WWW.ECOMOWING.CL
                        </div>
                    </footer>
                </div>
            </div>

            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          #brochure-content { 
            box-shadow: none !important; 
            width: 100% !important; 
            max-width: none !important;
            margin: 0 !important;
            height: 100vh !important;
          }
        }
      `}</style>
        </div>
    );
}
