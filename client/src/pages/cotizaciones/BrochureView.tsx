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

const BAR_COLORS = [
    { bg: "bg-[#b3d4a8]", text: "text-[#2d4a22]", line: "bg-[#2d4a22]/20" }, // Green
    { bg: "bg-indigo-200", text: "text-indigo-900", line: "bg-indigo-900/20" }, // Indigo
    { bg: "bg-amber-200", text: "text-amber-900", line: "bg-amber-900/20" }, // Amber
    { bg: "bg-rose-100", text: "text-rose-900", line: "bg-rose-900/20" }, // Rose
    { bg: "bg-slate-200", text: "text-slate-900", line: "bg-slate-900/20" }  // Slate
];

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

    // Uniform Pagination Logic
    const maxPerPage = layout === "grid" ? 6 : 5;
    const numPages = Math.ceil(items.length / maxPerPage);
    const pages = [];

    if (numPages > 0) {
        let itemsLeft = items.length;
        let offset = 0;
        for (let i = 0; i < numPages; i++) {
            const size = Math.ceil(itemsLeft / (numPages - i));
            pages.push(items.slice(offset, offset + size));
            offset += size;
            itemsLeft -= size;
        }
    }

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
                    className="text-white hover:bg-neutral-800 font-bold"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a edición
                </Button>
                <div className="flex gap-4">
                    <Button variant="outline" className="text-white border-neutral-700 hover:bg-neutral-800 font-bold">
                        <Share2 className="mr-2 h-4 w-4" /> Compartir
                    </Button>
                    <Button onClick={() => window.print()} className="bg-white text-black hover:bg-gray-200 font-bold">
                        <Download className="mr-2 h-4 w-4" /> Exportar Mural ({pages.length} {pages.length === 1 ? 'Pág' : 'Págs'})
                    </Button>
                </div>
            </div>

            <div ref={brochureRef} className="flex flex-col gap-16 items-center pb-32">
                {pages.map((pageItems, pageIdx) => {
                    const color = BAR_COLORS[pageIdx % BAR_COLORS.length];
                    const isEven = pageIdx % 2 === 0;

                    return (
                        <div
                            key={pageIdx}
                            className={`bg-white text-neutral-900 shadow-2xl overflow-hidden flex flex-row brochure-page print:shadow-none print:m-0`}
                            style={{
                                width: dimensions.width,
                                height: dimensions.height,
                                minHeight: dimensions.height,
                            }}
                        >
                            {/* Branding Bar (Left Case) */}
                            {isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000`}>
                                    <div className={`transform -rotate-90 whitespace-nowrap mt-32 ${color.text} font-black tracking-[0.4em] text-2xl md:text-3xl uppercase origin-center`}>
                                        ECOMOWING
                                    </div>
                                    <div className={`w-1 h-32 mb-12 ${color.line}`}></div>
                                </div>
                            )}

                            {/* Images Area */}
                            <div className="flex-1 overflow-hidden bg-white relative">
                                {layout === "grid" ? (
                                    <div className={`grid ${orientation === "landscape" ? "grid-cols-3 grid-rows-2" : "grid-cols-2 grid-rows-3"} gap-0 h-full w-full`}>
                                        {pageItems.map((item, idx) => (
                                            <div key={item.id || idx} className="relative overflow-hidden bg-neutral-50 group">
                                                {item.imagen && (
                                                    <img
                                                        src={item.imagen}
                                                        alt=""
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] ease-in-out"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-12 grid-rows-12 gap-0 h-full w-full bg-neutral-900">
                                        {pageItems.map((item, idx) => {
                                            // Dynamic Spans to fill 12x12
                                            let span = "";
                                            const count = pageItems.length;

                                            if (orientation === "landscape") {
                                                const landscapeSpans = [
                                                    "col-span-8 row-span-12", // Big Left
                                                    "col-span-4 row-span-6",  // Top Right
                                                    "col-span-4 row-span-3",  // Bottom Right 1
                                                    "col-span-2 row-span-3",  // Bottom Right 2
                                                    "col-span-2 row-span-3",  // Bottom Right 3
                                                ];
                                                span = landscapeSpans[idx] || "col-span-4 row-span-4";
                                            } else {
                                                const portraitSpans = [
                                                    "col-span-12 row-span-7", // Top Large
                                                    "col-span-6 row-span-5",  // Mid Left
                                                    "col-span-6 row-span-2",  // Mid Right Top
                                                    "col-span-3 row-span-3",  // Bottom Row 1
                                                    "col-span-3 row-span-3",  // Bottom Row 2
                                                ];
                                                span = portraitSpans[idx] || "col-span-6 row-span-4";
                                            }

                                            return (
                                                <div key={item.id || idx} className={`relative overflow-hidden group ${span}`}>
                                                    {item.imagen && (
                                                        <img
                                                            src={item.imagen}
                                                            alt=""
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[4s] ease-out"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Branding Bar (Right Case) */}
                            {!isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000`}>
                                    <div className={`transform rotate-90 whitespace-nowrap mb-32 ${color.text} font-black tracking-[0.4em] text-2xl md:text-3xl uppercase origin-center`}>
                                        ECOMOWING
                                    </div>
                                    <div className={`w-1 h-32 mt-12 ${color.line}`}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
                @page {
                    size: ${dimensions.width} ${dimensions.height};
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
