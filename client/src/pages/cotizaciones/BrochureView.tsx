import { useRef } from "react";
import type { Cotizacion, Item } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BrochureViewProps {
    cotizacion: Partial<Cotizacion>;
    onBack?: () => void;
}

export default function BrochureView({ cotizacion, onBack }: BrochureViewProps) {
    const navigate = useNavigate();
    const brochureRef = useRef<HTMLDivElement>(null);

    const items = cotizacion.items || [];

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans">
            {/* Controls */}
            <div className="mb-8 flex justify-between items-center no-print">
                <Button
                    variant="ghost"
                    onClick={onBack || (() => navigate(-1))}
                    className="text-white hover:bg-neutral-800"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
                <div className="flex gap-4">
                    <Button variant="outline" className="text-white border-neutral-700 hover:bg-neutral-800">
                        <Share2 className="mr-2 h-4 w-4" /> Compartir
                    </Button>
                    <Button onClick={() => window.print()} className="bg-green-600 hover:bg-green-700 text-white">
                        <Download className="mr-2 h-4 w-4" /> Exportar PDF
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
                <div className="flex-1 p-12 md:p-16 flex flex-col relative">
                    {/* Subtle Background Pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#b3d4a8]/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

                    <header className="mb-16 relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <h1 className="text-5xl font-black text-[#2d4a22] tracking-tighter leading-none max-w-2xl">
                                Eco-Gifts <span className="text-neutral-300 font-light">|</span> <br />
                                <span className="text-neutral-400">Colección</span> 2026
                            </h1>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-[#b3d4a8] uppercase tracking-[0.2em] mb-1">Presupuesto</div>
                                <div className="text-2xl font-mono text-neutral-300">#{cotizacion.numero_cotizacion || "5000"}</div>
                            </div>
                        </div>
                        <div className="w-20 h-1.5 bg-[#b3d4a8] rounded-full mb-8"></div>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-neutral-400 text-sm uppercase tracking-widest font-medium">Preparado para</p>
                                <div className="text-3xl font-bold text-neutral-800">
                                    {cotizacion.cuenta?.cliente || "Cliente Especial"}
                                </div>
                            </div>
                            <div className="text-right text-neutral-400 text-xs italic">
                                Sustentabilidad y Elegancia en cada detalle
                            </div>
                        </div>
                    </header>

                    {/* Grid Layout (Premium Canva Style) */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-1">
                        {items.map((item, idx) => (
                            <div key={item.id || idx} className="group flex flex-col h-full bg-neutral-50 p-4 rounded-2xl transition-all hover:bg-white hover:shadow-xl hover:-translate-y-1">
                                <div className="aspect-[4/3] bg-white rounded-xl overflow-hidden mb-6 shadow-sm">
                                    {item.imagen ? (
                                        <img
                                            src={item.imagen}
                                            alt={item.descripcion}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-300 italic text-sm">
                                            Muestra de Producto
                                        </div>
                                    )}
                                </div>
                                <div className="mt-auto">
                                    <h3 className="font-bold text-neutral-700 line-clamp-2 text-base mb-2 leading-tight group-hover:text-[#2d4a22] transition-colors">
                                        {item.descripcion}
                                    </h3>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Valor Ref.</span>
                                        <div className="text-[#2d4a22] font-black text-xl">
                                            $ {Math.round(item.cantidad > 0 ? (item.subcostos?.reduce((a, b) => a + b.valor, 0) || 0) / (1 - (item.margen || 18) / 100) : 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <footer className="mt-20 pt-10 border-t border-neutral-100 flex justify-between items-end text-[10px] text-neutral-400 font-bold uppercase tracking-[0.2em] relative z-10">
                        <div>
                            &copy; {new Date().getFullYear()} Ecomoving SpA <span className="mx-2 text-neutral-200">|</span> Santiago, Chile
                        </div>
                        <div className="text-[#b3d4a8] text-sm font-black tracking-normal flex items-center gap-2">
                            <span className="w-8 h-[1px] bg-[#b3d4a8]"></span>
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
          }
        }
      `}</style>
        </div>
    );
}
