import { useRef } from "react";
import type { Cotizacion } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BrochureViewProps {
    cotizacion: Partial<Cotizacion>;
    onBack?: () => void;
    layout?: "grid" | "collage";
    orientation?: "portrait" | "landscape";
    pageSize?: "a4" | "oficio";
}

export default function BrochureView({
    cotizacion,
    onBack,
    layout = "grid",
    orientation = "landscape",
    pageSize = "oficio"
}: BrochureViewProps) {
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
                className={`mx-auto bg-white text-neutral-900 shadow-2xl overflow-hidden flex ${orientation === "landscape" ? "flex-row" : "flex-col"} brochure-page`}
                style={{
                    width: orientation === "landscape"
                        ? (pageSize === "oficio" ? "330mm" : "297mm")
                        : (pageSize === "oficio" ? "216mm" : "210mm"),
                    height: orientation === "landscape"
                        ? (pageSize === "oficio" ? "216mm" : "210mm")
                        : (pageSize === "oficio" ? "330mm" : "297mm")
                }}
                id="brochure-content"
            >
                {/* Vertical Branding Bar */}
                <div className="bg-[#b3d4a8] w-16 md:w-28 flex flex-col items-center justify-between py-12 relative overflow-hidden shrink-0">
                    <div className="transform -rotate-90 whitespace-nowrap text-[#2d4a22] font-black tracking-[0.3em] text-2xl md:text-3xl uppercase origin-center mt-32">
                        ECOMOWING
                    </div>
                    <div className="w-1 h-32 bg-[#2d4a22]/20 mb-12"></div>
                </div>

                <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
                    {/* Grid vs Collage Layout */}
                    {layout === "grid" ? (
                        <div className={`grid ${orientation === "landscape" ? "grid-cols-3" : "grid-cols-2"} gap-0 flex-1 h-full`}>
                            {items.map((item, idx) => (
                                <div key={item.id || idx} className="group relative overflow-hidden bg-neutral-50 shadow-inner">
                                    {item.imagen ? (
                                        <img
                                            src={item.imagen}
                                            alt=""
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s] ease-out pointer-events-none"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-neutral-100 italic text-[10px] text-gray-300 flex items-center justify-center">Ecomoving</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-12 grid-rows-12 gap-0 flex-1 h-full artistic-collage bg-neutral-900">
                            {items.slice(0, 10).map((item, idx) => {
                                // Intelligent spans based on count and orientation to fill 12x12
                                let span = "";
                                if (orientation === "landscape") {
                                    const landscapeSpans = [
                                        "col-span-8 row-span-8", // Principal (Most dominant)
                                        "col-span-4 row-span-6", // Side 1
                                        "col-span-4 row-span-6", // Side 2
                                        "col-span-4 row-span-4", // Bottom 1
                                        "col-span-4 row-span-4", // Bottom 2
                                    ];
                                    span = landscapeSpans[idx] || "col-span-2 row-span-2";
                                } else {
                                    const portraitSpans = [
                                        "col-span-12 row-span-6", // Top Main
                                        "col-span-6 row-span-4",  // Mid 1
                                        "col-span-6 row-span-4",  // Mid 2
                                        "col-span-4 row-span-2",  // Bottom 1
                                        "col-span-4 row-span-2",  // Bottom 2
                                        "col-span-4 row-span-2",  // Bottom 3
                                    ];
                                    span = portraitSpans[idx] || "col-span-4 row-span-4";
                                }

                                return (
                                    <div
                                        key={item.id || idx}
                                        className={`group relative overflow-hidden bg-neutral-800 ${span}`}
                                    >
                                        {item.imagen ? (
                                            <img
                                                src={item.imagen}
                                                alt=""
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[4s] ease-in-out"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-900 italic text-[8px]">Muestra</div>
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
        @page {
          size: ${pageSize === "oficio" ? "216mm 330mm" : "auto"};
          margin: 0;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          #brochure-content { 
            box-shadow: none !important; 
            width: 100% !important; 
            max-width: none !important;
            margin: 0 !important;
            height: 100vh !important;
            border: none !important;
          }
          .brochure-page {
            max-width: 100vw !important;
            max-height: 100vh !important;
            page-break-after: always;
          }
        }
      `}</style>
        </div>
    );
}
