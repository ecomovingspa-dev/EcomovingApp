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
    pageSize?: "a4" | "carta";
}

export default function BrochureView({
    cotizacion,
    onBack,
    layout = "grid",
    orientation = "portrait",
    pageSize = "carta"
}: BrochureViewProps) {
    const navigate = useNavigate();
    const brochureRef = useRef<HTMLDivElement>(null);

    const items = cotizacion.items || [];

    // Pagination logic
    const itemsPerPage = layout === "grid" ? 6 : 5; // Collage uses specific 5-item template
    const pages = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
        pages.push(items.slice(i, i + itemsPerPage));
    }

    // carta: 216mm x 279mm
    // a4: 210mm x 297mm
    const dimensions = {
        width: orientation === "landscape"
            ? (pageSize === "carta" ? "279mm" : "297mm")
            : (pageSize === "carta" ? "216mm" : "210mm"),
        height: orientation === "landscape"
            ? (pageSize === "carta" ? "216mm" : "210mm")
            : (pageSize === "carta" ? "279mm" : "297mm")
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans">
            {/* Controls */}
            <div className="mb-8 flex justify-between items-center no-print border-b border-white/10 pb-4 max-w-[1200px] mx-auto">
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
                        <Download className="mr-2 h-4 w-4" /> Exportar PDF ({pages.length} {pages.length === 1 ? 'pág' : 'págs'})
                    </Button>
                </div>
            </div>

            <div ref={brochureRef} className="flex flex-col gap-12 items-center pb-20">
                {pages.map((pageItems, pageIdx) => (
                    <div
                        key={pageIdx}
                        className={`bg-white text-neutral-900 shadow-2xl overflow-hidden flex ${orientation === "landscape" ? "flex-row" : "flex-col"} brochure-page print:shadow-none print:m-0`}
                        style={{
                            width: dimensions.width,
                            height: dimensions.height,
                            minHeight: dimensions.height,
                        }}
                    >
                        {/* Branding Bar */}
                        <div className={`${orientation === "landscape" ? "w-16 md:w-28" : "h-16 md:h-28 w-full"} bg-[#b3d4a8] flex ${orientation === "landscape" ? "flex-col py-12" : "flex-row px-12"} items-center justify-between relative overflow-hidden shrink-0`}>
                            <div className={`${orientation === "landscape" ? "transform -rotate-90 whitespace-nowrap mt-32" : ""} text-[#2d4a22] font-black tracking-[0.3em] text-2xl md:text-3xl uppercase origin-center`}>
                                ECOMOWING
                            </div>
                            <div className={`${orientation === "landscape" ? "w-1 h-32 mb-12" : "h-1 w-32"} bg-[#2d4a22]/20`}></div>
                        </div>

                        {/* Images Area */}
                        <div className="flex-1 overflow-hidden bg-white relative">
                            {layout === "grid" ? (
                                <div className={`grid ${orientation === "landscape" ? "grid-cols-3 grid-rows-2" : "grid-cols-2 grid-rows-3"} gap-0 h-full w-full`}>
                                    {pageItems.map((item, idx) => (
                                        <div key={item.id || idx} className="relative overflow-hidden bg-neutral-50 shadow-inner group">
                                            {item.imagen && (
                                                <img
                                                    src={item.imagen}
                                                    alt=""
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-12 grid-rows-12 gap-0 h-full w-full bg-neutral-900">
                                    {pageItems.map((item, idx) => {
                                        let span = "";
                                        if (orientation === "landscape") {
                                            const landscapeSpans = [
                                                "col-span-8 row-span-12", // Left Big
                                                "col-span-4 row-span-6",  // Top Right
                                                "col-span-4 row-span-3",  // Bottom Right 1
                                                "col-span-2 row-span-3",  // Bottom Right 2
                                                "col-span-2 row-span-3",  // Bottom Right 3
                                            ];
                                            span = landscapeSpans[idx] || "col-span-4 row-span-4";
                                        } else {
                                            const portraitSpans = [
                                                "col-span-12 row-span-8", // Top Big
                                                "col-span-6 row-span-4",  // Bottom Left
                                                "col-span-3 row-span-2",  // Bottom Right Top
                                                "col-span-3 row-span-2",  // Bottom Right Top 2
                                                "col-span-6 row-span-2",  // Bottom Most
                                            ];
                                            span = portraitSpans[idx] || "col-span-6 row-span-4";
                                        }

                                        return (
                                            <div key={item.id || idx} className={`relative overflow-hidden group ${span}`}>
                                                {item.imagen && (
                                                    <img
                                                        src={item.imagen}
                                                        alt=""
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s]"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                @page {
                    size: ${orientation === "landscape" ? dimensions.width + " " + dimensions.height : dimensions.width + " " + dimensions.height};
                    margin: 0;
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .brochure-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        page-break-after: always;
                    }
                }
            `}</style>
        </div>
    );
}
